import { gpt41 } from "../llm";
import { PipelineState } from "../state";
import { renderRefinements } from "./refinements";
import { Logger } from "@nestjs/common";

const logger = new Logger('generateModuleCode');

export async function generateModuleCode(
  state: PipelineState,
  feedback?: string,
  onProgress?: () => Promise<void>,
): Promise<Record<string, string>> {
  const totalStarted = Date.now();
  if (!state.template_groups || state.template_groups.length === 0) {
    state.template_groups = [{ id: 'enrollment', features: state.features || [], output: {} }];
  }

  for (const group of state.template_groups) {
    logger.log(`Starting code generation for group "${group.id}"...`);
    const started = Date.now();
    const groupState = {
      ...state,
      github_refs: group.output.github_refs,
      features: group.features,
      functions_list: group.output.functions_list,
      db_schema: group.output.db_schema,
      repo_tree: group.output.repo_tree,
      code_plan: group.output.code_plan,
    };
    group.output.code_files = await runModuleCodeForGroup(
      groupState,
      feedback,
      async (file: string, code: string) => {
        group.output.code_files = { ...(group.output.code_files ?? {}), [file]: code };
        state.code_files = { ...(state.code_files ?? {}), [file]: code };
        if (onProgress) {
          await onProgress();
        }
      }
    );
    logger.log(`Code generation for group "${group.id}" completed in ${Date.now() - started}ms`);
  }

  state.code_files = state.template_groups[0]?.output.code_files;
  
  const elapsed = Date.now() - totalStarted;
  logger.log(`generateModuleCode completed in ${elapsed}ms`);

  return state.code_files || {};
}

