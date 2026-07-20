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
  // Retrieve both the group's feature-specific files (excluding any feature modules) and infrastructure shared files
  const featureRefs = (state.github_refs ?? []).filter(
    r => r.feature === groupId && r.path && !r.path.toLowerCase().endsWith('.module.ts')
  );
  const sharedRefs = (state.github_refs ?? []).filter(r => r.feature === '_shared' && r.path);

  const files = [
    ...sharedRefs.map(r => r.path as string),
    ...featureRefs.map(r => r.path as string),
  ];

  const uniqueFiles = [...new Set(files)];

  logger.log(`Group "${groupId}" code plan: ${uniqueFiles.join(', ')}`);
  return { files: uniqueFiles };

}