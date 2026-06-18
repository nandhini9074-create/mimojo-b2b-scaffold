export async function validate(state: any) {
  // stub: replace with real lint/tsc
  if (!state.code_files) {
    return { ...state, validation: { passed: false, errors: ["No code"] } };
  }

  return { ...state, validation: { passed: true } };
}