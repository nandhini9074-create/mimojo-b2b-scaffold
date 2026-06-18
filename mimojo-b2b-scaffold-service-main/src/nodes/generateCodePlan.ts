import { gpt41 } from "../llm";
import { safeJsonParse } from "../common/utils/json";
import { PipelineState } from "../state";
import { renderRefinements } from "./refinements";

export async function generateCodePlan(state: PipelineState): Promise<{ files: string[] }> {
  const prompt = `
For NestJS + Sequelize project "${state.projectName}", list every source file to create.
Return ONLY JSON: { "files": ["src/modules/<module>/<module>.controller.ts", ...] }

Functions:
${JSON.stringify(state.functions_list, null, 2)}
${renderRefinements(state)}
`;

  const res = await gpt41.invoke(prompt);
  return safeJsonParse(res.content as string);
}
