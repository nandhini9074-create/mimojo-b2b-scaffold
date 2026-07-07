import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { randomUUID } from 'crypto';
import { FeatureInput, PipelineState, ScaffoldStage, TemplateGroupState } from '../state';
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

export function groupFeatures(features: FeatureInput[]): TemplateGroupState[] {
  const enrollmentFeatures: FeatureInput[] = [];
  const transactionFeatures: FeatureInput[] = [];

  for (const f of features) {
    const nameLower = (f.name || '').toLowerCase();
    if (
      nameLower.includes('transaction') ||
      nameLower.includes('payout') ||
      nameLower.includes('merchant') ||
      nameLower.includes('outlet') ||
      nameLower.includes('payday')
    ) {
      transactionFeatures.push(f);
    } else {
      enrollmentFeatures.push(f);
    }
  }

  const groups: TemplateGroupState[] = [];
  if (enrollmentFeatures.length > 0) {
    groups.push({ id: 'enrollment', features: enrollmentFeatures, output: {} });
  }
  if (transactionFeatures.length > 0) {
    groups.push({ id: 'transaction', features: transactionFeatures, output: {} });
  }

  if (groups.length === 0) {
    groups.push({ id: 'enrollment', features: [], output: {} });
  }
  return groups;
}

@Injectable()
export class ScaffoldService {
  private readonly logger = new Logger(ScaffoldService.name);

  /** In-memory session cache. The DB is the source of truth. */
  private readonly sessions = new Map<string, PipelineState>();

  constructor(
    @InjectModel(ScaffoldSession)
    private readonly sessionRepo: typeof ScaffoldSession,
  ) { }

  /** Step 1: kickoff. Runs `functions` stage (extract + github refs) and pauses for approval. */
  async start(projectName: string, features?: FeatureInput[], template_groups?: any[]) {
    const sessionId = randomUUID();

    let allFeatures: FeatureInput[] = [];
    if (template_groups && template_groups.length > 0) {
      for (const g of template_groups) {
        if (g.features) {
          allFeatures.push(...g.features);
        }
      }
    } else if (features) {
      allFeatures.push(...features);
    }

    const grouped = groupFeatures(allFeatures);

    const state: PipelineState = {
      projectName,
      features: allFeatures,
      template_groups: grouped,
      stage: 'functions',
      status: 'running',
      history: [],
      refinements: [],
    };
    this.sessions.set(sessionId, state);
    await this.persist(sessionId, state);

    this.runStage(sessionId, state, 'functions').catch(err => {
      this.logger.error(`Error in background stage functions: ${err.message}`, err.stack);
    });

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
      state.status = 'running';
      await this.persist(sessionId, state);
      
      this.runStage(sessionId, state, state.stage, feedback).catch(err => {
        this.logger.error(`Error in background stage ${state.stage}: ${err.message}`, err.stack);
      });
      return this.snapshot(state);
    }

