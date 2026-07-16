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

    // Filter functions to strictly match the user's selected feature type (api vs file)
    if (group.output.functions_list?.modules) {
      for (const mod of group.output.functions_list.modules) {
        if (mod.functions) {
          mod.functions = mod.functions.filter(fn => {
            const matchingFeatures = group.features.filter(f => group.id.toLowerCase() === fn.feature?.toLowerCase());
            if (matchingFeatures.length > 0) {
              // The function's type must be one of the types selected by the user for this group
              const isValidType = matchingFeatures.some(f => (f.type || 'api') === fn.type);
              if (!isValidType) return false;

              // Strict validation: Prevent LLM from categorizing GET queries as 'file' and uploads as 'api'
              const name = (fn.name || '').toLowerCase();
              const isFileUploadLogic = name.includes('file') || name.includes('upload') || name.includes('batch') || name.includes('receipt') || name.includes('appeal');
              
              if (fn.type === 'file' && !isFileUploadLogic) return false;
              if (fn.type === 'api' && isFileUploadLogic) return false;

              return true;
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

async function runExtractForGroup(state: PipelineState, groupId: string, features: FeatureInput[], feedback?: string) {
  const hasRefs = (state.github_refs ?? []).some(r => r.snippet);

  if (state.github_refs?.length && !hasRefs) {
    throw new Error('Failed to download reference snippets from GitHub! Please check your GITHUB_TOKEN and ensure the repository/URL is accessible.');
  }

  const prompt = `
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
${features.map((f, i) => `${i + 1}. ${groupId} (Type: ${f.type || 'api'})`).join("\n")}

${feedback ? `Reviewer feedback to incorporate:\n${feedback}` : ""}
${renderRefinements(state)}
`;

  const res = await gpt41.invoke(prompt);
  return safeJsonParse(res.content as string);
}
