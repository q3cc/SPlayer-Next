import Foundation
import UIKit
import Tauri

private struct DownloadRequest: Decodable {
  let url: String
  let size: Int64
  let digest: String?
}

final class IpaUpdatePlugin: Plugin {
  private var downloadTask: IpaDownload?
  private var downloaded: URL?

  @objc func download(_ invoke: Invoke) throws {
    let request = try invoke.parseArgs(DownloadRequest.self)
    DispatchQueue.main.async {
      guard self.downloadTask == nil else { invoke.reject("已有 IPA 下载任务"); return }
      guard let url = URL(string: request.url), url.scheme == "https", url.host == "github.com",
            url.path.hasPrefix("/q3cc/SPlayer-Next-ios/releases/download/"), url.path.hasSuffix(".ipa")
      else { invoke.reject("仅允许下载当前仓库的 IPA"); return }
      let root = FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask)[0]
        .appendingPathComponent("IpaUpdates", isDirectory: true)
      let folder = root.appendingPathComponent(UUID().uuidString, isDirectory: true)
      let task = IpaDownload(url: url, size: request.size, digest: request.digest, directory: folder,
        progress: { received, total, speed in
          DispatchQueue.main.async {
            self.trigger("progress", data: ["percent": Double(received) / Double(total) * 100,
              "downloadedBytes": received, "totalBytes": total, "bytesPerSecond": speed])
          }
        }, completion: { result in
          if case .success = result {
            // 缓存仅保留本次完整 IPA，不累积跨启动留下的更新包。
            for old in (try? FileManager.default.contentsOfDirectory(at: root, includingPropertiesForKeys: nil)) ?? [] {
              if old != folder, UUID(uuidString: old.lastPathComponent) != nil {
                try? FileManager.default.removeItem(at: old)
              }
            }
          }
          DispatchQueue.main.async {
            self.downloadTask = nil
            switch result {
            case .success(let file):
              self.downloaded = file
              invoke.resolve()
            case .failure(let error): invoke.reject(error.localizedDescription)
            }
          }
        })
      self.downloadTask = task
      task.start()
    }
  }

  @objc func share(_ invoke: Invoke) {
    DispatchQueue.main.async {
      guard let file = self.downloaded, FileManager.default.fileExists(atPath: file.path) else {
        invoke.reject("请先下载 IPA"); return
      }
      guard UIApplication.shared.applicationState == .active,
            var presenter = self.webView?.window?.rootViewController else {
        invoke.reject("请返回 App 后选择其他 App 打开"); return
      }
      while let next = presenter.presentedViewController { presenter = next }
      guard !(presenter is UIActivityViewController) else { invoke.resolve(); return }
      let sheet = UIActivityViewController(activityItems: [file], applicationActivities: nil)
      if let popover = sheet.popoverPresentationController {
        popover.sourceView = presenter.view
        popover.sourceRect = CGRect(x: presenter.view.bounds.midX, y: presenter.view.bounds.midY, width: 1, height: 1)
        popover.permittedArrowDirections = []
      }
      presenter.present(sheet, animated: true) { invoke.resolve() }
    }
  }
}

@_cdecl("init_plugin_ipa_update")
func initIpaUpdatePlugin() -> Plugin { IpaUpdatePlugin() }
