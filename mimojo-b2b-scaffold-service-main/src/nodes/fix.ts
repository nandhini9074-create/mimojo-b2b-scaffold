import { gpt41 } from "../llm";
import { Logger } from "@nestjs/common";

const logger = new Logger('fix');

export async function fix(state: any) {
  logger.log('Starting auto-fix loop...');
  const started = Date.now();
  if (!state.template_groups || state.template_groups.length === 0) {
    state.template_groups = [{ id: 'enrollment', features: state.features || [], output: {} }];
  }

  for (const group of state.template_groups) {
    group.output = group.output ?? {};
    const validation = group.output.validation;
    if (validation && !validation.passed && group.output.code_files) {
      const fixed: Record<string, string> = {};
      for (const [file, code] of Object.entries(group.output.code_files)) {
        logger.log(`Running fix for file: ${file}`);
        const fileStart = Date.now();
        const prompt = `
Fix code errors:

Errors:
${validation.errors?.join("\n")}

Code:
${code}
`;

        const res = await gpt41.invoke(prompt);
        fixed[file] = res.content as string;
        logger.log(`Fixed file: ${file} in ${Date.now() - fileStart}ms`);
      }
      group.output.code_files = fixed;
    }
  }

  state.code_files = state.template_groups[0]?.output.code_files;

  const elapsed = Date.now() - started;
  logger.log(`fix completed in ${elapsed}ms`);

  return state;
}