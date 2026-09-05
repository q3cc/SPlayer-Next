// eslint-disable-next-line @typescript-eslint/no-require-imports -- github-script 使用 CommonJS 加载发布脚本。
const fs = require("node:fs");

/** 先上传带提交号的附件，再更新通道指针，避免新旧构建混用。 */
module.exports = async ({ github, context }) => {
  const { owner, repo } = context.repo;
  const commit = context.sha;
  const branch = await github.rest.repos.getBranch({ owner, repo, branch: "main" });
  if (branch.data.commit.sha !== commit) {
    console.log("跳过旧提交，Action 通道等待 main 的新构建。");
    return;
  }
  const tag = "action-latest";
  let release;
  try {
    release = (await github.rest.repos.getReleaseByTag({ owner, repo, tag })).data;
  } catch (error) {
    if (error.status !== 404) throw error;
    release = (
      await github.rest.repos.createRelease({
        owner,
        repo,
        tag_name: tag,
        target_commitish: commit,
        name: "Action 构建版",
        prerelease: true,
        make_latest: "false",
        body: "首个 Action 构建正在上传。",
      })
    ).data;
  }
  const name = `SPlayer-Next-iOS-${commit.slice(0, 7)}.ipa`;
  const existing = release.assets.find((asset) => asset.name === name);
  if (!existing) {
    await github.rest.repos.uploadReleaseAsset({
      owner,
      repo,
      release_id: release.id,
      name,
      data: fs.readFileSync("SPlayer-Next-iOS-unsigned.ipa"),
      headers: { "content-type": "application/octet-stream" },
    });
  }
  const details = await github.rest.repos.getCommit({ owner, repo, ref: commit });
  const metadata = {
    commit,
    version: JSON.parse(fs.readFileSync("package.json", "utf8")).version,
    date: details.data.commit.committer.date,
    asset: name,
  };
  await github.rest.repos.updateRelease({
    owner,
    repo,
    release_id: release.id,
    prerelease: true,
    make_latest: "false",
    name: `Action 构建版 · ${commit.slice(0, 7)}`,
    body: `<!-- splayer-action:${JSON.stringify(metadata)} -->\nmain 分支的开发构建，可能存在未验证的问题。\n\n提交：${commit}\n${details.data.commit.message.split("\n")[0]}\n\n下载 IPA 后使用签名工具安装。`,
  });
  await github.rest.git.updateRef({ owner, repo, ref: `tags/${tag}`, sha: commit, force: true });
  for (const asset of release.assets) {
    if (asset.name !== name && /^SPlayer-Next-iOS-[a-f0-9]{7}\.ipa$/.test(asset.name)) {
      await github.rest.repos.deleteReleaseAsset({ owner, repo, asset_id: asset.id });
    }
  }
};
