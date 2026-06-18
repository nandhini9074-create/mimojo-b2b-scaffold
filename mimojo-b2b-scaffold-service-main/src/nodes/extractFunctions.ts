import { gpt41 } from "../llm";
import { safeJsonParse } from "../common/utils/json";
import { PipelineState } from "../state";
import { renderRefinements } from "./refinements";

export async function extractFunctions(state: PipelineState, feedback?: string) {
  const prompt = `
You are a senior backend architect.
Project: ${state.projectName}

Given this feature list, return ONLY JSON of the form:
{
  "modules": [
    {
      "name": "order",
      "functions": [
        { "name": "createOrder", "description": "...", "inputs": [...], "outputs": [...], "feature": "create order" }
      ]
    }
  ]
}

Feature list:
${state.features
  .map(
    (f, i) =>
      `${i + 1}. ${f.name}${f.refs?.length ? `\n   Reference implementations:\n   - ${f.refs.join('\n   - ')}` : ''}`,
  )
  .join("\n")}

${feedback ? `Reviewer feedback to incorporate:\n${feedback}` : ""}
${renderRefinements(state)}
`;

  const res = await gpt41.invoke(prompt);
  return safeJsonParse(res.content as string);
}
