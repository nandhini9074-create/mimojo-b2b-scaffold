import { Octokit } from "@octokit/rest";
import { PipelineState } from "../state";
import { Logger } from "@nestjs/common";

const logger = new Logger('githubPush');

export async function githubPush(state: PipelineState): Promise<{ repo_url: string }> {
  logger.log('Starting githubPush...');
  const totalStarted = Date.now();
  if (!state.template_groups || state.template_groups.length === 0) {
    return { repo_url: state.repo_url || "" };
  }

  for (const group of state.template_groups) {
    logger.log(`Starting githubPush for group "${group.id}"...`);
    const started = Date.now();
    group.output = group.output ?? {};
    const repoName = `${state.projectName}-${group.id}`;

    const token = group.id === 'transaction'
      ? (process.env.GITHUB_TOKEN_TRANSACTION || process.env.GITHUB_TOKEN)
      : (process.env.GITHUB_TOKEN_ENROLLMENT || process.env.GITHUB_TOKEN);
    let owner = group.id === 'transaction'
      ? (process.env.GITHUB_OWNER_TRANSACTION || 'nandhini9074-create')
      : (process.env.GITHUB_OWNER_ENROLLMENT || process.env.GITHUB_OWNER || 'nandhini9074-create');

    const octokit = new Octokit({ auth: token });

    // Create repo (idempotent — ignore "already exists")
    let htmlUrl: string = '';

    try {
      let userLogin = '';
      try {
        const user = await octokit.users.getAuthenticated();
        userLogin = user.data.login;
      } catch (_) {}

      if (userLogin && userLogin.toLowerCase() !== owner.toLowerCase()) {
        try {
          const repo = await octokit.repos.createInOrg({
            org: owner,
            name: repoName,
            auto_init: true,
            private: true,
          });
          htmlUrl = repo.data.html_url;
        } catch (orgErr: any) {
          if (orgErr.status === 422) {
            const repo = await octokit.repos.get({ owner, repo: repoName });
            htmlUrl = repo.data.html_url;
          } else {
            logger.warn(`Failed to create repo in org ${owner}, falling back to personal account ${userLogin}`);
            const repo = await octokit.repos.createForAuthenticatedUser({
              name: repoName,
              auto_init: true,
              private: true,
            });
            htmlUrl = repo.data.html_url;
            owner = userLogin; // <--- The crucial fix! 
          }
        }
      } else {
        const repo = await octokit.repos.createForAuthenticatedUser({
          name: repoName,
          auto_init: true,
          private: true,
        });
        htmlUrl = repo.data.html_url;
      }
    } catch (err: any) {
      if (err.status !== 422) throw err;
      const repo = await octokit.repos.get({ owner, repo: repoName });
      htmlUrl = repo.data.html_url;
    }

    const allFiles: Record<string, string> = {
      ...(group.output.code_files ?? {}),
      "docs/architecture.md": group.output.diagrams ?? "",
      "docs/api.md": group.output.api_docs ?? "",
      "docs/README.md": group.output.project_docs ?? "",
      "db/schema.sql": group.output.db_schema ?? "",
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

    logger.log(`githubPush for group "${group.id}" completed in ${Date.now() - started}ms. URL: ${htmlUrl}`);
    group.output.repo_url = htmlUrl;
  }

  state.repo_url = state.template_groups[0]?.output.repo_url;
  
  const elapsed = Date.now() - totalStarted;
  logger.log(`githubPush completed in ${elapsed}ms`);

  return { repo_url: state.repo_url || "" };
}
