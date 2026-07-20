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
    return state.code_files;
  }

  for (const group of state.template_groups) {
    logger.log(`Starting code generation for group "${group.id}"...`);
    const started = Date.now();
    const groupState = {
      ...state,
      github_refs: group.output.github_refs,
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

  // Build reference snippets ONCE — reused by the module LLM prompt
  const refSnippets = (state.github_refs ?? [])
    .filter(r => r.snippet)
    .map(r => `--- Reference: ${r.path} ---\n${r.snippet}`)
    .join('\n\n');

  for (const file of files) {
    const fileStart = Date.now();
    if (file.toLowerCase().endsWith('app.module.ts')) {
      logger.log(`Generating single root module file ${file} via dedicated LLM prompt...`);

      const generatedFiles = files.filter(f => f !== file);

      const modulePrompt = `
You are generating the single, root NestJS AppModule file: ${file}
Project: ${state.projectName}

FILES BEING GENERATED IN THIS RUN (use these as the basis for registering controllers, services, and models):
${generatedFiles.join('\n')}

Functions list:
${JSON.stringify(state.functions_list, null, 2)}

ORIGINAL REFERENCE APP.MODULE.TS CONTENT (preserve its structure, global imports, filters, and providers exactly):
${refSnippets}

STRICT RULES — VIOLATION IS UNACCEPTABLE:
1. Scan the "FILES BEING GENERATED IN THIS RUN" list:
   - Identify all generated controllers (*.controller.ts) → import their classes → add to the "controllers" array in @Module.
   - Identify all generated services (*.service.ts) → import their classes → add to the "providers" and "exports" arrays in @Module.
   - Identify all generated Sequelize models (*.model.ts or inside /entities/) → import their classes → add to a "SequelizeModule.forFeature([...])" declaration inside the @Module "imports" array.
2. PRESERVE all global configurations, modules, providers, and filters from the ORIGINAL REFERENCE APP.MODULE.TS:
   - Keep ConfigModule.forRoot(...) with appConfig, databaseConfig, etc.
   - Keep SequelizeModule.forRootAsync(...) and databaseBuilder config.
   - Keep LoggerModule, CustomLoggerModule, and PinoLogger configuration details intact.
   - Keep AppController, AppService, and exception filters / interceptors in the providers array.
3. Import ONLY the classes/files that actually exist in the "FILES BEING GENERATED IN THIS RUN" list. Do NOT import any feature module file (like transaction.module.ts or enrollment.module.ts).
4. The generated module class name MUST be AppModule:
   export class AppModule {}
5. Adjust relative import paths to match the directory structure of the generated files relative to src/app.module.ts.

Return ONLY the file contents — no markdown fences, no commentary.
`;

      const res = await gpt41.invoke(modulePrompt);
      codeFiles[file] = res.content as string;
      if (onFileGenerated) {
        await onFileGenerated(file, res.content as string);
      }
      logger.log(`Generated single root module file ${file} in ${Date.now() - fileStart}ms`);
      continue;
    }

    // Path B: All other files → Verbatim copy from full_content
    const exactRef = (state.github_refs ?? []).find(
      r => r.path && r.full_content &&
        (r.path === file || r.path.endsWith('/' + file) || file.endsWith(r.path)),
    );
    if (exactRef?.full_content) {
      codeFiles[file] = exactRef.full_content;
      if (onFileGenerated) {
        await onFileGenerated(file, exactRef.full_content);
      }
      logger.log(`Verbatim-copied ${file} from github_refs in ${Date.now() - fileStart}ms`);
      continue;
    }


    logger.warn(`No github_ref match found for ${file} — file will be skipped. Check scaffold-templates.config.ts.`);
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


