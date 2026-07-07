import { gpt41 } from "../llm";
import { safeJsonParse } from "../common/utils/json";
import { PipelineState } from "../state";
import { renderRefinements } from "./refinements";
import { Logger } from "@nestjs/common";

const logger = new Logger('generateCodePlan');

export async function generateCodePlan(state: PipelineState): Promise<{ files: string[] }> {
  const totalStarted = Date.now();
  if (!state.template_groups || state.template_groups.length === 0) {
    state.template_groups = [{ id: 'enrollment', features: state.features || [], output: {} }];
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
    group.output.code_plan = await runCodePlanForGroup(groupState);
    logger.log(`Code plan for group "${group.id}" generated with ${group.output.code_plan?.files?.length || 0} files in ${Date.now() - groupStarted}ms`);
  }

  state.code_plan = state.template_groups[0]?.output.code_plan;
  
  const elapsed = Date.now() - totalStarted;
  logger.log(`generateCodePlan completed in ${elapsed}ms`);

  return state.code_plan || { files: [] };
}

async function runCodePlanForGroup(state: PipelineState): Promise<{ files: string[] }> {
  const hasTree = !!state.repo_tree;
  const hasRefs = (state.github_refs ?? []).some(r => r.snippet);

  const prompt = hasTree || hasRefs
    ? `
For NestJS + Sequelize project "${state.projectName}", list every source file to create.
Return ONLY JSON: { "files": ["src/..."] }

${hasTree ? `Reference repository directory tree (you MUST replicate this exact folder structure, replacing only the domain/module name as needed for the new project):\n${state.repo_tree}\n` : ''}

Reference file paths from GitHub:
${(state.github_refs ?? []).map(r => r.path).join('\n')}

CRITICAL INSTRUCTION:
1. You MUST use the EXACT SAME directory structure as the reference repository tree above.
2. If the reference uses 'src/enrollment/controllers/', you must use 'src/<newModule>/controllers/', NOT 'src/modules/<newModule>/'.
3. If the reference has 'src/common/dtos/', 'src/common/decorators/', etc., you MUST include those same common folders.
4. Create ONLY the files that correspond to actual functions in the function list below. Do NOT add extra files.
5. Check the "type" property of each function in the function list below:
   - For functions of type "api", map them to API templates from the reference (e.g. controller, service, and DTOs like enroll.controller.ts/enroll.service.ts).
   - For functions of type "file", map them to File Upload templates from the reference (e.g. file-upload.controller.ts/file-upload.service.ts, file.model.ts, file-status.dto.ts).

Functions:
${JSON.stringify(state.functions_list, null, 2)}
${renderRefinements(state)}
`
    : `
For NestJS + Sequelize project "${state.projectName}", list every source file to create.
Return ONLY JSON: { "files": ["src/modules/<module>/<module>.controller.ts", ...] }

Functions:
${JSON.stringify(state.functions_list, null, 2)}
${renderRefinements(state)}
`;

  const res = await gpt41.invoke(prompt);
  return safeJsonParse(res.content as string);
}
