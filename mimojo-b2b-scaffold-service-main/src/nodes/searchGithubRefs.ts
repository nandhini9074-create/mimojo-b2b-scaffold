
import axios from "axios";
import * as fs from "fs";
import * as path from "path";
import { GithubRef, PipelineState } from "../state";
import { scaffoldTemplateRegistry } from "../config/scaffold-templates.config";
import { Logger } from "@nestjs/common";

const logger = new Logger('searchGithubRefs');

const MAX_SNIPPET_SIZE = 50_000; // 50KB cap to prevent blowing AI context

function getTokenForOwner(owner: string): string | undefined {
  if (owner === process.env.GITHUB_OWNER_TRANSACTION) {
    return process.env.GITHUB_TOKEN_TRANSACTION;
  }
  if (owner === process.env.GITHUB_OWNER_ENROLLMENT) {
    return process.env.GITHUB_TOKEN_ENROLLMENT;
  }
  return undefined;
}

/**
 * Build the github_refs[] used by every downstream stage.
 */
export async function searchGithubRefs(state: PipelineState): Promise<GithubRef[]> {
  logger.log('Starting searchGithubRefs...');
  const totalStarted = Date.now();
  if (!state.template_groups || state.template_groups.length === 0) {
    return state.github_refs;
  }

  for (const group of state.template_groups) {
    const config = scaffoldTemplateRegistry[group.id];
    if (!config) continue;

    group.output = group.output ?? {};
    const groupRefs: GithubRef[] = [];
    const groupRepoUrl = config.repoUrl.replace(/\/+$/, '');
    const groupBranch = config.branch || 'main';

    let treeOwner = '';
    let treeRepo = '';
    let treeBranch = 'main';

    const parsedRepoUrl = parseGithubUrl(`${groupRepoUrl}/blob/${groupBranch}/`);
    if (parsedRepoUrl.owner && parsedRepoUrl.repoName) {
      treeOwner = parsedRepoUrl.owner;
      treeRepo = parsedRepoUrl.repoName;
      treeBranch = parsedRepoUrl.branch;
    }


    const fetchedPaths = new Set<string>();

    async function fetchGroupFile(filePath: string, featureName: string) {
      if (fetchedPaths.has(filePath)) return;
      fetchedPaths.add(filePath);

      const url = `${groupRepoUrl}/blob/${groupBranch}/${filePath.replace(/^\/+/, '')}`;
      const parsed = parseGithubUrl(url);
      const result = await fetchRawContent(parsed);
      if (result !== undefined) {
        const isEssential = isEssentialForLLM(filePath);
        groupRefs.push({
          feature: featureName,
          repo: parsed.repo,
          path: parsed.path,
          url: parsed.url,
          snippet: isEssential ? result.snippet : undefined,           // only populate for LLM context if essential
          full_content: result.full_content, // complete raw file — used for verbatim copy
        });
      }
    }

    // Fetch group-specific shared files
    for (const fp of config.templates.shared) {
      await fetchGroupFile(fp, '_shared');
    }

    // Fetch per-feature files
    for (const feature of group.features) {

      const featureType = feature.type || 'api';

      let templatePaths = config.templates[featureType] ?? [];


      // Filter controllers based on feature type (API vs File Upload) and card scheme for Transaction group
      templatePaths = templatePaths.filter(p => {

        const scheme = (feature as any).scheme as string | undefined;
        const isMcScheme = scheme === 'MC' || scheme === 'MC and VISA';
        const isV2 = featureType === 'file' || isMcScheme;

        // V1 files (exclude if V2 project)
        if (p.endsWith('controllers/transaction.controller.ts') || p.endsWith('transaction/transaction.module.ts')) {
          return !isV2;
        }

        // V2 files (exclude if V1 project)
        if (
          p.endsWith('v2/transaction.controller.ts') ||
          p.endsWith('controllers/transaction-v2.controller.ts') ||
          p.endsWith('transaction/v2/transaction.module.ts') ||
          p.endsWith('services/appeal.service.ts')
        ) {
          return isV2;
        }

        if (p.endsWith('enroll.controller.ts') || p.endsWith('unenroll.controller.ts')) {
          return featureType === 'api';
        }
        if (p.endsWith('file-upload.controller.ts')) {
          return featureType !== 'api';
        }

        return true;
      });

      if (templatePaths.length) {
        const schemeTag = (feature as any).scheme ? ` [scheme: ${(feature as any).scheme}]` : '';
        logger.log(`Auto-resolving ${templatePaths.length} refs for group ${group.id} feature "${group.id}"${schemeTag} → [${templatePaths.map(p => p.split('/').pop()).join(', ')}]`);
        for (const fp of templatePaths) {
          await fetchGroupFile(fp, group.id);
        }
        continue;
      }


    }

    group.output.github_refs = groupRefs;

    if (treeOwner && treeRepo) {
      group.output.repo_tree = await fetchRepoTree(treeOwner, treeRepo, treeBranch);
    }
  }

  state.github_refs = state.template_groups.flatMap(g => g.output.github_refs ?? []);
  state.repo_tree = state.template_groups[0]?.output.repo_tree;

  const elapsed = Date.now() - totalStarted;
  logger.log(`Total refs fetched: ${state.github_refs.length} in ${elapsed}ms`);


  return state.github_refs;
}

