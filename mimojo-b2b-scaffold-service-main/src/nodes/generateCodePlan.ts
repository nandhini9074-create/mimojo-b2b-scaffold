import { PipelineState, FeatureInput } from "../state";
import { Logger } from "@nestjs/common";

const logger = new Logger('generateCodePlan');

export async function generateCodePlan(state: PipelineState): Promise<{ files: string[] }> {
  const totalStarted = Date.now();
  if (!state.template_groups || state.template_groups.length === 0) {
    return state.code_plan || { files: [] };
  }

  for (const group of state.template_groups) {
    logger.log(`Generating code plan for group "${group.id}"...`);
    const groupStarted = Date.now();
    const groupState = {
      ...state,
      github_refs: group.output.github_refs,
      features: group.features,
      functions_list: group.output.functions_list,
      repo_tree: group.output.repo_tree,
    };
    group.output.code_plan = runCodePlanForGroup(groupState, group.id, group.features); // TEMP: sync call — no await in 5-file mode
    logger.log(`Code plan for group "${group.id}" generated with ${group.output.code_plan?.files?.length || 0} files in ${Date.now() - groupStarted}ms`);
  }

  state.code_plan = state.template_groups[0]?.output.code_plan;

  const elapsed = Date.now() - totalStarted;
  logger.log(`generateCodePlan completed in ${elapsed}ms`);

  return state.code_plan || { files: [] };
}

// ─────────────────────────────────────────────────────────────────────────────
// TEMPORARY MODE: Generate exactly 5 core files per group derived from
// the actual github_refs paths (respects api vs file type, controller rules).
// To restore full LLM-driven generation, remove this block and uncomment the
// original async function runCodePlanForGroup() at the bottom of this file.
// ─────────────────────────────────────────────────────────────────────────────
function runCodePlanForGroup(state: PipelineState, groupId: string, features: FeatureInput[]): { files: string[] } {
  // All paths available from the downloaded template refs
  const allPaths = (state.github_refs ?? []).map(r => r.path).filter(Boolean) as string[];

  // ── Paths to EXCLUDE (shared infrastructure — not feature-specific) ──────────
  const isInfrastructure = (p: string) =>
    p.includes('app.module') ||
    p.includes('app.controller') ||
    p.includes('app.service') ||
    p.includes('src/main.ts') ||
    p.includes('tracer') ||
    p.includes('logger') ||
    p.includes('guards/') ||
    p.includes('generic-http') ||
    p.includes('http.module') ||
    p.includes('kafka') ||
    p.includes('src/common/') ||
    p.includes('config/server') ||
    p.includes('env.validation') ||
    p.includes('decorators/') ||
    p.includes('card-status.enum');

  // Feature refs only: the controller / service / model / dto files
  const featurePaths = allPaths.filter(p => !isInfrastructure(p));

  // ── Determine active feature types for this group ───────────────────────────
  const featureTypes = new Set((features ?? []).map(f => f.type || 'api'));

  // ── Controller: respect api vs file separation ───────────────────────────────
  // For enrollment: api → enroll.controller.ts | file → file-upload.controller.ts
  // For transaction: api → transaction.controller.ts or transaction-v2.controller.ts
  //                  file → transaction-v2.controller.ts
  let controller: string | undefined;
  if (featureTypes.has('file')) {
    // File type: pick a file-upload or receipt controller
    controller = featurePaths.find(p =>
      p.includes('controller') && (
        p.includes('file-upload') ||
        p.includes('v2') ||
        p.includes('receipt')
      )
    );
  }
  if (!controller) {
    // api type (or fallback): pick any controller but prefer non-v2 for VISA pure api
    controller = featurePaths.find(p => p.includes('controller'));
  }

  // ── Service: pick the primary service file ───────────────────────────────────
  const service = featurePaths.find(p =>
    p.includes('service') &&
    !p.includes('file-upload') // prefer the main service for api; fine for file too
  ) ?? featurePaths.find(p => p.includes('service'));

  // ── Model / Entity ───────────────────────────────────────────────────────────
  const model = featurePaths.find(p =>
    (p.includes('.model.ts') || p.includes('/entities/')) && p.endsWith('.ts')
  );

  // ── Module ───────────────────────────────────────────────────────────────────
  // Usually not in refs — generate a default
  const moduleFile = featurePaths.find(p =>
    p.includes('.module.ts') && !p.includes('app.module') && !p.includes('http.module')
  ) ?? `src/${groupId}/${groupId}.module.ts`;

  // ── DTO ──────────────────────────────────────────────────────────────────────
  const dto = featurePaths.find(p =>
    (p.includes('/dto/') || p.endsWith('.dto.ts')) && p.endsWith('.ts')
  );

  // ── Assemble final 5-file list (deduplicated, no undefineds) ─────────────────
  const files = [
    controller,
    service,
    model,
    moduleFile,
    dto,
  ].filter((f): f is string => !!f);

  // De-duplicate (in case two categories resolved to the same path)
  const uniqueFiles = [...new Set(files)];

  logger.log(`[5-file mode] Group "${groupId}" plan: ${uniqueFiles.join(', ')}`);
  return { files: uniqueFiles };
}

