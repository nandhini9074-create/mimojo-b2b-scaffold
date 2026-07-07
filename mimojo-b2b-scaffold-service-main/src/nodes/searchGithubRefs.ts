import { Octokit } from "@octokit/rest";
import axios from "axios";
import * as fs from "fs";
import * as path from "path";
import { GithubRef, PipelineState } from "../state";
import { scaffoldTemplateRegistry } from "../config/scaffold-templates.config";
import { Logger } from "@nestjs/common";

const logger = new Logger('searchGithubRefs');

const MAX_SNIPPET_SIZE = 50_000; // 50KB cap to prevent blowing AI context

function getTokenForOwner(owner: string): string | undefined {
  const transactionOwner = process.env.GITHUB_OWNER_TRANSACTION || 'nandhini9074-create';
  const enrollmentOwner = process.env.GITHUB_OWNER_ENROLLMENT || process.env.GITHUB_OWNER || 'mojosoln';

  if (owner === transactionOwner) {
    return process.env.GITHUB_TOKEN_TRANSACTION || process.env.GITHUB_TOKEN;
  }
  if (owner === enrollmentOwner) {
    return process.env.GITHUB_TOKEN_ENROLLMENT || process.env.GITHUB_TOKEN;
  }
  return process.env.GITHUB_TOKEN;
}

/**
 * Build the github_refs[] used by every downstream stage.
 */
export async function searchGithubRefs(state: PipelineState): Promise<GithubRef[]> {
  logger.log('Starting searchGithubRefs...');
  const totalStarted = Date.now();
  if (!state.template_groups || state.template_groups.length === 0) {
    state.template_groups = [{ id: 'enrollment', features: state.features || [], output: {} }];
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

    const groupToken = getTokenForOwner(treeOwner);
    const groupOctokit = groupToken ? new Octokit({ auth: groupToken }) : null;

    const fetchedPaths = new Set<string>();

    async function fetchGroupFile(filePath: string, featureName: string) {
      if (fetchedPaths.has(filePath)) return;
      fetchedPaths.add(filePath);

      const url = `${groupRepoUrl}/blob/${groupBranch}/${filePath.replace(/^\/+/, '')}`;
      const parsed = parseGithubUrl(url);
      const snippet = await fetchRawContent(parsed);
      if (snippet !== undefined) {
        groupRefs.push({ feature: featureName, repo: parsed.repo, path: parsed.path, url: parsed.url, snippet });
      }
    }

    // Fetch group-specific shared files
    for (const fp of config.templates.shared) {
      await fetchGroupFile(fp, '_shared');
    }

    // Fetch per-feature files
    for (const feature of group.features) {
      if (feature.refs?.length) {
        for (const url of feature.refs) {
          const parsed = parseGithubUrl(url);
          const snippet = await fetchRawContent(parsed);
          if (snippet !== undefined) {
            groupRefs.push({ feature: feature.name, repo: parsed.repo, path: parsed.path, url: parsed.url, snippet });
          }
        }
        continue;
      }

      const featureType = feature.type || 'api';
      let templatePaths = config.templates[featureType] ?? [];
      const hasControllerOrService = templatePaths.some(p => p.includes('controller') || p.includes('service'));
      if (!hasControllerOrService) {
        const otherType = featureType === 'api' ? 'file' : 'api';
        templatePaths = [...templatePaths, ...(config.templates[otherType] ?? [])];
      }

      // Filter controllers based on feature type (API vs File Upload) and card scheme for Transaction group
      templatePaths = templatePaths.filter(p => {
        // ── Transaction Group ──────────────────────────────────────────────
        if (p.endsWith('transaction.controller.ts') || p.endsWith('transaction-v2.controller.ts')) {
          if (featureType !== 'api') {
            // File-upload type: neither V1 nor V2 api controllers needed here
            return false;
          }
          // API type: pick controller based on card scheme
          // VISA Only (or no scheme)  → V1 (transaction.controller.ts)
          // MC Only | MC and VISA     → V2 (transaction-v2.controller.ts)
          const scheme = (feature as any).scheme as string | undefined;
          const isMcScheme = scheme === 'MC' || scheme === 'MC and VISA';
          if (p.endsWith('transaction.controller.ts')) {
            return !isMcScheme; // keep V1 only for VISA / no-scheme
          }
          if (p.endsWith('transaction-v2.controller.ts')) {
            return isMcScheme; // keep V2 only for MC / MC and VISA
          }
        }

        // ── Enrollment Group ───────────────────────────────────────────────
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
        logger.log(`Auto-resolving ${templatePaths.length} refs for group ${group.id} feature "${feature.name}"${schemeTag} → [${templatePaths.map(p => p.split('/').pop()).join(', ')}]`);
        for (const fp of templatePaths) {
          await fetchGroupFile(fp, feature.name);
        }
        continue;
      }

      if (!groupOctokit || !treeOwner) continue;
      try {
        const q = `${feature.name} org:${treeOwner} repo:${treeRepo} extension:ts`;
        const { data } = await groupOctokit.search.code({ q, per_page: 1 });
        const top = data.items?.[0];
        if (top) {
          const parsed = parseGithubUrl(top.html_url);
          const snippet = await fetchRawContent(parsed);
          if (snippet !== undefined) {
            groupRefs.push({
              feature: feature.name,
              repo: top.repository.full_name,
              path: top.path,
              url: top.html_url,
              snippet,
            });
          }
        }
      } catch (_err) { /* ignore search error */ }
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

  try {
    const debugContent = state.github_refs.map(r => `/* ===== SOURCE: ${r.url} ===== */\n${r.snippet}`).join('\n\n');
    const debugPath = path.join(process.cwd(), 'github_snippets_debug.txt');
    fs.writeFileSync(debugPath, debugContent, 'utf-8');
  } catch (err) {
    logger.warn('Failed to write debug snippet file: ' + (err as Error).message);
  }

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

/**
 * Fetch raw file content from raw.githubusercontent.com.
 * Uses GITHUB_TOKEN for private repos if available.
 * Returns undefined on failure (private repo, 404, network error).
 */
async function fetchRawContent(
  parsed: ReturnType<typeof parseGithubUrl>,
): Promise<string | undefined> {
  if (!parsed.owner || !parsed.repoName || !parsed.path) return undefined;
  // Use the official GitHub API to fetch raw contents, which handles fine-grained PATs properly
  const apiUrl = `https://api.github.com/repos/${parsed.owner}/${parsed.repoName}/contents/${parsed.path}`;

  const headers: Record<string, string> = {
    'Accept': 'application/vnd.github.v3.raw'
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
      params: { ref: parsed.branch } // Ensure we get from the correct branch
    });
    let content = typeof data === 'string' ? data : JSON.stringify(data);
    if (content.length > MAX_SNIPPET_SIZE) {
      content = content.slice(0, MAX_SNIPPET_SIZE) + '\n// ... truncated (50KB limit) ...';
    }
    return content;
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
