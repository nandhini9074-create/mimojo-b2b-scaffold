import { gpt41 } from "../llm";
import { safeJsonParse } from "../common/utils/json";
import { PipelineState } from "../state";
import { renderRefinements } from "./refinements";

export async function extractFunctions(state: PipelineState, feedback?: string) {
  const hasRefs = (state.github_refs ?? []).some(r => r.snippet);

  if (state.github_refs?.length && !hasRefs) {
    throw new Error('Failed to download reference snippets from GitHub! Please check your GITHUB_TOKEN and ensure the repository/URL is accessible.');
  }

  const prompt = hasRefs
    ? `
You are a senior backend architect.
Project: ${state.projectName}

Below are the EXACT source code files from a reference repository.
Your job is to extract ONLY the functions/methods that ACTUALLY EXIST in the reference code.

RULES:
1. Extract ONLY functions/methods that are explicitly defined in the reference code snippets below.
2. DO NOT invent, add, or guess any functions that are not present in the code.
3. For each function, extract the EXACT name, EXACT parameters (inputs), and EXACT return type (outputs) as written in the code.
4. If the reference has only 1 method in a controller, output only 1 function. Do NOT add extras.

Reference code snippets:
${(state.github_refs ?? []).map(r => `--- ${r.path} ---\n${r.snippet || '(not available)'}`).join('\n\n')}

Return ONLY JSON of the form:
{
  "modules": [
    {
      "name": "<module name from the reference folder structure>",
      "functions": [
        { 
          "name": "<exact method name>", 
          "type": "<type of feature: api or file>",
          "description": "<what it does>", 
          "inputs": ["<exact param: type with exact properties/fields>"], 
          "outputs": ["<exact return type with exact properties/fields>"], 
          "feature": "<feature name>" 
        }
      ]
    }
  ]
}

Feature list (for context only — do NOT add functions beyond what exists in the reference code):
${state.features.map((f, i) => `${i + 1}. ${f.name} (Type: ${f.type || 'api'})`).join("\n")}

${feedback ? `Reviewer feedback to incorporate:\n${feedback}` : ""}
${renderRefinements(state)}
`
    : `
You are a senior backend architect.
Project: ${state.projectName}

Given this feature list, return ONLY JSON of the form:
{
  "modules": [
    {
      "name": "order",
      "functions": [
        { "name": "createOrder", "type": "api", "description": "...", "inputs": [...], "outputs": [...], "feature": "create order" }
      ]
    }
  ]
}

Feature list:
${state.features
  .map(
    (f, i) =>
      `${i + 1}. ${f.name} (Type: ${f.type || 'api'})${f.refs?.length ? `\n   Reference implementations:\n   - ${f.refs.join('\n   - ')}` : ''}`,
  )
  .join("\n")}

${feedback ? `Reviewer feedback to incorporate:\n${feedback}` : ""}
${renderRefinements(state)}
`;

  const res = await gpt41.invoke(prompt);
  return safeJsonParse(res.content as string);
}
