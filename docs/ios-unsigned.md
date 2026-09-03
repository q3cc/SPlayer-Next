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
