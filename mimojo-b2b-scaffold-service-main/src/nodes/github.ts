import { Octokit } from "@octokit/rest";
import { PipelineState } from "../state";

export async function githubPush(state: PipelineState): Promise<{ repo_url: string }> {
  const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });
  const owner = process.env.GITHUB_OWNER!;
  const repoName = state.projectName;

  // Create repo (idempotent — ignore "already exists")
  let htmlUrl: string;
  try {
    const repo = await octokit.repos.createForAuthenticatedUser({
      name: repoName,
      auto_init: true,
      private: true,
    });
    htmlUrl = repo.data.html_url;
  } catch (err: any) {
    if (err.status !== 422) throw err;
    const repo = await octokit.repos.get({ owner, repo: repoName });
    htmlUrl = repo.data.html_url;
  }

  const allFiles: Record<string, string> = {
    ...(state.code_files ?? {}),
    "docs/architecture.md": state.diagrams ?? "",
    "docs/api.md": state.api_docs ?? "",
    "docs/README.md": state.project_docs ?? "",
    "db/schema.sql": state.db_schema ?? "",
  };

  for (const [path, content] of Object.entries(allFiles)) {
    if (!content) continue;
    // Get existing sha if file exists (required for update)
    let sha: string | undefined;
    try {
      const existing = await octokit.repos.getContent({ owner, repo: repoName, path });
      if (!Array.isArray(existing.data) && "sha" in existing.data) sha = existing.data.sha;
    } catch (_) { /* file doesn't exist yet */ }

    await octokit.repos.createOrUpdateFileContents({
      owner,
      repo: repoName,
      path,
      message: `chore: add ${path}`,
      content: Buffer.from(content).toString("base64"),
      sha,
    });
  }

  return { repo_url: htmlUrl };
}
