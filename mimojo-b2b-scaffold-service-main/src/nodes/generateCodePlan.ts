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
    const planResult = runCodePlanForGroup(groupState, group.id, group.features);
    group.output.infrastructure_files = planResult.infrastructure_files;
    group.output.feature_file_paths = planResult.feature_file_paths;
    group.output.code_plan = { files: planResult.files };
    logger.log(`Code plan for group "${group.id}" generated with ${group.output.code_plan.files.length} files in ${Date.now() - groupStarted}ms`);
  }

  state.code_plan = state.template_groups[0]?.output.code_plan;

  const elapsed = Date.now() - totalStarted;
  logger.log(`generateCodePlan completed in ${elapsed}ms`);

  return state.code_plan || { files: [] };
}

function runCodePlanForGroup(state: PipelineState, groupId: string, features: FeatureInput[]): { files: string[], infrastructure_files: string[], feature_file_paths: string[] } {
  // Retrieve both the group's feature-specific files (excluding any feature modules) and infrastructure files
  const featureRefs = (state.github_refs ?? []).filter(
    r => r.role === 'feature' && r.path && !r.path.toLowerCase().endsWith('.module.ts')
  );
  const infrastructureRefs = (state.github_refs ?? []).filter(
    r => r.role === 'infrastructure' && r.path
  );

  const infrastructure_files = [...new Set(infrastructureRefs.map(r => r.path as string))];
  const feature_file_paths = [...new Set(featureRefs.map(r => r.path as string))];

  const files = [
    ...infrastructure_files,
    ...feature_file_paths,
    'src/app.module.ts', // Always included as it is LLM-generated
  ];

  const uniqueFiles = [...new Set(files)];

  logger.log(`Group "${groupId}" code plan: ${uniqueFiles.join(', ')}`);
  return { files: uniqueFiles, infrastructure_files, feature_file_paths };
}