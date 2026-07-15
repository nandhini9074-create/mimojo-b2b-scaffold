import { gpt41 } from "../llm";
import { safeJsonParse } from "../common/utils/json";
import { PipelineState } from "../state";
import { renderRefinements } from "./refinements";
import { Logger } from "@nestjs/common";

const logger = new Logger('extractFunctions');

export async function extractFunctions(state: PipelineState, feedback?: string) {
  const totalStarted = Date.now();
  if (!state.template_groups || state.template_groups.length === 0) {
    state.template_groups = [{ id: 'enrollment', features: state.features || [], output: {} }];
  }

  for (const group of state.template_groups) {
    logger.log(`Extracting functions for group "${group.id}"...`);
    const started = Date.now();
    const groupState = {
      ...state,
      github_refs: group.output.github_refs,
      features: group.features,
    };
    group.output.functions_list = await runExtractForGroup(groupState, feedback);

    // Filter functions to strictly match the user's selected feature type (api vs file)
    if (group.output.functions_list?.modules) {
      for (const mod of group.output.functions_list.modules) {
        if (mod.functions) {
          mod.functions = mod.functions.filter(fn => {
            const mappedFeature = group.features.find(f => f.name.toLowerCase() === fn.feature?.toLowerCase());
            if (mappedFeature) {
              const expectedType = mappedFeature.type || 'api'; // 'api' or 'file'
              return fn.type === expectedType;
            }
            return true;
          });
        }
      }
    }

    logger.log(`Functions for group "${group.id}" extracted in ${Date.now() - started}ms`);
  }

  state.functions_list = state.template_groups[0]?.output.functions_list;

  const elapsed = Date.now() - totalStarted;
  logger.log(`extractFunctions completed in ${elapsed}ms`);

  return state.functions_list;
}

async function runExtractForGroup(state: PipelineState, feedback?: string) {
  const hasRefs = (state.github_refs ?? []).some(r => r.snippet);

  if (state.github_refs?.length && !hasRefs) {
    throw new Error('Failed to download reference snippets from GitHub! Please check your GITHUB_TOKEN and ensure the repository/URL is accessible.');
  }

  const prompt = hasRefs
    ? `
You are a senior backend architect.
Project: ${state.projectName}

Below are the EXACT source code files from a reference repository.
Your job is to extract functions/methods/endpoints that ACTUALLY EXIST in the reference code snippets below, according to the feature types listed.

RULES:
1. Extract ONLY functions/methods/endpoints explicitly defined in the reference code snippets below.
2. DO NOT invent, add, or guess any functions that are not present in the code.
3. For each function, extract the EXACT name, EXACT parameters (inputs), and EXACT return type (outputs) as written in the code.
4. Map each extracted function to the most relevant feature name from the Feature List below.
5. The "type" field of each function MUST match the type of the feature it is mapped to (either "api" or "file").
6. TRANSACTION CONTROLLER SCOPING RULES — look at the code snippets provided and apply these rules based on what is present:
   - If the snippet is from a transaction controller AND the feature type is "api":
       * Extract ONLY endpoints that are pure data query/read routes (GET requests that fetch transaction lists, summaries, details, dashboards).
       * EXCLUDE any endpoints that handle file uploads, receipt deletions, or appeal submissions. These are identifiable by: HTTP DELETE on a receipt path, @Post routes using FileInterceptor or FilesInterceptor decorators, or route paths containing "receipt" or "appeal".
   - If the snippet is from a transaction controller AND the feature type is "file":
       * Extract ONLY endpoints that handle file/receipt operations: receipt image uploads (multipart/form-data), receipt deletions, and appeal submissions with attached files.
       * EXCLUDE all pure GET query/read endpoints that fetch transaction lists, summaries, or dashboards.
   - If the snippet is from transaction.controller.ts and feature type is "api": Extract ALL endpoints defined in it as "type": "api" — no filtering needed.


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

Feature List:
${state.features.map((f, i) => `${i + 1}. ${f.name} (Type: ${f.type || 'api'})`).join("\n")}

${feedback ? `Reviewer feedback to incorporate:\n${feedback}` : ""}
${renderRefinements(state)}
`
    : `
You are a senior backend architect.
Project: ${state.projectName}

RULES:
1. The 'type' of each function MUST match the type of the feature it is mapped to. For example, if a function belongs to a feature whose type is 'api', then the function's 'type' MUST be 'api'. If the feature's type is 'file', the function's 'type' MUST be 'file'.

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
