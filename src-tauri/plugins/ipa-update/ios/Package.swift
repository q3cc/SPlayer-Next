// swift-tools-version:5.3
import PackageDescription

let package = Package(
  name: "tauri-plugin-ipa-update",
  platforms: [.iOS(.v14)],
  products: [.library(name: "tauri-plugin-ipa-update", type: .static, targets: ["tauri-plugin-ipa-update"])],
  dependencies: [.package(name: "Tauri", path: "../.tauri/tauri-api")],
  targets: [.target(name: "tauri-plugin-ipa-update", dependencies: [.byName(name: "Tauri")], path: "Sources")]
)