/**
 * Fetch the full directory tree of a GitHub repo.
 * Uses the GitHub API (with token if available) to get the recursive tree.
 * Returns a newline-separated list of file paths.
 */
async function fetchRepoTree(
  owner: string,
  repo: string,
  branch: string,
): Promise<string | undefined> {
  try {
    const token = getTokenForOwner(owner);
    const url = `https://api.github.com/repos/${owner}/${repo}/git/trees/${branch}?recursive=1`;

    const headers: Record<string, string> = {
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'mimojo-scaffold-service',
    };
    if (token) {
      headers['Authorization'] = `token ${token}`;
    }

    const { data } = await axios.get(url, { headers, timeout: 15_000 });

    if (data?.tree) {
      // Filter to only source files (ignore node_modules, dist, .git etc.)
      const paths = data.tree
        .filter((item: any) =>
          item.type === 'blob' &&
          !item.path.startsWith('node_modules/') &&
          !item.path.startsWith('dist/') &&
          !item.path.startsWith('.git/') &&
          !item.path.startsWith('.husky/')
        )
        .map((item: any) => item.path);
      return paths.join('\n');
    }
    return undefined;
  } catch (err) {
    logger.warn(`Failed to fetch repo tree for ${owner}/${repo}: ` + (err as Error).message);
    return undefined;
  }
}

async function fetchRawContent(
  parsed: ReturnType<typeof parseGithubUrl>,
): Promise<{ snippet: string; full_content: string } | undefined> {
  if (!parsed.owner || !parsed.repoName || !parsed.path) return undefined;
  // Use the official GitHub API to fetch raw contents, which handles fine-grained PATs properly
  const apiUrl = `https://api.github.com/repos/${parsed.owner}/${parsed.repoName}/contents/${parsed.path}`;

  const headers: Record<string, string> = {
    'Accept': 'application/vnd.github.v3.raw',
  };
  const token = getTokenForOwner(parsed.owner);
  if (token) {
    headers['Authorization'] = `token ${token}`;
  }

  try {
    const { data } = await axios.get(apiUrl, {
      timeout: 10_000,
      responseType: 'text',
      headers,
      params: { ref: parsed.branch }, // Ensure we get from the correct branch
    });

    // full_content holds the entire raw file — never truncated
    const full_content = typeof data === 'string' ? data : JSON.stringify(data);

    // snippet is capped at MAX_SNIPPET_SIZE to stay within LLM token budgets
    const snippet =
      full_content.length > MAX_SNIPPET_SIZE
        ? full_content.slice(0, MAX_SNIPPET_SIZE) + '\n// ... truncated (50KB limit) ...'
        : full_content;

    if (full_content.length > MAX_SNIPPET_SIZE) {
      logger.log(
        `[fetchRawContent] ${parsed.path}: full size ${full_content.length} bytes — snippet capped at ${MAX_SNIPPET_SIZE} bytes for LLM; full_content preserved for verbatim copy.`,
      );
    }

    return { snippet, full_content };
  } catch (err) {
    logger.warn(`Failed to fetch raw content for ${apiUrl}: ` + (err as Error).message);
    return undefined;
  }
}

/**
 * Parse a github.com/<owner>/<repo>/blob/<branch>/<path> URL.
 * Extracts owner, repoName, branch and file path for raw content fetching.
 */
function parseGithubUrl(url: string): {
  owner: string; repoName: string; branch: string;
  repo: string; path: string; url: string;
} {
  try {
    const u = new URL(url);
    // pathname parts: [owner, repo, blob|tree, branch, ...path]
    const parts = u.pathname.split('/').filter(Boolean);
    const owner = parts[0] || '';
    const repoName = parts[1] || '';
    const branch = parts[3] || 'main'; // default to 'main' if not specified
    const path = parts.slice(4).join('/');
    const repo = owner && repoName ? `${owner}/${repoName}` : url;
    return { owner, repoName, branch, repo, path, url };
  } catch {
    return { owner: '', repoName: '', branch: 'main', repo: '', path: '', url };
  }
}

function isEssentialForLLM(filePath: string): boolean {
  const lower = filePath.toLowerCase();
  if (!lower.endsWith('.ts')) return false;

  return (
    lower.endsWith('controller.ts') ||
    lower.endsWith('service.ts') ||
    lower.endsWith('dto.ts') ||
    lower.endsWith('model.ts') ||
    lower.endsWith('entity.ts') ||
    lower.endsWith('enum.ts') ||
    lower.endsWith('app.module.ts')
  );
}


