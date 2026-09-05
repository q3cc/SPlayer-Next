# 移动端目录选择补丁

源包为官方 `tauri-plugin-dialog 2.7.3`，保留原许可证。
下载地址：https://static.crates.io/crates/tauri-plugin-dialog/tauri-plugin-dialog-2.7.3.crate
SHA-256：`61854a36651aa48381e5e209f69a01273b77f3f9f91f0c430b1b98d33bd47229`。

原包的 `open({ directory: true })` 在移动端直接返回 `FolderPickerNotImplemented`。
补丁仍使用同一个 JS/Rust 接口与 UIKit 文件选择器，只补齐 iOS 的 `UTType.folder` 模式、
递归访问范围与错误返回。Android 和桌面行为不变。

应用使用 `fileAccessMode: "copy"`：用户选择的目录由系统授权后导入应用 Documents/Imported Music，
使用 UUID 子目录避免覆盖已有文件，原目录不修改。这样冷启动后无需重新授权，扫描与播放仍走公共曲库。
这属于导入副本，不会自动同步原目录后续变化。上游支持该模式后可移除此补丁。
