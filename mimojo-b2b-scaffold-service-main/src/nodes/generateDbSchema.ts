import { gpt41 } from "../llm";
import { PipelineState } from "../state";
import { renderRefinements } from "./refinements";

export async function generateDbSchema(state: PipelineState, feedback?: string) {
  const hasRefs = (state.github_refs ?? []).some(r => r.snippet);

  if (state.github_refs?.length && !hasRefs) {
    throw new Error('Failed to download reference snippets from GitHub! Please check your GITHUB_TOKEN and ensure the repository/URL is accessible.');
  }

  const prompt = `
Generate a complete PostgreSQL DDL schema (CREATE TABLE / INDEX / FK statements only) for project "${state.projectName}".

Functions:
${JSON.stringify(state.functions_list, null, 2)}

GitHub references to mirror structure from:
${JSON.stringify(state.github_refs ?? [], null, 2)}

CRITICAL INSTRUCTION:
1. You MUST extract and use the exact table names, column names, constraints, and data types found in the provided GitHub references (such as Sequelize models or DTOs). 
2. Do NOT invent your own fields, and do NOT omit any fields that exist in the reference. The schema must mirror the reference fields EXACTLY.
3. For functions of type "file" or when requested by the scenario, if some database tables (e.g., "mc_enrollment_duplicates" or similar batch tables) do not exist as Sequelize model reference files, you MUST dynamically synthesize the DDL schema for them. Create logical columns (such as id, file_name, file_record_num, duplicate_count, status, error_details, timestamps) corresponding to the needs of the file upload service.

${feedback ? `Reviewer feedback to incorporate:\n${feedback}` : ""}
${renderRefinements(state)}

Return raw SQL only — no markdown fences, no explanation.
`;

  const res = await gpt41.invoke(prompt);
  return res.content as string;
}
