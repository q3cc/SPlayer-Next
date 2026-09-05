// swift-tools-version:5.10
import PackageDescription

let package = Package(
  name: "tauri-plugin-native-audio",
  platforms: [.iOS(.v16)],
  products: [.library(name: "tauri-plugin-native-audio", type: .static, targets: ["tauri-plugin-native-audio"])],
  dependencies: [
    .package(name: "Tauri", path: "../.tauri/tauri-api"),
    .package(url: "https://github.com/dimitris-c/AudioStreaming.git", revision: "cc972c0a001e401cba266d507f62f0eb7a1740b5")
  ],
  targets: [.target(name: "tauri-plugin-native-audio", dependencies: [
    .byName(name: "Tauri"), .product(name: "AudioStreaming", package: "AudioStreaming")
  ], path: "Sources")]
)
