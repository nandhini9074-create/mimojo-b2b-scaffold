import { o4 } from "../llm";
import { PipelineState } from "../state";
import { renderRefinements } from "./refinements";

export async function generateDocs(state: PipelineState, feedback?: string) {
  const prompt = `
For project "${state.projectName}" generate TWO documents:
1. ## OpenAPI Spec — full OpenAPI 3.1 YAML for every function as a REST endpoint
2. ## Project README — overview, setup, env vars, endpoint summary

Functions:
${JSON.stringify(state.functions_list, null, 2)}

GitHub references:
${JSON.stringify(state.github_refs ?? [], null, 2)}

${feedback ? `Reviewer feedback to incorporate:\n${feedback}` : ""}
${renderRefinements(state)}

Return Markdown with the two ## sections.
`;

  const res = await o4.invoke(prompt);
  return res.content as string;
}