    // Move to next stage and run it
    const nextIdx = STAGE_ORDER.indexOf(state.stage) + 1;
    const next = STAGE_ORDER[nextIdx];
    state.stage = next;
    if (next !== 'done') {
      state.status = 'running';
      await this.persist(sessionId, state);
      this.runStage(sessionId, state, next).catch(err => {
        this.logger.error(`Error in background stage ${next}: ${err.message}`, err.stack);
      });
    } else {
      state.status = 'idle';
      await this.persist(sessionId, state);
    }
    return this.snapshot(state);
  }

  async get(sessionId: string) {
    const state = await this.requireSession(sessionId);
    if (state.stage !== 'done' && state.status !== 'running' && !this.hasStageOutput(state)) {
      this.logger.log(`Session ${sessionId} is missing outputs for stage ${state.stage}. Auto-triggering generation in background...`);
      state.status = 'running';
      await this.persist(sessionId, state);
      this.runStage(sessionId, state, state.stage).catch(err => {
        this.logger.error(`Error in background auto-triggered stage ${state.stage}: ${err.message}`, err.stack);
      });
    }
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
    state.status = 'running';
    await this.persist(sessionId, state);

    this.runStage(sessionId, state, target, feedback).catch(err => {
      this.logger.error(`Error in background stage ${target}: ${err.message}`, err.stack);
    });
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
          state.repo_tree = undefined;
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
      if (state.template_groups) {
        for (const group of state.template_groups) {
          group.output = group.output ?? {};
          switch (s) {
            case 'functions':
              group.output.functions_list = undefined;
              group.output.github_refs = undefined;
              group.output.repo_tree = undefined;
              break;
            case 'diagrams':
              group.output.diagrams = undefined;
              break;
            case 'docs':
              group.output.api_docs = undefined;
              group.output.project_docs = undefined;
              break;
            case 'db':
              group.output.db_schema = undefined;
              break;
            case 'code':
              group.output.code_plan = undefined;
              group.output.code_files = undefined;
              group.output.validation = undefined;
              break;
            case 'github':
              group.output.repo_url = undefined;
              break;
          }
        }
      }
    }
  }

  // --------------------------------------------------------------------------

  /** Look up a session in the in-memory cache; if missing, hydrate from DB. */
  private async requireSession(sessionId: string): Promise<PipelineState> {
    const cached = this.sessions.get(sessionId);
    if (cached) {
      if (!cached.template_groups && cached.features) {
        cached.template_groups = groupFeatures(cached.features);
      }
      return cached;
    }
    const row = await this.sessionRepo.findByPk(sessionId);
    if (!row) throw new NotFoundException(`Session ${sessionId} not found`);
    const state = row.state as unknown as PipelineState;
    // Restore non-serialisable defaults that may have been stripped
    state.history = state.history ?? [];
    state.refinements = state.refinements ?? [];
    state.stage_timings = state.stage_timings ?? {};
    if (!state.template_groups && state.features) {
      state.template_groups = groupFeatures(state.features);
    }
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
      status: state.status,
      projectName: state.projectName,
      features: state.features,
      template_groups: state.template_groups,
      functions_list: state.functions_list,
      github_refs: state.github_refs,
      repo_tree: state.repo_tree,
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
  private async runStage(sessionId: string, state: PipelineState, stage: ScaffoldStage, feedback?: string) {
    this.logger.log(`Starting stage "${stage}"...`);
    const started = Date.now();
    
    state.status = 'running';
    try {
      await this.runStageInner(sessionId, state, stage, feedback);
    } catch (err) {
      state.status = 'idle';
      await this.persist(sessionId, state);
      throw err;
    }
    
    const elapsed = Date.now() - started;
    state.stage_timings = state.stage_timings ?? {};
    // Keep the LATEST run’s duration (regenerations overwrite the prior one)
    state.stage_timings[stage] = elapsed;
    state.status = 'idle';
    await this.persist(sessionId, state);
    this.logger.log(`Stage "${stage}" completed in ${elapsed}ms`);
  }

  /** Runs (or re-runs with feedback) a single stage. */
  private async runStageInner(sessionId: string, state: PipelineState, stage: ScaffoldStage, feedback?: string) {
    switch (stage) {
      case 'functions': {
        state.github_refs = await searchGithubRefs(state);
        state.functions_list = await extractFunctions(state, feedback);
        break;
      }
      case 'diagrams': {
        state.diagrams = await generateArchitecture(state, feedback);
        break;
      }
      case 'docs': {
        await generateDocs(state, feedback);
        break;
      }
      case 'db': {
        state.db_schema = await generateDbSchema(state, feedback);
        break;
      }
      case 'code': {
        state.code_plan = await generateCodePlan(state);
        state.code_files = await generateModuleCode(state, feedback, async () => {
          await this.persist(sessionId, state);
        });
        // validate + auto-fix loop (max 2 attempts)
        for (let attempt = 0; attempt < 2; attempt++) {
          const v = await validate(state);
          state.validation = v;
          if (v?.passed) break;
          state.code_files = await fix(state).then((r) => r.code_files);
          await this.persist(sessionId, state);
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

  private hasStageOutput(state: PipelineState): boolean {
    if (!state) return false;
    const stage = state.stage;
    const groups = state.template_groups || [];

    const isGroupOutputPopulated = (g) => {
      if (!g || !g.output) return false;
      switch (stage) {
        case 'functions':
          return !!g.output.functions_list;
        case 'diagrams':
          return !!g.output.diagrams;
        case 'docs':
          return !!g.output.api_docs;
        case 'db':
          return !!g.output.db_schema;
        case 'code':
          if (!g.output.code_files) return false;
          const planFiles = g.output.code_plan?.files || [];
          const generatedCount = Object.keys(g.output.code_files).length;
          return generatedCount > 0 && generatedCount >= planFiles.length;
        case 'github':
          return !!g.output.repo_url;
        case 'done':
          return true;
        default:
          return false;
      }
    };

    if (groups.length > 0) {
      return groups.every(isGroupOutputPopulated);
    }

    switch (stage) {
      case 'functions':
        return !!state.functions_list;
      case 'diagrams':
        return !!state.diagrams;
      case 'docs':
        return !!state.api_docs;
      case 'db':
        return !!state.db_schema;
      case 'code':
        if (!state.code_files) return false;
        const planFiles = state.code_plan?.files || [];
        const generatedCount = Object.keys(state.code_files).length;
        return generatedCount > 0 && generatedCount >= planFiles.length;
      case 'github':
        return !!state.repo_url;
      case 'done':
        return true;
      default:
        return false;
    }
  }
}
