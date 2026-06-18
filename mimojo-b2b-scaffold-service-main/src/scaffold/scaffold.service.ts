import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { randomUUID } from 'crypto';
import { FeatureInput, PipelineState, ScaffoldStage } from '../state';
import { ScaffoldSession } from './entities/scaffold-session.model';

import { extractFunctions } from '../nodes/extractFunctions';
import { searchGithubRefs } from '../nodes/searchGithubRefs';
import { generateArchitecture } from '../nodes/generateArchitecture';
import { generateDocs } from '../nodes/generateDocs';
import { generateDbSchema } from '../nodes/generateDbSchema';
import { generateCodePlan } from '../nodes/generateCodePlan';
import { generateModuleCode } from '../nodes/generateModuleCode';
import { validate } from '../nodes/validate';
import { fix } from '../nodes/fix';
import { githubPush } from '../nodes/github';

const STAGE_ORDER: ScaffoldStage[] = [
  'functions',
  'diagrams',
  'docs',
  'db',
  'code',
  'github',
  'done',
];

@Injectable()
export class ScaffoldService {
  /** In-memory session cache. The DB is the source of truth. */
  private readonly sessions = new Map<string, PipelineState>();

  constructor(
    @InjectModel(ScaffoldSession)
    private readonly sessionRepo: typeof ScaffoldSession,
  ) {}

  /** Step 1: kickoff. Runs `functions` stage (extract + github refs) and pauses for approval. */
  async start(projectName: string, features: FeatureInput[]) {
    const sessionId = randomUUID();
    const state: PipelineState = {
      projectName,
      features,
      stage: 'functions',
      history: [],
      refinements: [],
    };
    await this.runStage(state, 'functions');
    this.sessions.set(sessionId, state);
    await this.persist(sessionId, state);
    return { sessionId, ...this.snapshot(state) };
  }

  /** Approve current stage → run next. Or reject with feedback → re-run current with feedback. */
  async approve(sessionId: string, approved: boolean, feedback?: string) {
    const state = await this.requireSession(sessionId);
    if (state.stage === 'done') {
      throw new BadRequestException('Pipeline already complete');
    }

    state.history.push({
      stage: state.stage,
      approved,
      feedback,
      at: new Date().toISOString(),
    });

    if (!approved) {
      if (!feedback) throw new BadRequestException('feedback is required when approved=false');
      // Persist the refinement so every subsequent stage sees the modification
      // to the original request, not just the stage being re-run right now.
      state.refinements = state.refinements ?? [];
      state.refinements.push({
        stage: state.stage,
        feedback,
        at: new Date().toISOString(),
      });
      await this.runStage(state, state.stage, feedback);
      await this.persist(sessionId, state);
      return this.snapshot(state);
    }

    // Move to next stage and run it
    const nextIdx = STAGE_ORDER.indexOf(state.stage) + 1;
    const next = STAGE_ORDER[nextIdx];
    state.stage = next;
    if (next !== 'done') {
      await this.runStage(state, next);
    }
    await this.persist(sessionId, state);
    return this.snapshot(state);
  }

  async get(sessionId: string) {
    const state = await this.requireSession(sessionId);
    return this.snapshot(state);
  }

  /** List every persisted session (newest first), summarised for the history sidebar. */
  async list(): Promise<Array<{
    sessionId: string;
    projectName: string;
    stage: string;
    createdAt: Date;
    updatedAt: Date;
  }>> {
    const rows = await this.sessionRepo.findAll({
      attributes: ['id', 'projectName', 'stage', 'createdAt', 'updatedAt'],
      order: [['updatedAt', 'DESC']],
      limit: 200,
    });
    return rows.map(r => ({
      sessionId: r.id,
      projectName: r.projectName,
      stage: r.stage,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    }));
  }

  /**
   * Jump back (or sideways) to any previously executed stage and re-run it.
   *
   * Behaviour:
   *  - Validates that the target stage is a real stage and has already been executed
   *    (i.e. it is at or before the current stage in STAGE_ORDER).
   *  - Clears stage outputs for the target stage AND every stage AFTER it, so that
   *    downstream artefacts are not left stale once the pipeline moves forward again.
   *  - Records the action in `history` and (when feedback is provided) appends to
   *    `refinements` so every subsequent stage sees the modification.
   *  - Re-runs the target stage with the provided feedback and pauses for approval.
   */
  async restart(sessionId: string, stage: string, feedback?: string) {
    const state = await this.requireSession(sessionId);

    if (!STAGE_ORDER.includes(stage as ScaffoldStage) || stage === 'done') {
      throw new BadRequestException(
        `Invalid stage "${stage}". Must be one of: ${STAGE_ORDER.filter(s => s !== 'done').join(', ')}`,
      );
    }
    const target = stage as ScaffoldStage;
    const targetIdx = STAGE_ORDER.indexOf(target);
    const currentIdx = STAGE_ORDER.indexOf(state.stage);

    // The pipeline must have already reached or passed the target stage; otherwise
    // there's nothing to "restart" — the user should approve forward instead.
    if (targetIdx > currentIdx) {
      throw new BadRequestException(
        `Cannot restart from "${target}" — pipeline has not reached that stage yet (current: "${state.stage}").`,
      );
    }

    state.history.push({
      stage: target,
      approved: false,
      feedback: feedback ? `[restart] ${feedback}` : '[restart]',
      at: new Date().toISOString(),
    });

    if (feedback) {
      state.refinements = state.refinements ?? [];
      state.refinements.push({
        stage: target,
        feedback,
        at: new Date().toISOString(),
      });
    }

    // Invalidate the target stage's outputs and everything downstream of it so the
    // pipeline cannot serve stale data when the user approves forward again.
    this.clearStageOutputsFrom(state, targetIdx);

    state.stage = target;
    await this.runStage(state, target, feedback);
    await this.persist(sessionId, state);
    return this.snapshot(state);
  }

