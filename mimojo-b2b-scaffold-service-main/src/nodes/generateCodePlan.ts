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

function runCodePlanForGroup(state: PipelineState, groupId: string, features: FeatureInput[]): { files: string[] } {
  // We can easily identify feature-specific files because they were tagged with the groupId
  // during the searchGithubRefs step, whereas infrastructure files were tagged with '_shared'.
  const featureRefs = (state.github_refs ?? []).filter(r => r.feature === groupId && r.path);
  
  const files = featureRefs.map(r => r.path as string);

  // Ensure the primary module file is in the plan (standard NestJS structure)
  const moduleFile = `src/${groupId}/${groupId}.module.ts`;
  if (!files.includes(moduleFile)) {
    files.push(moduleFile);
  }

  const uniqueFiles = [...new Set(files)];

  logger.log(`Group "${groupId}" code plan: ${uniqueFiles.join(', ')}`);
  return { files: uniqueFiles };

  /*
  // ─────────────────────────────────────────────────────────────────────────────
  // LEGACY TEMPORARY MODE: Generated exactly 5 core files per group derived from
  // the actual github_refs paths using hardcoded string matching.
  // Kept here for reference.
  // ─────────────────────────────────────────────────────────────────────────────
  const allPaths = (state.github_refs ?? []).map(r => r.path).filter(Boolean) as string[];

  const isInfrastructure = (p: string) =>
    p.includes('app.module') || p.includes('app.controller') || p.includes('app.service') ||
    p.includes('src/main.ts') || p.includes('tracer') || p.includes('logger') ||
    p.includes('guards/') || p.includes('generic-http') || p.includes('http.module') ||
    p.includes('kafka') || p.includes('src/common/') || p.includes('config/server') ||
    p.includes('env.validation') || p.includes('decorators/') || p.includes('card-status.enum');

  const featurePaths = allPaths.filter(p => !isInfrastructure(p));
  const featureTypes = new Set((features ?? []).map(f => f.type || 'api'));

  let controller: string | undefined;
  if (featureTypes.has('file')) {
    controller = featurePaths.find(p => p.includes('controller') && (p.includes('file-upload') || p.includes('v2') || p.includes('receipt')));
  }
  if (!controller) controller = featurePaths.find(p => p.includes('controller'));

  const service = featurePaths.find(p => p.includes('service') && !p.includes('file-upload')) ?? featurePaths.find(p => p.includes('service'));
  const model = featurePaths.find(p => (p.includes('.model.ts') || p.includes('/entities/')) && p.endsWith('.ts'));
  const moduleFile = featurePaths.find(p => p.includes('.module.ts') && !p.includes('app.module') && !p.includes('http.module')) ?? \`src/\${groupId}/\${groupId}.module.ts\`;
  const dto = featurePaths.find(p => (p.includes('/dto/') || p.endsWith('.dto.ts')) && p.endsWith('.ts'));

  const legacyFiles = [controller, service, model, moduleFile, dto].filter((f): f is string => !!f);
  const uniqueLegacyFiles = [...new Set(legacyFiles)];
  return { files: uniqueLegacyFiles };
  */
}
