import { gpt41 } from "../llm";
import { PipelineState } from "../state";
import { renderRefinements } from "./refinements";

export async function generateModuleCode(
  state: PipelineState,
  feedback?: string,
): Promise<Record<string, string>> {
  const files = state.code_plan?.files ?? [];
  const codeFiles: Record<string, string> = {};

  for (const file of files) {
    const prompt = `
Generate production-grade NodeJS (NestJS + Sequelize-TypeScript) code for file: ${file}
Project: ${state.projectName}

PostgreSQL schema:
${state.db_schema}

Functions:
${JSON.stringify(state.functions_list, null, 2)}

GitHub references to mirror style/patterns from:
${JSON.stringify(state.github_refs ?? [], null, 2)}

${feedback ? `Reviewer feedback to incorporate:\n${feedback}` : ""}
${renderRefinements(state)}

Return ONLY the file contents — no markdown fences, no commentary.
`;
    const res = await gpt41.invoke(prompt);
    codeFiles[file] = res.content as string;
  }

  return codeFiles;
}
