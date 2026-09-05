import Foundation

let url = URL(string: CommandLine.arguments[1])!
let size = Int64(CommandLine.arguments[2])!
let digest = CommandLine.arguments[3]
let directory = URL(fileURLWithPath: CommandLine.arguments[4], isDirectory: true)
let done = DispatchSemaphore(value: 0)
var success = false
let task = IpaDownload(url: url, size: size, digest: digest, directory: directory,
  progress: { received, total, speed in
    print("progress \(received) \(total) \(speed)")
  }, completion: { result in
    switch result {
    case .success(let file): print("saved \(file.path)"); success = true
    case .failure(let error): print("error \(error.localizedDescription)")
    }
    done.signal()
  })
task.start()
guard done.wait(timeout: .now() + 30) == .success else { exit(2) }
exit(success ? 0 : 1)
