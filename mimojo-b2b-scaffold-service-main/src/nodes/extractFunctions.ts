import { gpt41 } from "../llm";
import { safeJsonParse } from "../common/utils/json";
import { PipelineState, FeatureInput } from "../state";
import { renderRefinements } from "./refinements";
import { Logger } from "@nestjs/common";

const logger = new Logger('extractFunctions');

export async function extractFunctions(state: PipelineState, feedback?: string) {
  const totalStarted = Date.now();
  if (!state.template_groups || state.template_groups.length === 0) {
    return state.functions_list;
  }

  for (const group of state.template_groups) {
    logger.log(`Extracting functions for group "${group.id}"...`);
    const started = Date.now();
    const groupState = {
      ...state,
      github_refs: group.output.github_refs,
    };
    group.output.functions_list = await runExtractForGroup(groupState, group.id, group.features, feedback);



    logger.log(`Functions for group "${group.id}" extracted in ${Date.now() - started}ms`);
  }

  state.functions_list = state.template_groups[0]?.output.functions_list;

  const elapsed = Date.now() - totalStarted;
  logger.log(`extractFunctions completed in ${elapsed}ms`);

  return state.functions_list;
}

async function runExtractForGroup(state: PipelineState, groupId: string, features: FeatureInput[], feedback?: string) {
  const hasRefs = (state.github_refs ?? []).some(r => r.snippet);

  if (state.github_refs?.length && !hasRefs) {
    throw new Error('Failed to download reference snippets from GitHub! Please check your GITHUB_TOKEN and ensure the repository/URL is accessible.');
  }

  // Filter refs to only keep controllers and services with valid snippets to prevent prompt overload
  const relevantRefs = (state.github_refs ?? []).filter(r => {
    const p = (r.path || '').toLowerCase();
    return !!r.snippet && (p.includes('controller') || p.includes('service'));
  });

  const prompt = `
You are a senior backend architect.
Project: ${state.projectName}

Below are the EXACT source code files from a reference repository.
Your job is to extract functions/methods/endpoints that ACTUALLY EXIST in the reference code snippets below, according to the feature types listed.

RULES:
1. Extract ONLY functions/methods/endpoints explicitly defined in the reference code snippets below.
2. DO NOT invent, add, or guess any functions that are not present in the code.
3. For each function, extract the EXACT name, EXACT parameters (inputs), and EXACT return type (outputs) as written in the code.
4. For each function, extract the exact HTTP method (GET, POST, PUT, DELETE, PATCH) and exact route path string defined in the controller decorator (e.g. @Delete('/receipt/:id') has httpMethod 'DELETE' and routePath '/receipt/:id').
5. Map each extracted function to the most relevant feature name from the Feature List below.
6. The "type" field of each function MUST match the type of the feature it is mapped to (either "api" or "file").
6. TRANSACTION CONTROLLER SCOPING RULES — look at the code snippets provided and apply these rules based on what is present:
   - If the snippet is from a transaction controller AND the feature type is "api":
       * Extract ONLY endpoints that are pure data query/read routes (GET requests that fetch transaction lists, summaries, details, dashboards).
       * EXCLUDE any endpoints that handle file uploads, receipt deletions, or appeal submissions. These are identifiable by: HTTP DELETE on a receipt path, @Post routes using FileInterceptor or FilesInterceptor decorators, or route paths containing "receipt" or "appeal".
   - If the snippet is from a transaction controller AND the feature type is "file":
       * Extract ONLY endpoints that handle file/receipt operations: receipt image uploads (multipart/form-data), receipt deletions, and appeal submissions with attached files.
       * EXCLUDE all pure GET query/read endpoints that fetch transaction lists, summaries, or dashboards.
   - If the snippet is from transaction.controller.ts and feature type is "api": Extract ALL endpoints defined in it as "type": "api" — no filtering needed.


Reference code snippets:
${relevantRefs.map(r => `--- ${r.path} ---\n${r.snippet}`).join('\n\n')}

Return ONLY JSON of the form:
{
  "modules": [
    {
      "name": "<module name from the reference folder structure>",
      "functions": [
        { 
          "name": "<exact method name>", 
          "type": "<type of feature: api or file>",
          "httpMethod": "<GET | POST | PUT | DELETE | PATCH>",
          "routePath": "<exact path decorator string, e.g. /receipt/:id>",
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
${features.map((f, i) => `${i + 1}. ${f.name || groupId} (Type: ${f.type || 'api'}${f.scheme ? `, Scheme: ${f.scheme}` : ''})`).join("\n")}

${feedback ? `Reviewer feedback to incorporate:\n${feedback}` : ""}
${renderRefinements(state)}
`;

  const res = await gpt41.invoke(prompt);
  return safeJsonParse(res.content as string);
}
