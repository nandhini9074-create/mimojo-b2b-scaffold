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

    const octokit = new Octokit({ auth: token });

    let htmlUrl = '';
    let owner = '';

    try {
      // Get the authenticated username once
      const user = await octokit.users.getAuthenticated();
      owner = user.data.login;

      const repo = await octokit.repos.createForAuthenticatedUser({
        name: repoName,
        auto_init: true,
        private: true,
      });
      htmlUrl = repo.data.html_url;
    } catch (err: any) {
      if (err.status === 422) {
        // If the repository already exists, fetch it directly
        const repo = await octokit.repos.get({ owner, repo: repoName });
        htmlUrl = repo.data.html_url;
      } else {
        throw err;
      }
    }

    const allFiles: Record<string, string> = {
      ...(group.output.code_files ?? {}),
      "docs/architecture.md": group.output.diagrams ?? "",
      "docs/api.md": group.output.api_docs ?? "",
      "docs/README.md": group.output.project_docs ?? "",
      "db/schema.sql": group.output.db_schema ?? "",
    };

    try {
      // 1. Retrieve the repository's default branch (usually 'main')
      const repoInfo = await octokit.repos.get({ owner, repo: repoName });
      const defaultBranch = repoInfo.data.default_branch || 'main';

      // 2. Get the latest commit SHA on the default branch
      const ref = await octokit.git.getRef({ owner, repo: repoName, ref: `heads/${defaultBranch}` });
      const latestCommitSha = ref.data.object.sha;

      // 3. Get the tree SHA associated with the latest commit
      const commit = await octokit.git.getCommit({ owner, repo: repoName, commit_sha: latestCommitSha });
      const baseTreeSha = commit.data.tree.sha;

      // 4. Map files to tree items
      const treeItems = Object.entries(allFiles)
        .filter(([_, content]) => !!content)
        .map(([path, content]) => ({
          path,
          mode: '100644' as const, // standard file mode
          type: 'blob' as const,
          content, // sends raw text content directly
        }));

      // 5. Create a new git tree based on the previous tree
      const newTree = await octokit.git.createTree({
        owner,
        repo: repoName,
        base_tree: baseTreeSha,
        tree: treeItems,
      });

      const commitMessage = state.refinements?.length
        ? `chore: apply feedback - ${state.refinements[state.refinements.length - 1].feedback}`
        : 'chore: scaffold codebase';

      // 6. Create the single commit pointing to the new tree
      const newCommit = await octokit.git.createCommit({
        owner,
        repo: repoName,
        message: commitMessage,
        tree: newTree.data.sha,
        parents: [latestCommitSha],
      });

      // 7. Point the branch head reference to the new commit
      await octokit.git.updateRef({
        owner,
        repo: repoName,
        ref: `heads/${defaultBranch}`,
        sha: newCommit.data.sha,
        force: true,
      });

      logger.log(`Successfully committed all files in a single commit to ${repoName}`);
    } catch (err: any) {
      logger.error(`Failed to execute multi-file commit on GitHub: ${err.message}`, err.stack);
      throw err;
    }

    logger.log(`githubPush for group "${group.id}" completed in ${Date.now() - started}ms. URL: ${htmlUrl}`);
    group.output.repo_url = htmlUrl;
  }

  state.repo_url = state.template_groups[0]?.output.repo_url;

  const elapsed = Date.now() - totalStarted;
  logger.log(`githubPush completed in ${elapsed}ms`);

  return { repo_url: state.repo_url || "" };
}
