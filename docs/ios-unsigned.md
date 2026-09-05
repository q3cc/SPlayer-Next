# iOS / iPadOS 未签名构建

仓库的 `Build unsigned iOS IPA` 工作流在 GitHub 托管的 macOS runner 上调用 Tauri 官方 `ios build --no-sign` 流程，生成 iOS 工程、使用设备 SDK 编译，并上传 `SPlayer-Next-iOS-unsigned.ipa`。

## 获取构建

1. 打开仓库的 **Actions** 页面。
2. 选择 **Build unsigned iOS IPA**。
3. 点击 **Run workflow**，或等待 `feat/ios-ipados` 分支推送后自动构建。
4. 在成功的运行页面下载 `SPlayer-Next-iOS-unsigned-<commit>` artifact。

该 IPA 不含 Apple 签名，不能直接从系统文件应用安装。实机测试前需使用个人或开发者证书重新签名；iPhone 和 iPad 的最低系统版本为 iOS/iPadOS 16。

## 本地开发要求

本地调试需要 macOS、Xcode、Rust iOS target、Node.js 22 和 pnpm。首次生成工程后可运行：

```bash
pnpm install
pnpm ios:init
pnpm ios:dev
```

移动端前端也可单独执行 `pnpm mobile:build` 做静态构建检查。

## 临时诊断日志

临时诊断版在每次原生启动时创建 `Documents/logs/YYYY-MM-DD_HH-mm-ss.SSS+时区.log`（相对于 iOS 应用数据沙盒）。启动一次后，在“文件”App →“浏览”→“我的 iPhone / iPad”→“SPlayer Next”→“logs”中查看、分享或删除日志。开启文稿共享后，已导入的 `Imported Music` 文件夹也会显示；请勿误删正在使用的音乐。

控制台、未处理异常、原生标准输出/错误和登录请求状态写入同一文件；Cookie、二维码密钥、令牌等凭据脱敏，不记录请求体。历史文件不会自动覆盖或删除，旧版 `Library/logs` 文件保持原位。队列过载会记录丢弃数量，操作系统直接杀进程时尚未落盘的最后一批输出可能丢失。分享当前日志前先切回“文件”App；删除日志建议先结束 SPlayer 进程。

## 动态歌词

在设置的服务与集成页面打开“系统媒体控制”和“动态歌词”。默认关闭动态歌词。
当前时间落在歌词行内时，锁屏和控制中心标题显示该行歌词，副标题显示“歌曲名 - 歌手”。
歌词结束后保留 3 秒，期间有新歌词立即替换，否则恢复歌曲信息。前奏尚无歌词或没有可用歌词时直接显示歌曲信息；关闭开关立即恢复，无需重新播放。
复用应用当前选择的歌词及偏移，仅随音频进度事件更新变化的行，不修改应用内歌曲信息。

## 添加文件夹

点击“添加文件夹”打开 iOS 系统目录选择器。选定目录会导入应用 Documents/Imported Music，
原目录不修改；导入的是副本，原目录之后的变化不会自动同步。
系统目录选择在官方 dialog 插件的本地补丁中实现，曲库仍使用公共添加和扫描接口。