async function runModuleCodeForGroup(
  state: PipelineState,
  feedback?: string,
  onFileGenerated?: (file: string, code: string) => Promise<void>,
): Promise<Record<string, string>> {
  const files = state.code_plan?.files ?? [];
  const codeFiles: Record<string, string> = {};
  const hasRefs = (state.github_refs ?? []).some(r => r.snippet);

  if (state.github_refs?.length && !hasRefs) {
    throw new Error('Failed to download reference snippets from GitHub! Please check your GITHUB_TOKEN and ensure the repository/URL is accessible.');
  }

  for (const file of files) {
    const fileStart = Date.now();
    const lowerFile = file.toLowerCase();
    // --- Step 1: Verbatim copy if this exact file exists in the reference snippets ---
    const exactRef = (state.github_refs ?? []).find(
      r => r.path && r.snippet && (r.path === file || r.path.endsWith('/' + file) || file.endsWith(r.path)),
    );
    if (exactRef?.snippet) {
      codeFiles[file] = exactRef.snippet;
      if (onFileGenerated) {
        await onFileGenerated(file, exactRef.snippet);
      }
      logger.log(`Verbatim-copied ${file} from github_refs (exact match)`);
      continue;
    }

    // --- Step 2: Non-core non-ts files get a stub comment ---
    const isCore = lowerFile.endsWith('.ts') && (
      lowerFile.includes('controller') ||
      lowerFile.includes('service') ||
      lowerFile.includes('module') ||
      lowerFile.includes('model') ||
      lowerFile.includes('entity') ||
      lowerFile.includes('dto') ||
      lowerFile.includes('guard') ||
      lowerFile.includes('interceptor') ||
      lowerFile.includes('decorator') ||
      lowerFile.includes('helper') ||
      lowerFile.includes('util') ||
      lowerFile.includes('filter') ||
      lowerFile.includes('common') ||
      lowerFile.includes('config') ||
      lowerFile.includes('enum') ||
      lowerFile.includes('type') ||
      lowerFile.includes('interface') ||
      lowerFile.includes('main') ||
      lowerFile.includes('app.')
    );

    if (!isCore) {
      const commentedContent = getCommentedContent(file);
      codeFiles[file] = commentedContent;
      if (onFileGenerated) {
        await onFileGenerated(file, commentedContent);
      }
      logger.log(`Generated non-core file ${file} as commented template`);
      continue;
    }

    logger.log(`Generating code for ${file}... please wait...`);
    // Find the most relevant reference snippet for this file type
    const refSnippets = (state.github_refs ?? [])
      .filter(r => r.snippet)
      .map(r => `--- Reference: ${r.path} ---\n${r.snippet}`)
      .join('\n\n');

    const prompt = hasRefs
      ? `
You are generating code for file: ${file}
Project: ${state.projectName}

PostgreSQL schema:
${state.db_schema}

Functions (extracted from the reference code):
${JSON.stringify(state.functions_list, null, 2)}

REFERENCE CODE (this is your TEMPLATE — you must replicate it):
${refSnippets}

${state.repo_tree ? `Reference repository folder structure:\n${state.repo_tree}\n` : ''}

ABSOLUTE RULES — VIOLATION IS UNACCEPTABLE:
1. The reference code above is your TEMPLATE. You must replicate its structure for the corresponding file type, but you MUST ONLY implement the methods/endpoints/functions that are explicitly defined in the Functions list above. Do NOT generate any other methods, endpoints, or logic from the REFERENCE CODE templates that are NOT listed in the Functions list.
2. If the reference controller has @Controller('card') with ONE method, your output must have the SAME decorator pattern with ONE method. Do NOT add extra routes.
3. If the reference uses custom decorators like @ApiEndpoint, you MUST use the same decorator. Do NOT replace it with @ApiOperation or other alternatives.
4. If the reference uses BaseResponse<any> as the return type, you MUST use BaseResponse<any>. Do NOT change it to a raw entity type.
5. If the reference uses specific import paths like 'src/common/dtos/base-response', replicate those exact import paths.
6. Copy the EXACT class names, method names, parameter names, and decorator configurations from the reference.
7. Copy the EXACT fields, properties, columns, data types, and validations from the reference DTOs, Entities, and Interfaces. Do NOT add, remove, or alter any fields.
8. The ONLY things you should change are domain-specific names (e.g., 'enrollment' -> your new module name) IF the project name implies a different domain. Keep all field properties identical.
9. Do NOT add any methods, routes, fields, or imports that do not exist in the reference code.
10. Copy the EXACT IMPLEMENTATION LOGIC inside methods. Do NOT summarize or invent new logic. You must replicate the exact loops, conditionals, object creations, and database interactions as they appear in the reference code. 
11. If the reference code iterates over an array like 'cardDetails', you must do exactly the same. Do not simplify the code!
12. Do NOT invent new models or variables *unless* they represent database tables specified in the PostgreSQL schema (like mc_enrollment_duplicates) but missing from reference snippets. If so, you MUST dynamically synthesize the Sequelize model class (e.g., McEnrollmentDuplicates) with matching properties.
13. Select the correct template based on feature type:
    - If the file is for a file-upload / batch feature, map its structure and logic to 'file-upload.controller.ts' / 'file-upload.service.ts'.
    - If the file is for a standard API endpoint, map its structure and logic to 'enroll.controller.ts' / 'unenroll.controller.ts' / 'enroll.service.ts' / 'unenroll.service.ts'.
14. The generated controllers and services MUST ONLY contain the functions/methods listed in the Functions list. Any routes, methods, or logic present in the reference templates that are not in the Functions list must be filtered out and omitted.

${feedback ? `Reviewer feedback to incorporate:\n${feedback}` : ""}
${renderRefinements(state)}

Return ONLY the file contents — no markdown fences, no commentary.
`
      : `
Generate production-grade NodeJS (NestJS + Sequelize-TypeScript) code for file: ${file}
Project: ${state.projectName}

PostgreSQL schema:
${state.db_schema}

Functions:
${JSON.stringify(state.functions_list, null, 2)}

${feedback ? `Reviewer feedback to incorporate:\n${feedback}` : ""}
${renderRefinements(state)}

Return ONLY the file contents — no markdown fences, no commentary.
`;
    const res = await gpt41.invoke(prompt);
    codeFiles[file] = res.content as string;
    if (onFileGenerated) {
      await onFileGenerated(file, res.content as string);
    }
    logger.log(`Generated ${file} in ${Date.now() - fileStart}ms`);
  }

  return codeFiles;
}

function getCommentedContent(filePath: string): string {
  const ext = filePath.split('.').pop()?.toLowerCase();
  if (ext === 'json') {
    return `{\n  "comment": "This JSON configuration file (${filePath}) has been commented out to prioritize generating the core feature files (Controllers, Services, Modules, Entities, DTOs)."\n}`;
  }
  if (ext === 'md' || ext === 'yaml' || ext === 'yml') {
    return `# This documentation/config file (${filePath}) has been commented out to prioritize generating the core feature files (Controllers, Services, Modules, Entities, DTOs).`;
  }
  return `// This source/helper file (${filePath}) has been commented out to prioritize generating the core feature files (Controllers, Services, Modules, Entities, DTOs).`;
}
