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

  // Programmatically extract all generated service and proxy classes
  const scannedItems: { className: string; importPath: string }[] = [];
  for (const f of files) {
    if (f.toLowerCase().endsWith('app.module.ts')) continue;
    if (f.toLowerCase().endsWith('.ts')) {
      const ref = (state.github_refs ?? []).find(
        r => r.path === f || r.path?.endsWith('/' + f) || f.endsWith(r.path ?? '')
      );
      const content = ref?.full_content;
      if (content && /@Injectable\s*\(?\)?/i.test(content)) {
        const classMatch = content.match(/export\s+class\s+(\w+)/);
        if (classMatch) {
          const className = classMatch[1];
          // Skip classes that are already part of the base app.module.ts template to avoid duplicate imports/providers
          if (['AppService', 'PinoLoggerInterceptor', 'AllExceptionsFilter'].includes(className)) {
            continue;
          }
          let importPath = f;
          if (importPath.startsWith('src/')) {
            importPath = './' + importPath.slice(4);
          }
          if (importPath.endsWith('.ts')) {
            importPath = importPath.slice(0, -3);
          }
          importPath = importPath.replace(/\\/g, '/');
          scannedItems.push({ className, importPath });
        }
      }
    }
  }

  // Extract infrastructure modules to provide explicitly to the app.module.ts LLM prompt
  const infraModules: { className: string; importPath: string }[] = [];
  const infraModuleRefs = (state.github_refs ?? []).filter(
    r => r.role === 'infrastructure' && r.path && r.path.toLowerCase().endsWith('.module.ts') && !r.path.toLowerCase().endsWith('app.module.ts')
  );
  
  for (const ref of infraModuleRefs) {
    if (ref.full_content) {
      const classMatch = ref.full_content.match(/export\s+class\s+(\w+Module)/);
      if (classMatch) {
        const className = classMatch[1];
        let importPath = ref.path;
        if (importPath.startsWith('src/')) {
          importPath = './' + importPath.slice(4);
        }
        importPath = importPath.slice(0, -3); // remove .ts
        importPath = importPath.replace(/\\/g, '/');
        infraModules.push({ className, importPath });
      }
    }
  }

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

REQUIRED SERVICES AND PROXIES TO REGISTER:
You MUST import and register all these classes in the "providers" and "exports" arrays:
${scannedItems.map(item => `- Class: ${item.className} (Import from: '${item.importPath}')`).join('\n')}

INFRASTRUCTURE MODULES TO REGISTER:
You MUST import and register all these infrastructure modules in the "imports" array:
${infraModules.map(item => `- Module: ${item.className} (Import from: '${item.importPath}')`).join('\n')}

Functions list:
${JSON.stringify(state.functions_list, null, 2)}

ORIGINAL REFERENCE APP.MODULE.TS CONTENT (preserve its structure, global imports, filters, and providers exactly):
${refSnippets}

STRICT RULES — VIOLATION IS UNACCEPTABLE:
1. Scan the "FILES BEING GENERATED IN THIS RUN" list:
   - Identify all generated controllers (*.controller.ts) → import their classes → add to the "controllers" array in @Module.
   - For all classes listed under "REQUIRED SERVICES AND PROXIES TO REGISTER", import them from their specified paths and register them in both the "providers" and "exports" arrays in @Module.
   - Identify all generated Sequelize models (*.model.ts or inside /entities/) → import their classes → add to a "SequelizeModule.forFeature([...])" declaration inside the @Module "imports" array.
   - For all modules listed under "INFRASTRUCTURE MODULES TO REGISTER", import them from their specified paths and add them to the "imports" array in @Module.
2. PRESERVE all global configurations, modules, providers, and filters from the ORIGINAL REFERENCE APP.MODULE.TS:
   - Keep ConfigModule.forRoot(...) with appConfig, databaseConfig, etc.
   - Keep SequelizeModule.forRootAsync(...) and databaseBuilder config.
   - Keep ThrottlerModule.forRoot(...) intact.
   - Keep LoggerModule, CustomLoggerModule, and PinoLogger configuration details intact.
   - Keep AppController, AppService, and exception filters / interceptors in the providers array.
3. Import ONLY the classes/files that actually exist in the "FILES BEING GENERATED IN THIS RUN" list. Do NOT import any feature module file (like transaction.module.ts or enrollment.module.ts).
4. The generated module class name MUST be AppModule:
   export class AppModule {}
5. Adjust relative import paths to match the directory structure of the generated files relative to src/app.module.ts.

${feedback ? `Reviewer feedback to incorporate:\n${feedback}` : ""}
${renderRefinements(state)}

Return ONLY the file contents — no markdown fences, no commentary.
`;

      logger.log(`FILES BEING GENERATED IN THIS RUN:\n${generatedFiles.join('\n')}`);

      const res = await gpt41.invoke(modulePrompt);
      logger.log(`LLM GENERATED APP.MODULE.TS RESPONSE:\n${res.content}`);
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


