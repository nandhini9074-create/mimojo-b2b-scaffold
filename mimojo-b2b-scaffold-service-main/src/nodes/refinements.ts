import { PipelineState } from '../state';

/**
 * Render the cumulative reviewer refinements as a prompt fragment.
 *
 * Every rejection feedback is appended to `state.refinements` by the service
 * layer. Each downstream stage MUST include this block in its prompt so that
 * modifications made to the original request mid-pipeline propagate forward.
 *
 * Returns an empty string when there are no refinements yet.
 */
export function renderRefinements(state: PipelineState): string {
  const list = state.refinements ?? [];
  if (!list.length) return '';
  const lines = list.map(
    (r, i) => `${i + 1}. [from "${r.stage}" stage] ${r.feedback}`,
  );
  return `
Cumulative refinements to the original request (apply ALL of these — they modify the original spec and must be reflected in this stage's output):
${lines.join('\n')}
`;
}
