import { gpt41 } from "../llm";
import { PipelineState } from "../state";
import { renderRefinements } from "./refinements";

export async function generateModuleCode(
  state: PipelineState,
  feedback?: string,
): Promise<Record<string, string>> {
  const files = state.code_plan?.files ?? [];
  const codeFiles: Record<string, string> = {};
  const hasRefs = (state.github_refs ?? []).some(r => r.snippet);

  for (const file of files) {
    // Find the most relevant reference snippet for this file type
    const refSnippets = (state.github_refs ?? [])
      .filter(r => r.snippet)
      .map(r => `--- Reference: ${r.path} ---\n${r.snippet}`)
      .join('\n\n');

    const prompt = hasRefs
      ? `
You are generating code for file: ${file}
Project: ${state.projectName}

PostgreSQL schema:
${state.db_schema}

Functions (extracted from the reference code):
${JSON.stringify(state.functions_list, null, 2)}

REFERENCE CODE (this is your TEMPLATE — you must replicate it):
${refSnippets}

${state.repo_tree ? `Reference repository folder structure:\n${state.repo_tree}\n` : ''}

ABSOLUTE RULES — VIOLATION IS UNACCEPTABLE:
1. The reference code above is your TEMPLATE. You must replicate its EXACT structure for the corresponding file type.
2. If the reference controller has @Controller('card') with ONE method, your output must have the SAME decorator pattern with ONE method. Do NOT add extra routes.
3. If the reference uses custom decorators like @ApiEndpoint, you MUST use the same decorator. Do NOT replace it with @ApiOperation or other alternatives.
4. If the reference uses BaseResponse<any> as the return type, you MUST use BaseResponse<any>. Do NOT change it to a raw entity type.
5. If the reference uses specific import paths like 'src/common/dtos/base-response', replicate those exact import paths.
6. Copy the EXACT class names, method names, parameter names, and decorator configurations from the reference.
7. The ONLY things you should change are domain-specific names (e.g., 'enrollment' -> your new module name) IF the project name implies a different domain. Otherwise keep everything identical.
8. Do NOT add any methods, routes, fields, or imports that do not exist in the reference code.

${feedback ? `Reviewer feedback to incorporate:\n${feedback}` : ""}
${renderRefinements(state)}

Return ONLY the file contents — no markdown fences, no commentary.
`
      : `
Generate production-grade NodeJS (NestJS + Sequelize-TypeScript) code for file: ${file}
Project: ${state.projectName}

PostgreSQL schema:
${state.db_schema}

Functions:
${JSON.stringify(state.functions_list, null, 2)}

${feedback ? `Reviewer feedback to incorporate:\n${feedback}` : ""}
${renderRefinements(state)}

Return ONLY the file contents — no markdown fences, no commentary.
`;
    const res = await gpt41.invoke(prompt);
    codeFiles[file] = res.content as string;
  }

  return codeFiles;
}
