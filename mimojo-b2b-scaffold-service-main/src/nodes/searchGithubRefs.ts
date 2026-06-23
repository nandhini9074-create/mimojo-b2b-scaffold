import { Octokit } from "@octokit/rest";
import axios from "axios";
import * as fs from "fs";
import * as path from "path";
import { GithubRef, PipelineState } from "../state";
import { scaffoldTemplatesConfig } from "../config/scaffold-templates.config";

const MAX_SNIPPET_SIZE = 50_000; // 50KB cap to prevent blowing AI context

/**
 * Build the github_refs[] used by every downstream stage.
 *
 * For each feature:
 *  1. Use any user-supplied URLs verbatim (parsed into GithubRef shape).
 *     Fetches raw file content from raw.githubusercontent.com.
 *  2. If no refs supplied, auto-resolve from the centralized template
 *     config based on the feature's type (api | file).
 *  3. If still empty AND GITHUB_TOKEN+GITHUB_OWNER set, search the org
 *     for a top match and fetch its content.
 *
 * Also fetches the full directory tree of the first referenced repo
 * and stores it in state.repo_tree so downstream stages can mirror
 * the exact folder structure.
 */
export async function searchGithubRefs(state: PipelineState): Promise<GithubRef[]> {
  const token = process.env.GITHUB_TOKEN;
  const owner = process.env.GITHUB_OWNER;
  const refs: GithubRef[] = [];
  const octokit = token ? new Octokit({ auth: token }) : null;
  let treeOwner = '';
  let treeRepo = '';
  let treeBranch = 'main';

  const configBranch = scaffoldTemplatesConfig.branch || 'main';
  const configRepoUrl = scaffoldTemplatesConfig.repoUrl.replace(/\/+$/, '');

  /** Tracks paths already fetched to avoid duplicate GitHub API calls. */
  const fetchedPaths = new Set<string>();

  /**
   * Helper: build a blob URL from a config file path, fetch its content,
   * and push a GithubRef. Skips if the path was already fetched.
   */
  async function fetchConfigFile(filePath: string, featureName: string) {
    if (fetchedPaths.has(filePath)) return;
    fetchedPaths.add(filePath);

    const url = `${configRepoUrl}/blob/${configBranch}/${filePath.replace(/^\/+/, '')}`;
    const parsed = parseGithubUrl(url);
    const snippet = await fetchRawContent(parsed);
    refs.push({ feature: featureName, repo: parsed.repo, path: parsed.path, url: parsed.url, snippet });

    if (!treeOwner && parsed.owner) {
      treeOwner = parsed.owner;
      treeRepo = parsed.repoName;
      treeBranch = parsed.branch;
    }
  }

  // ── Step 0: Fetch shared template files (once for the entire run) ──
  const sharedPaths = scaffoldTemplatesConfig.templates.shared ?? [];
  if (sharedPaths.length) {
    console.log(`[searchGithubRefs] Fetching ${sharedPaths.length} shared template files...`);
    for (const fp of sharedPaths) {
      await fetchConfigFile(fp, '_shared');
    }
  }

  // ── Per-feature resolution ──
  for (const feature of state.features) {
    // 1) explicit user-supplied URLs
    if (feature.refs?.length) {
      for (const url of feature.refs) {
        const parsed = parseGithubUrl(url);
        const snippet = await fetchRawContent(parsed);
        refs.push({ feature: feature.name, repo: parsed.repo, path: parsed.path, url: parsed.url, snippet });
        if (!treeOwner && parsed.owner) {
          treeOwner = parsed.owner;
          treeRepo = parsed.repoName;
          treeBranch = parsed.branch;
        }
      }
      continue;
    }

    // 2) auto-resolve type-specific files from centralized template config
    const featureType = feature.type || 'api';
    const templatePaths = scaffoldTemplatesConfig.templates[featureType] ?? [];
    if (templatePaths.length) {
      console.log(`[searchGithubRefs] Auto-resolving ${templatePaths.length} refs for feature "${feature.name}" (type=${featureType})`);
      for (const fp of templatePaths) {
        await fetchConfigFile(fp, feature.name);
      }
      continue;
    }

    // 3) fallback: auto-discover via GitHub code search
    if (!octokit || !owner) continue;
    try {
      const q = `${feature.name} org:${owner} extension:ts`;
      const { data } = await octokit.search.code({ q, per_page: 1 });
      const top = data.items?.[0];
      if (top) {
        const parsed = parseGithubUrl(top.html_url);
        const snippet = await fetchRawContent(parsed);
        refs.push({
          feature: feature.name,
          repo: top.repository.full_name,
          path: top.path,
          url: top.html_url,
          snippet,
        });
        if (!treeOwner && parsed.owner) {
          treeOwner = parsed.owner;
          treeRepo = parsed.repoName;
          treeBranch = parsed.branch;
        }
      }
    } catch (_err) { /* rate-limit etc. — skip */ }
  }

  // Fetch the full directory tree of the reference repo
  if (treeOwner && treeRepo) {
    state.repo_tree = await fetchRepoTree(treeOwner, treeRepo, treeBranch);
  }

  console.log(`[searchGithubRefs] Total refs fetched: ${refs.length} (${fetchedPaths.size} unique paths)`);

  try {
    const debugContent = refs.map(r => `/* ===== SOURCE: ${r.url} ===== */\n${r.snippet}`).join('\n\n');
    const debugPath = path.join(process.cwd(), 'github_snippets_debug.txt');
    fs.writeFileSync(debugPath, debugContent, 'utf-8');
  } catch (err) {
    console.warn('[searchGithubRefs] Failed to write debug snippet file:', (err as Error).message);
  }

  return refs;
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
    const token = process.env.GITHUB_TOKEN;
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
    console.warn(`[searchGithubRefs] Failed to fetch repo tree for ${owner}/${repo}:`, (err as Error).message);
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
  if (process.env.GITHUB_TOKEN) {
    headers['Authorization'] = `token ${process.env.GITHUB_TOKEN}`;
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
    console.warn(`[searchGithubRefs] Failed to fetch raw content for ${apiUrl}:`, (err as Error).message);
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
