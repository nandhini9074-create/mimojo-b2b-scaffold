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

  if (state.github_refs?.length && !hasRefs) {
    throw new Error('Failed to download reference snippets from GitHub! Please check your GITHUB_TOKEN and ensure the repository/URL is accessible.');
  }

  for (const file of files) {
    console.log(`[generateModuleCode] Generating code for ${file}... please wait...`);
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
7. Copy the EXACT fields, properties, columns, data types, and validations from the reference DTOs, Entities, and Interfaces. Do NOT add, remove, or alter any fields.
8. The ONLY things you should change are domain-specific names (e.g., 'enrollment' -> your new module name) IF the project name implies a different domain. Keep all field properties identical.
9. Do NOT add any methods, routes, fields, or imports that do not exist in the reference code.
10. Copy the EXACT IMPLEMENTATION LOGIC inside methods. Do NOT summarize or invent new logic. You must replicate the exact loops, conditionals, object creations, and database interactions as they appear in the reference code. 
11. If the reference code iterates over an array like 'cardDetails', you must do exactly the same. Do not simplify the code!
12. Do NOT invent new models or variables *unless* they represent database tables specified in the PostgreSQL schema (like mc_enrollment_duplicates) but missing from reference snippets. If so, you MUST dynamically synthesize the Sequelize model class (e.g., McEnrollmentDuplicates) with matching properties.
13. Select the correct template based on feature type:
    - If the file is for a file-upload / batch feature, map its structure and logic to 'file-upload.controller.ts' / 'file-upload.service.ts'.
    - If the file is for a standard API endpoint, map its structure and logic to 'enroll.controller.ts' / 'unenroll.controller.ts' / 'enroll.service.ts' / 'unenroll.service.ts'.

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
