import { Logger } from "@nestjs/common";

const logger = new Logger('validate');

export async function validate(state: any) {
  logger.log('Starting code validation...');
  const started = Date.now();
  if (!state.template_groups || state.template_groups.length === 0) {
    state.template_groups = [{ id: 'enrollment', features: state.features || [], output: {} }];
  }

  for (const group of state.template_groups) {
    group.output = group.output ?? {};
    if (!group.output.code_files) {
      group.output.validation = { passed: false, errors: ["No code"] };
    } else {
      group.output.validation = { passed: true };
    }
  }

  state.validation = state.template_groups[0]?.output.validation;
  
  const elapsed = Date.now() - started;
  logger.log(`validate completed in ${elapsed}ms. Passed: ${state.validation?.passed}`);

  return state.validation;
}