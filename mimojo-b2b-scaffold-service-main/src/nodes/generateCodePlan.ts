import { gpt41 } from "../llm";
import { safeJsonParse } from "../common/utils/json";
import { PipelineState } from "../state";
import { renderRefinements } from "./refinements";

export async function generateCodePlan(state: PipelineState): Promise<{ files: string[] }> {
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
