<div align="center">

<img alt="SPlayer-Next logo" width="120" height="120" src="public/icons/favicon.png" />

<h1>SPlayer Next · iOS / iPadOS</h1>

让 SPlayer Next 在 iPhone 和 iPad 上运行。

[下载 IPA](https://github.com/q3cc/SPlayer-Next-ios/releases/latest) · [反馈问题](https://github.com/q3cc/SPlayer-Next-ios/issues) · [原项目](https://github.com/SPlayer-Dev/SPlayer-Next)

</div>

这是 [SPlayer-Dev/SPlayer-Next](https://github.com/SPlayer-Dev/SPlayer-Next) 的 iOS / iPadOS 适配版，由 q3cc 维护。使用 Tauri 打包，复用上游的 Vue 界面、音乐平台接口和歌词逻辑，不是上游官方发行版。桌面版请到原项目下载。

## 快速开始

需要 iOS / iPadOS 16 或更高版本，以及自己的签名工具和证书。

1. 从 [Releases](https://github.com/q3cc/SPlayer-Next-ios/releases/latest) 下载未签名 IPA，签名后安装。
2. 首次打开完成引导，登录网易云账号，或在曲库中添加音乐文件夹。
3. 播放歌曲后，可在“设置 → 桌面歌词”开启歌词小窗。

开发中的安装包在 [Actions](https://github.com/q3cc/SPlayer-Next-ios/actions/workflows/ios-unsigned.yml) 的成功构建页面底部，下载 Artifacts 并解压即可得到 IPA。

## 特性

- 📱 iPhone 紧凑布局，iPad 宽横屏复用桌面布局；适配安全区、窗口缩放和前台调度的顶部按钮区域。
- 🎵 网易云扫码登录、歌单和推荐，登录状态可保留。
- 📂 调用系统文件夹选择器，把音乐复制到应用曲库，不修改原目录。
- 🎧 后台播放、锁屏和控制中心操作，封面优先使用来源提供的原图。
- 💬 桌面歌词小窗支持单 / 双行、逐字高亮、音译和翻译；可调字号、颜色，并实时预览。唱片随播放旋转。
- 📝 系统动态歌词可把当前歌词显示为媒体卡片标题，歌曲名和歌手显示为副标题；歌词结束后保留 3 秒，无新句时恢复歌曲信息。默认关闭。
- 🛠️ 可选诊断日志，默认关闭，文件可在系统“文件”App 中分享。

## 常见问题

### IPA 为什么不能直接安装？

提供的是未签名 IPA，需要自行签名。不能在“文件”App 中点一下直接安装，也没有 App Store 下载入口。

### 为什么安装包比桌面版小？

iOS 使用系统 WebView 播放音频，不包含桌面版的 Electron 和 FFmpeg 音频引擎。因此体积和音频格式兼容性都与桌面版不同。

### 导入文件夹后，原来的音乐会被移动吗？

不会。音乐会复制到应用的 `Documents/Imported Music`，原目录不变；原目录后续增删不会自动同步。

### 桌面歌词在哪里？关闭小窗会暂停吗？

在“设置 → 桌面歌词”开启，也可从播放器的歌词入口打开。小窗可拖动、缩放，关闭不影响音乐播放。有音译或翻译时，显示当前句和附加歌词。

### 登录或播放异常，怎么提供日志？

在“设置 → 通用 → 调试”打开“日志记录”，再复现问题。开关立即生效；之后启动应用时会按已保存的开关状态记录，不能补回开启前的日志。

到“文件”App →“我的 iPhone / iPad”→“SPlayer Next”→“logs”分享对应文件，文件名是本次启动时间。关闭开关后停止写入，已有文件不会删除，可手动清理。不要误删旁边的 `Imported Music`。

前端日志会隐藏 Cookie、令牌等凭据，不记录请求体；分享前仍请检查个人信息。反馈时附设备型号、系统版本、安装包版本和复现步骤，界面问题请加截图。

### 正式版是否代表所有上游功能都支持？

不代表。上游的 Windows 任务栏、桌面插件等功能不等于在 iOS 可用。网易云登录曾有偶发失败，虽已有实机成功登录和保留登录态的记录，仍未覆盖所有设备和网络环境。

当前 Actions 跳过模拟器冒烟测试；编译和自动测试通过不代表全部功能已通过实机验证。

## 自行构建

本地构建需要 macOS、Xcode、Rust iOS target、Node.js 22.19.0 或更高版本，以及项目指定的 pnpm。

```bash
git clone https://github.com/q3cc/SPlayer-Next-ios.git
cd SPlayer-Next-ios
git switch main
pnpm install --frozen-lockfile
pnpm ios:init
pnpm ios:build --ci --no-sign
```

前端检查使用 `pnpm mobile:build`，实机开发使用 `pnpm ios:dev`。本分支含 Tauri 插件补丁，请保留 `pnpm-workspace.yaml`、`pnpm-lock.yaml` 和 `patches/`。详见 [iOS 构建文档](docs/ios-unsigned.md)。

## 来源与许可

原播放器由 [SPlayer-Dev](https://github.com/SPlayer-Dev) 及其贡献者开发，是 [SPlayer](https://github.com/SPlayer-Dev/SPlayer) 的继任版本。本仓库保留原作者署名和版权信息。

使用的开源项目包括 [applemusic-like-lyrics](https://github.com/Steve-xmh/applemusic-like-lyrics)、[NeteaseCloudMusicApiEnhanced](https://github.com/neteasecloudmusicapienhanced/api-enhanced)、[Tauri](https://github.com/tauri-apps/tauri) 及其[官方插件](https://github.com/tauri-apps/plugins-workspace)。

项目沿用上游的 AGPL-3.0，详见 [LICENSE](LICENSE)。分发修改版时应保留原作者及版权声明，并遵守许可中的源码提供要求。原项目的使用声明见[上游 README](https://github.com/SPlayer-Dev/SPlayer-Next/blob/dev/README.zh-CN.md)。

## 免责声明

沿用原项目声明：本项目仅供个人学习与研究使用，禁止用于商业及非法用途。部分功能依赖第三方 API，使用者须自行确保其使用符合相关法律法规及服务协议。对于因使用本项目而产生的任何直接或间接后果，作者不承担任何责任。
