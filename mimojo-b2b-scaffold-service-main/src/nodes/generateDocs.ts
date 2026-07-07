import { o4 } from "../llm";
import { PipelineState } from "../state";
import { renderRefinements } from "./refinements";
import { Logger } from "@nestjs/common";

const logger = new Logger('generateDocs');

export async function generateDocs(state: PipelineState, feedback?: string) {
  const totalStarted = Date.now();
  if (!state.template_groups || state.template_groups.length === 0) {
    state.template_groups = [{ id: 'enrollment', features: state.features || [], output: {} }];
  }

  for (const group of state.template_groups) {
    logger.log(`Generating docs for group "${group.id}"...`);
    const started = Date.now();
    const groupState = {
      ...state,
      github_refs: group.output.github_refs,
      features: group.features,
      functions_list: group.output.functions_list,
    };
    const md = await runDocsForGroup(groupState, feedback);
    const openapiMatch = md.match(/===OPENAPI_START===([\s\S]*?)===OPENAPI_END===/);
    const readmeMatch = md.match(/===README_START===([\s\S]*?)===README_END===/);
    
    let apiDocs = '';
    if (openapiMatch) {
      apiDocs = openapiMatch[1].trim();
    } else {
      const yamlFence = md.match(/```(?:ya?ml)?\s*\n([\s\S]*?)```/i);
      if (yamlFence) {
        apiDocs = yamlFence[1].trim();
      } else {
        const openapiIdx = md.indexOf('openapi:');
        if (openapiIdx !== -1) {
          apiDocs = md.slice(openapiIdx).trim();
        } else {
          apiDocs = md.trim();
        }
      }
    }
    apiDocs = apiDocs.replace(/^```[a-zA-Z0-9_-]*\n/i, '').replace(/\n```$/i, '').trim();
    
    let readmeDocs = '';
    if (readmeMatch) {
      readmeDocs = readmeMatch[1].trim();
    } else {
      const readmeParts = md.split(/##\s+Project README|###\s+README|===README_START===/i);
      if (readmeParts.length > 1) {
        readmeDocs = readmeParts[1].replace(/===README_END===/g, '').trim();
      } else {
        readmeDocs = md.trim();
      }
    }

    group.output.api_docs = apiDocs;
    group.output.project_docs = readmeDocs;
    logger.log(`Docs for group "${group.id}" generated in ${Date.now() - started}ms`);
  }

  state.api_docs = state.template_groups[0]?.output.api_docs;
  state.project_docs = state.template_groups[0]?.output.project_docs;

  const elapsed = Date.now() - totalStarted;
  logger.log(`generateDocs completed in ${elapsed}ms`);

  const firstGroup = state.template_groups[0];
  const combinedMd = `## OpenAPI Spec\n\n\`\`\`yaml\n${firstGroup?.output.api_docs || ''}\n\`\`\`\n\n## Project README\n\n${firstGroup?.output.project_docs || ''}`;
  return combinedMd;
}

async function runDocsForGroup(state: PipelineState, feedback?: string) {
  // Filter refs to only keep controllers and DTOs/models/entities/enums to prevent prompt overload and output truncation
  const filteredRefs = (state.github_refs ?? []).filter(r => {
    const p = (r.path || '').toLowerCase();
    return p.includes('controller') || p.includes('dto') || p.includes('model') || p.includes('entity') || p.includes('enum') || p.includes('main.ts');
  });

  logger.log(`Filtered reference files for doc generation: ${JSON.stringify(filteredRefs.map(r => r.path))}`);

  const prompt = `
For project "${state.projectName}", generate two documentation files:
1. Full OpenAPI 3.0.0 (or 3.1.0) spec in YAML format containing all endpoint paths, parameters, schemas, and responses for every single function listed below.
2. A detailed Project README in Markdown format summarizing the project overview, setup, required environment variables, and endpoint descriptions.

CRITICAL INSTRUCTIONS:
- You MUST generate fully-defined endpoint paths, parameters, requestBodies, schemas, and responses for EVERY SINGLE function in the functions list below.
- Do NOT skip, omit, or summarize any endpoints.
- Do NOT use placeholders, comments, or ellipses (e.g., "...") for any paths or schemas. The spec must be complete, valid YAML, and production-ready.
- Path Parameters Format: In OpenAPI paths, path parameters MUST be enclosed in curly braces (e.g., /transactions/{transactionId}/appeal), NOT colons (do NOT use :transactionId).
- Path Parameters Definition: For every path parameter used in a path (like {transactionId}), you MUST explicitly define a corresponding parameter object in the 'parameters' list for that operation with 'in: path' and 'required: true' and a valid schema.
- Request Bodies: For POST, PUT, and PATCH request payloads, use the "requestBody" field. Do NOT use "in: body" inside the "parameters" array (which is invalid in OpenAPI 3.x).
- Endpoint Count Integrity: The final generated OpenAPI spec MUST contain exactly the same number of endpoints and paths as there are functions in the Functions list. Verify that you have mapped every single function to a corresponding API path before finishing.

Format the output strictly as follows:
===OPENAPI_START===
[Write the OpenAPI YAML spec here. Do NOT include any explanations or prose outside of the YAML structure.]
===OPENAPI_END===

===README_START===
[Write the Project README Markdown here.]
===README_END===

Functions:
${JSON.stringify(state.functions_list, null, 2)}

GitHub references (controllers and schemas):
${JSON.stringify(filteredRefs, null, 2)}

${feedback ? `Reviewer feedback to incorporate:\n${feedback}` : ""}
${renderRefinements(state)}
`;

  logger.log(`Final generateDocs LLM prompt:\n${prompt}`);

  const res = await o4.invoke(prompt);
  
  logger.log(`LLM generated output for doc generation:\n${res.content}`);
  
  return res.content as string;
}
