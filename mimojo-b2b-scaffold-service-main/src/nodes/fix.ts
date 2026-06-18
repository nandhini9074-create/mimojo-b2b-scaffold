import { gpt41 } from "../llm";

export async function fix(state: any) {
  const fixed: Record<string, string> = {};

  for (const [file, code] of Object.entries(state.code_files)) {
    const prompt = `
Fix code errors:

Errors:
${state.validation.errors?.join("\n")}

Code:
${code}
`;

    const res = await gpt41.invoke(prompt);
    fixed[file] = res.content as string;
  }

  return { ...state, code_files: fixed };
}