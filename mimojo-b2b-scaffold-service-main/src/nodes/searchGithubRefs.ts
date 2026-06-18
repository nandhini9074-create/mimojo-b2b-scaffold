import { Octokit } from "@octokit/rest";
import { GithubRef, PipelineState } from "../state";

/**
 * Build the github_refs[] used by every downstream stage.
 *
 * For each feature:
 *  1. Use any user-supplied URLs verbatim (parsed into GithubRef shape).
 *  2. If none supplied AND GITHUB_TOKEN+GITHUB_OWNER set, search the org
 *     for a top match.
 */
export async function searchGithubRefs(state: PipelineState): Promise<GithubRef[]> {
  const token = process.env.GITHUB_TOKEN;
  const owner = process.env.GITHUB_OWNER;
  const refs: GithubRef[] = [];
  const octokit = token ? new Octokit({ auth: token }) : null;

  for (const feature of state.features) {
    // 1) explicit user-supplied URLs
    if (feature.refs?.length) {
      for (const url of feature.refs) {
        refs.push({ feature: feature.name, ...parseGithubUrl(url) });
      }
      continue;
    }

    // 2) auto-discover via GitHub code search
    if (!octokit || !owner) continue;
    try {
      const q = `${feature.name} org:${owner} extension:ts`;
      const { data } = await octokit.search.code({ q, per_page: 1 });
      const top = data.items?.[0];
      if (top) {
        refs.push({
          feature: feature.name,
          repo: top.repository.full_name,
          path: top.path,
          url: top.html_url,
        });
      }
    } catch (_err) { /* rate-limit etc. — skip */ }
  }

  return refs;
}

/** Parse a github.com/<owner>/<repo>/blob/<branch>/<path> URL. */
function parseGithubUrl(url: string): { repo: string; path: string; url: string } {
  try {
    const u = new URL(url);
    const parts = u.pathname.split('/').filter(Boolean); // [owner, repo, blob|tree, branch, ...path]
    const owner = parts[0];
    const repo = parts[1];
    const path = parts.slice(4).join('/');
    return { repo: owner && repo ? `${owner}/${repo}` : url, path, url };
  } catch {
    return { repo: '', path: '', url };
  }
}
