import { gpt41 } from "../llm";
import { PipelineState } from "../state";
import { renderRefinements } from "./refinements";
import { Logger } from "@nestjs/common";

const logger = new Logger('generateDbSchema');

export async function generateDbSchema(state: PipelineState, feedback?: string) {
  const totalStarted = Date.now();
  if (!state.template_groups || state.template_groups.length === 0) {
    return state.db_schema;
  }

  for (const group of state.template_groups) {
    logger.log(`Generating DB schema for group "${group.id}"...`);
    const started = Date.now();
    const groupState = {
      ...state,
      github_refs: group.output.github_refs,
      functions_list: group.output.functions_list,
    };
    group.output.db_schema = await runDbSchemaForGroup(groupState, feedback);
    logger.log(`DB schema for group "${group.id}" generated in ${Date.now() - started}ms`);
  }

  state.db_schema = state.template_groups[0]?.output.db_schema;
  
  const elapsed = Date.now() - totalStarted;
  logger.log(`generateDbSchema completed in ${elapsed}ms`);

  return state.db_schema;
}

async function runDbSchemaForGroup(state: PipelineState, feedback?: string) {
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
1. You MUST extract and use ONLY the exact table names, column names, constraints, and data types found in the provided GitHub references (Sequelize models or DTOs).
2. Do NOT invent or add any tables, columns, or constraints that are NOT explicitly defined in the reference files above.
3. Do NOT omit any fields that exist in the reference. The schema must mirror the reference fields EXACTLY.
4. If a table is not backed by a Sequelize @Table model or a DTO in the GitHub references, DO NOT generate it.

${feedback ? `Reviewer feedback to incorporate:\n${feedback}` : ""}
${renderRefinements(state)}

Return raw SQL only — no markdown fences, no explanation.
`;

  const res = await gpt41.invoke(prompt);
  return res.content as string;
}
