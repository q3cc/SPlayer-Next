// swift-tools-version:5.3
import PackageDescription

let package = Package(
  name: "tauri-plugin-lyric-pip",
  platforms: [.iOS(.v14)],
  products: [.library(name: "tauri-plugin-lyric-pip", type: .static, targets: ["tauri-plugin-lyric-pip"])],
  dependencies: [.package(name: "Tauri", path: "../.tauri/tauri-api")],
  targets: [.target(name: "tauri-plugin-lyric-pip", dependencies: [.byName(name: "Tauri")], path: "Sources")]
)
