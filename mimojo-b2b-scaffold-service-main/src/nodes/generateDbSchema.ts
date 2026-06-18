import { gpt41 } from "../llm";
import { PipelineState } from "../state";
import { renderRefinements } from "./refinements";

export async function generateDbSchema(state: PipelineState, feedback?: string) {
  const prompt = `
Generate a complete PostgreSQL DDL schema (CREATE TABLE / INDEX / FK statements only) for project "${state.projectName}".

Functions:
${JSON.stringify(state.functions_list, null, 2)}

${feedback ? `Reviewer feedback to incorporate:\n${feedback}` : ""}
${renderRefinements(state)}

Return raw SQL only — no markdown fences, no explanation.
`;

  const res = await gpt41.invoke(prompt);
  return res.content as string;
}
