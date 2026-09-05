<div align="center">

<img alt="SPlayer-Next logo" width="120" height="120" src="public/icons/favicon.png" />

<h1>SPlayer Next · iOS / iPadOS</h1>

<p>让 SPlayer Next 在 iPhone 和 iPad 上运行。</p>

[下载 IPA](https://github.com/q3cc/SPlayer-Next/releases) · [构建记录](https://github.com/q3cc/SPlayer-Next/actions/workflows/ios-unsigned.yml) · [反馈问题](https://github.com/q3cc/SPlayer-Next/issues) · [原项目](https://github.com/SPlayer-Dev/SPlayer-Next)

</div>

## 这个仓库做什么

这是 [SPlayer-Dev/SPlayer-Next](https://github.com/SPlayer-Dev/SPlayer-Next) 的 iOS / iPadOS 适配分支，由 q3cc 维护。原播放器、界面和大部分业务代码来自上游；这个仓库主要处理移动端运行、系统接口和屏幕适配。

客户端使用 Tauri 打包，复用原项目的 Vue 界面、音乐平台接口和歌词逻辑。iOS 播放使用系统 WebView 的音频能力，格式兼容性与桌面版的 FFmpeg 音频引擎不同。

目前提供预览版，适合愿意自行签名安装、协助实机测试的用户。Windows、macOS、Linux 桌面版请前往[原项目](https://github.com/SPlayer-Dev/SPlayer-Next)。

## 下载与安装

要求 iOS / iPadOS 16 或更高版本。

1. 在 [Releases](https://github.com/q3cc/SPlayer-Next/releases) 下载未签名的 `.ipa`。
2. 使用自己的签名工具和证书签名后安装。未签名 IPA 不能直接在“文件”App 中点开安装。
3. 首次打开完成引导，再登录音乐账号或导入本地音乐。

开发中的新包也会上传到 [GitHub Actions](https://github.com/q3cc/SPlayer-Next/actions/workflows/ios-unsigned.yml)。打开成功的构建，在 Artifacts 中下载 `SPlayer-Next-iOS-unsigned-<commit>`，解压后可得到 IPA。

## iOS 适配内容

- 网易云扫码登录、账号资料、歌单与推荐。已有实机日志确认扫码授权成功，重启后登录状态保留；此前偶发失败的原因仍未完全确定。
- iPhone / iPad 界面、安全区与横竖屏布局。iPad 宽横屏复用桌面布局，窄窗口使用紧凑布局；前台调度窗口和顶部系统按钮区域也做了适配。
- 系统文件夹选择器。选择音乐文件夹后，复制到应用的 `Documents/Imported Music` 再导入曲库，不修改原文件夹，也不会自动同步原目录后续的变化。
- 后台音频和锁屏、控制中心播放信息。系统封面优先使用高清图，网易云封面请求 600×600，加载失败时保留缩略图。
- 系统动态歌词。在设置中打开“系统媒体控制”和“动态歌词”，系统卡片标题显示当前歌词，副标题显示“歌曲名 - 歌手”。一句歌词结束后保留 3 秒，没有新歌词才恢复歌曲信息。动态歌词默认关闭。
- 运行日志。在“文件”App →“我的 iPhone / iPad”→“SPlayer Next”→“logs”查看或分享，以启动时间命名。

这些功能已加入代码，但还没有覆盖所有机型、系统版本和音乐格式的实机验证。桌面歌词窗口、Windows 任务栏集成、插件和流媒体服务等上游功能，不代表在 iOS 上全部可用。

## 遇到问题

在[本仓库 Issues](https://github.com/q3cc/SPlayer-Next/issues)提供设备型号、系统版本、安装包对应的提交或发行版，以及复现步骤。界面问题附截图；登录和播放问题附本次启动的日志。

当前版本临时开启详细日志，记录运行错误和登录各阶段状态。Cookie、令牌等凭据会脱敏，不记录请求体；分享前仍请检查是否含有不想公开的信息。历史日志不会自动删除，可以在“文件”App 中清理。导入的音乐也在共享目录中，注意不要误删。

当前 Action 暂时跳过模拟器冒烟测试，构建成功不等于所有功能已通过实机测试。具体构建与诊断说明见 [iOS 构建文档](docs/ios-unsigned.md)。

## 自行构建

GitHub Actions 可直接生成未签名 IPA。本地构建需要 macOS、Xcode、Rust iOS target、Node.js 22.19.0 或更高版本，以及项目指定的 pnpm。

```bash
git clone https://github.com/q3cc/SPlayer-Next.git
cd SPlayer-Next
git switch main
pnpm install --frozen-lockfile
pnpm ios:init
pnpm ios:build --ci --no-sign
```

只检查移动端前端时可运行 `pnpm mobile:build`；实机开发使用 `pnpm ios:dev`。本分支包含官方 Tauri 插件的小范围补丁，安装依赖时请保留 `pnpm-workspace.yaml`、`pnpm-lock.yaml` 和 `patches/`。

## 来源与许可

原项目由 [SPlayer-Dev](https://github.com/SPlayer-Dev) 及其贡献者开发，是 [SPlayer](https://github.com/SPlayer-Dev/SPlayer) 的继任版本。本仓库保留原作者署名和版权信息，iOS 适配不代表上游官方发布。

使用的开源项目包括：

- [applemusic-like-lyrics](https://github.com/Steve-xmh/applemusic-like-lyrics)：歌词显示组件。
- [NeteaseCloudMusicApiEnhanced](https://github.com/neteasecloudmusicapienhanced/api-enhanced)：网易云音乐 API。
- [Tauri](https://github.com/tauri-apps/tauri) 及其[官方插件](https://github.com/tauri-apps/plugins-workspace)：移动端打包与系统接口。

项目沿用上游的 AGPL-3.0 许可，详见 [LICENSE](LICENSE)。分发修改版时应保留原作者及版权声明，并遵守许可中的源码提供要求。原项目的使用声明见[上游 README](https://github.com/SPlayer-Dev/SPlayer-Next/blob/dev/README.zh-CN.md)。

## 免责声明

沿用原项目声明：本项目仅供个人学习与研究使用，禁止用于商业及非法用途。部分功能依赖第三方 API，使用者须自行确保其使用符合相关法律法规及服务协议。对于因使用本项目而产生的任何直接或间接后果，作者不承担任何责任。