  /** Clear outputs produced at or after the given stage index. Upstream outputs are preserved. */
  private clearStageOutputsFrom(state: PipelineState, fromIdx: number) {
    const stagesToClear = STAGE_ORDER.slice(fromIdx).filter(s => s !== 'done');
    state.stage_timings = state.stage_timings ?? {};
    for (const s of stagesToClear) {
      delete state.stage_timings[s];
      switch (s) {
        case 'functions':
          state.functions_list = undefined;
          state.github_refs = undefined;
          break;
        case 'diagrams':
          state.diagrams = undefined;
          break;
        case 'docs':
          state.api_docs = undefined;
          state.project_docs = undefined;
          break;
        case 'db':
          state.db_schema = undefined;
          break;
        case 'code':
          state.code_plan = undefined;
          state.code_files = undefined;
          state.validation = undefined;
          break;
        case 'github':
          state.repo_url = undefined;
          break;
      }
    }
  }

  // --------------------------------------------------------------------------

  /** Look up a session in the in-memory cache; if missing, hydrate from DB. */
  private async requireSession(sessionId: string): Promise<PipelineState> {
    const cached = this.sessions.get(sessionId);
    if (cached) return cached;
    const row = await this.sessionRepo.findByPk(sessionId);
    if (!row) throw new NotFoundException(`Session ${sessionId} not found`);
    const state = row.state as unknown as PipelineState;
    // Restore non-serialisable defaults that may have been stripped
    state.history = state.history ?? [];
    state.refinements = state.refinements ?? [];
    state.stage_timings = state.stage_timings ?? {};
    this.sessions.set(sessionId, state);
    return state;
  }

  /** Upsert the full PipelineState snapshot into the DB. */
  private async persist(sessionId: string, state: PipelineState) {
    const payload = this.snapshot(state) as Record<string, unknown>;
    await this.sessionRepo.upsert({
      id: sessionId,
      projectName: state.projectName,
      stage: state.stage,
      state: payload,
    });
  }

  /** Public-facing view of session state (omits nothing — all stage outputs are user-visible). */
  private snapshot(state: PipelineState) {
    return {
      stage: state.stage,
      projectName: state.projectName,
      features: state.features,
      functions_list: state.functions_list,
      github_refs: state.github_refs,
      diagrams: state.diagrams,
      api_docs: state.api_docs,
      project_docs: state.project_docs,
      db_schema: state.db_schema,
      code_plan: state.code_plan,
      code_files: state.code_files,
      validation: state.validation,
      repo_url: state.repo_url,
      history: state.history,
      stage_timings: state.stage_timings ?? {},
      refinements: state.refinements ?? [],
    };
  }

  /** Wraps the actual stage runner to record per-stage execution time. */
  private async runStage(state: PipelineState, stage: ScaffoldStage, feedback?: string) {
    const started = Date.now();
    await this.runStageInner(state, stage, feedback);
    const elapsed = Date.now() - started;
    state.stage_timings = state.stage_timings ?? {};
    // Keep the LATEST run’s duration (regenerations overwrite the prior one)
    state.stage_timings[stage] = elapsed;
  }

  /** Runs (or re-runs with feedback) a single stage. */
  private async runStageInner(state: PipelineState, stage: ScaffoldStage, feedback?: string) {
    switch (stage) {
      case 'functions': {
        state.functions_list = await extractFunctions(state, feedback);
        state.github_refs = await searchGithubRefs(state);
        break;
      }
      case 'diagrams': {
        state.diagrams = await generateArchitecture(state, feedback);
        break;
      }
      case 'docs': {
        const md = await generateDocs(state, feedback);
        // Split the two ## sections returned by the LLM
        const [api, readme] = md.split(/^##\s+Project README/m);
        state.api_docs = api?.trim();
        state.project_docs = readme ? `## Project README${readme}`.trim() : undefined;
        break;
      }
      case 'db': {
        state.db_schema = await generateDbSchema(state, feedback);
        break;
      }
      case 'code': {
        state.code_plan = await generateCodePlan(state);
        state.code_files = await generateModuleCode(state, feedback);
        // validate + auto-fix loop (max 2 attempts)
        for (let attempt = 0; attempt < 2; attempt++) {
          const v = await validate(state);
          state.validation = v.validation;
          if (v.validation.passed) break;
          state.code_files = await fix(state).then((r) => r.code_files);
        }
        break;
      }
      case 'github': {
        const { repo_url } = await githubPush(state);
        state.repo_url = repo_url;
        // github push is the final action — auto-mark done
        state.stage = 'done';
        return;
      }
      case 'done':
        return;
    }
    state.stage = stage;
  }
}
