import AVFoundation
import AVKit
import Darwin
import Tauri
import UIKit

private struct LyricRow: Decodable {
  let start: Double
  let end: Double
  let text: String
  let translation: String
}

private struct LyricContent: Decodable {
  let title: String
  let artist: String
  let lines: [LyricRow]
  let offset: Double
}

private struct PlaybackAnchor: Decodable {
  let position: Double
  let duration: Double
  let playing: Bool
  let speed: Double
  let timestamp: Double
}

@available(iOS 15.0, *)
class LyricPipPlugin: Plugin, AVPictureInPictureControllerDelegate,
  AVPictureInPictureSampleBufferPlaybackDelegate {
  private let displayLayer = AVSampleBufferDisplayLayer()
  private var sourceView: UIView?
  private var controller: AVPictureInPictureController?
  private var readiness: NSKeyValueObservation?
  private var startTimeout: DispatchWorkItem?
  private var pendingStart: Invoke?
  private var timer: Timer?
  private var content: LyricContent?
  private var position = 0.0
  private var duration = 0.0
  private var playing = false
  private var speed = 1.0
  private var anchorTime = ProcessInfo.processInfo.systemUptime
  private var lastText: [String]?
  private var cachedFrame: CVPixelBuffer?
  private var lastFrameTime = -Double.infinity
  private var frameCount = 0
  private var lastRenderError: String?

  private var displayReadiness: String {
    if #available(iOS 17.4, *) { return String(displayLayer.isReadyForDisplay) }
    return "unavailable-before-ios-17.4"
  }

  @objc public func status(_ invoke: Invoke) {
    invoke.resolve(["active": controller?.isPictureInPictureActive ?? false])
  }

  @objc public func update(_ invoke: Invoke) throws {
    let next = try invoke.parseArgs(LyricContent.self)
    DispatchQueue.main.async {
      self.content = next
      self.render()
      invoke.resolve()
    }
  }

  @objc public func sync(_ invoke: Invoke) throws {
    let next = try invoke.parseArgs(PlaybackAnchor.self)
    DispatchQueue.main.async {
      let delay = max(0, Date().timeIntervalSince1970 * 1000 - next.timestamp)
      self.position = next.position + (next.playing ? delay * next.speed : 0)
      self.duration = next.duration
      self.playing = next.playing
      self.speed = next.speed
      self.anchorTime = ProcessInfo.processInfo.systemUptime
      self.controller?.invalidatePlaybackState()
      self.updateTimer()
      self.render()
      invoke.resolve()
    }
  }

  @objc public func start(_ invoke: Invoke) {
    DispatchQueue.main.async {
      guard AVPictureInPictureController.isPictureInPictureSupported() else {
        invoke.reject("此设备不支持歌词画中画")
        return
      }
      guard self.pendingStart == nil, self.controller == nil else {
        invoke.reject("歌词小窗已开启或正在启动")
        return
      }
      guard let parent = self.manager.viewController?.view else {
        invoke.reject("应用窗口尚未准备好")
        return
      }
      self.pendingStart = invoke
      let view = UIView(frame: CGRect(
        x: max(0, parent.bounds.width - 252),
        y: max(0, parent.bounds.height - parent.safeAreaInsets.bottom - 225),
        width: 240, height: 135))
      view.isUserInteractionEnabled = false
      view.autoresizingMask = [.flexibleLeftMargin, .flexibleTopMargin]
      view.layer.addSublayer(self.displayLayer)
      self.displayLayer.frame = view.bounds
      self.displayLayer.videoGravity = .resizeAspect
      parent.addSubview(view)
      self.sourceView = view
      let source = AVPictureInPictureController.ContentSource(
        sampleBufferDisplayLayer: self.displayLayer, playbackDelegate: self)
      let pip = AVPictureInPictureController(contentSource: source)
      pip.delegate = self
      pip.requiresLinearPlayback = true
      pip.canStartPictureInPictureAutomaticallyFromInline = false
      self.controller = pip
      self.lastText = nil
      self.frameCount = 0
      self.lastFrameTime = -.infinity
      self.render()
      self.updateTimer()
      self.readiness = pip.observe(\.isPictureInPicturePossible, options: [.initial, .new]) {
        [weak self] pip, _ in
        DispatchQueue.main.async {
          guard let self = self, self.pendingStart != nil,
            self.controller === pip, pip.isPictureInPicturePossible else { return }
          self.readiness = nil
          pip.startPictureInPicture()
        }
      }
      let timeout = DispatchWorkItem { [weak self] in
        guard let self = self, self.pendingStart != nil else { return }
        self.fail("系统未能开启歌词画中画，请先播放歌曲后重试")
      }
      self.startTimeout = timeout
      DispatchQueue.main.asyncAfter(deadline: .now() + 8, execute: timeout)
    }
  }

  @objc public func stop(_ invoke: Invoke) {
    DispatchQueue.main.async {
      if self.controller?.isPictureInPictureActive == true {
        self.controller?.stopPictureInPicture()
      } else {
        self.pendingStart?.reject("已取消开启歌词小窗")
        self.pendingStart = nil
        self.cleanup()
      }
      invoke.resolve()
    }
  }

  /// 仅窗口启动中或可见时送帧；复用定时器，避免进度推送不断重置首帧重试。
  private func updateTimer() {
    guard controller?.isPictureInPictureActive == true || pendingStart != nil else {
      timer?.invalidate()
      timer = nil
      return
    }
    guard timer == nil else { return }
    timer = Timer.scheduledTimer(withTimeInterval: 0.2, repeats: true) { [weak self] _ in
      self?.render()
    }
    timer?.tolerance = 0.05
  }

  private func currentPosition() -> Double {
    let elapsed = (ProcessInfo.processInfo.systemUptime - anchorTime) * 1000
    let value = position + (playing ? elapsed * speed : 0)
    return duration > 0 ? min(duration, value) : value
  }

  /// 内容未变化时复用当前像素缓冲，以低频新时间戳重送，供画中画切换和暂停后恢复显示。
  private func render(force: Bool = false) {
    guard sourceView != nil else { return }
    let now = ProcessInfo.processInfo.systemUptime
    let needsFlush = displayLayer.status == .failed || displayLayer.requiresFlushToResumeDecoding
    if needsFlush {
      reportRenderError("display-layer: \(displayLayer.error?.localizedDescription ?? "requires flush")")
      displayLayer.flush()
    }
    guard displayLayer.isReadyForMoreMediaData else { return }
    let time = currentPosition() + (content?.offset ?? 0)
    let line = content?.lines.last(where: { $0.start <= time })
    let active = line.flatMap { time < $0.end + 3000 ? $0 : nil }
    let title = content?.title.isEmpty == false ? content!.title : "SPlayer Next"
    let info = [title, content?.artist ?? ""].filter { !$0.isEmpty }.joined(separator: " - ")
    let text = [active?.text ?? title, active?.translation ?? "", info]
    if text != lastText || cachedFrame == nil {
      guard let buffer = drawFrame(text) else { return }
      cachedFrame = buffer
      lastText = text
    } else if !force && !needsFlush && now - lastFrameTime < 1 {
      return
    }
    guard let buffer = cachedFrame else { return }
    var format: CMVideoFormatDescription?
    let formatResult = CMVideoFormatDescriptionCreateForImageBuffer(allocator: kCFAllocatorDefault,
      imageBuffer: buffer, formatDescriptionOut: &format)
    guard formatResult == noErr, let format = format else {
      reportRenderError("video-format: \(formatResult)")
      return
    }
    // displayLayer 未设置 controlTimebase，PTS 必须使用 host clock，不能始终为零。
    var timing = CMSampleTimingInfo(duration: CMTime(seconds: 2, preferredTimescale: 600),
      presentationTimeStamp: CMClockGetTime(CMClockGetHostTimeClock()), decodeTimeStamp: .invalid)
    var sample: CMSampleBuffer?
    let sampleResult = CMSampleBufferCreateReadyWithImageBuffer(allocator: kCFAllocatorDefault,
      imageBuffer: buffer, formatDescription: format, sampleTiming: &timing, sampleBufferOut: &sample)
    guard sampleResult == noErr, let sample = sample else {
      reportRenderError("sample-buffer: \(sampleResult)")
      return
    }
    if let attachments = CMSampleBufferGetSampleAttachmentsArray(sample, createIfNecessary: true) {
      let dictionary = unsafeBitCast(CFArrayGetValueAtIndex(attachments, 0), to: CFMutableDictionary.self)
      CFDictionarySetValue(dictionary,
        Unmanaged.passUnretained(kCMSampleAttachmentKey_DisplayImmediately).toOpaque(),
        Unmanaged.passUnretained(kCFBooleanTrue).toOpaque())
    }
    displayLayer.enqueue(sample)
    lastFrameTime = now
    frameCount += 1
    if frameCount == 1 || frameCount % 30 == 0 {
      log("frames=\(frameCount) status=\(displayLayer.status.rawValue) ready=\(displayReadiness) surface=\(CVPixelBufferGetIOSurface(buffer) != nil) bytes=\(CVPixelBufferGetDataSize(buffer))")
    }
  }

  /// 使用可共享的 IOSurface，并在送往系统显示层之前结束 CPU 写入锁。
  private func drawFrame(_ text: [String]) -> CVPixelBuffer? {
    var pixelBuffer: CVPixelBuffer?
    let attributes: [CFString: Any] = [
      kCVPixelBufferCGImageCompatibilityKey: true,
      kCVPixelBufferCGBitmapContextCompatibilityKey: true,
      kCVPixelBufferIOSurfacePropertiesKey: [:] as [String: Any],
      kCVPixelBufferMetalCompatibilityKey: true
    ]
    let result = CVPixelBufferCreate(kCFAllocatorDefault, 640, 360, kCVPixelFormatType_32BGRA,
      attributes as CFDictionary, &pixelBuffer)
    guard result == kCVReturnSuccess, let buffer = pixelBuffer else {
      reportRenderError("pixel-buffer: \(result)")
      return nil
    }
    let lockResult = CVPixelBufferLockBaseAddress(buffer, [])
    guard lockResult == kCVReturnSuccess else {
      reportRenderError("pixel-buffer-lock: \(lockResult)")
      return nil
    }
    defer { CVPixelBufferUnlockBaseAddress(buffer, []) }
    guard let context = CGContext(data: CVPixelBufferGetBaseAddress(buffer), width: 640,
      height: 360, bitsPerComponent: 8, bytesPerRow: CVPixelBufferGetBytesPerRow(buffer),
      space: CGColorSpaceCreateDeviceRGB(),
      bitmapInfo: CGImageAlphaInfo.premultipliedFirst.rawValue | CGBitmapInfo.byteOrder32Little.rawValue)
    else {
      reportRenderError("bitmap-context: creation failed")
      return nil
    }
    context.setFillColor(UIColor(red: 0.07, green: 0.08, blue: 0.11, alpha: 1).cgColor)
    context.fill(CGRect(x: 0, y: 0, width: 640, height: 360))
    context.translateBy(x: 0, y: 360)
    context.scaleBy(x: 1, y: -1)
    UIGraphicsPushContext(context)
    let paragraph = NSMutableParagraphStyle()
    paragraph.alignment = .center
    paragraph.lineBreakMode = .byTruncatingTail
    let rects = [CGRect(x: 32, y: 65, width: 576, height: 138),
                 CGRect(x: 32, y: 210, width: 576, height: 65),
                 CGRect(x: 32, y: 302, width: 576, height: 30)]
    for i in 0..<text.count {
      (text[i] as NSString).draw(in: rects[i], withAttributes: [
        .font: UIFont.systemFont(ofSize: i == 0 ? 34 : (i == 1 ? 23 : 18),
                                 weight: i == 0 ? .semibold : .regular),
        .foregroundColor: i == 0 ? UIColor.white : UIColor.lightGray,
        .paragraphStyle: paragraph
      ])
    }
    UIGraphicsPopContext()
    context.flush()
    return buffer
  }

  private func reportRenderError(_ message: String) {
    guard lastRenderError != message else { return }
    lastRenderError = message
    log("render-error: \(message)")
  }

  /// 应用已将 stderr 重定向到共享日志，直接写入以免只落到系统统一日志。
  private func log(_ message: String) {
    fputs("[lyric-pip] \(message)\n", stderr)
  }

  private func cleanup() {
    startTimeout?.cancel()
    startTimeout = nil
    readiness = nil
    timer?.invalidate()
    timer = nil
    controller?.delegate = nil
    controller = nil
    displayLayer.flushAndRemoveImage()
    displayLayer.removeFromSuperlayer()
    sourceView?.removeFromSuperview()
    sourceView = nil
    content = nil
    lastText = nil
    cachedFrame = nil
    lastFrameTime = -.infinity
    lastRenderError = nil
    log("stopped frames=\(frameCount)")
    trigger("visibility", data: ["active": false])
  }

  private func fail(_ message: String) {
    log(message)
    pendingStart?.reject(message)
    pendingStart = nil
    cleanup()
  }

  func pictureInPictureControllerDidStartPictureInPicture(_ pictureInPictureController: AVPictureInPictureController) {
    startTimeout?.cancel()
    startTimeout = nil
    pendingStart?.resolve()
    pendingStart = nil
    trigger("visibility", data: ["active": true])
    log("started ready=\(displayReadiness)")
    render(force: true)
    updateTimer()
  }

  func pictureInPictureControllerDidStopPictureInPicture(_ pictureInPictureController: AVPictureInPictureController) {
    cleanup()
  }

  func pictureInPictureController(_ pictureInPictureController: AVPictureInPictureController,
    failedToStartPictureInPictureWithError error: Error) {
    fail(error.localizedDescription)
  }

  func pictureInPictureController(_ pictureInPictureController: AVPictureInPictureController,
    restoreUserInterfaceForPictureInPictureStopWithCompletionHandler completionHandler: @escaping (Bool) -> Void) {
    completionHandler(true)
  }

  func pictureInPictureController(_ pictureInPictureController: AVPictureInPictureController, setPlaying playing: Bool) {
    trigger("playback", data: ["playing": playing])
  }

  func pictureInPictureControllerTimeRangeForPlayback(_ pictureInPictureController: AVPictureInPictureController) -> CMTimeRange {
    CMTimeRange(start: .negativeInfinity, duration: .positiveInfinity)
  }

  func pictureInPictureControllerIsPlaybackPaused(_ pictureInPictureController: AVPictureInPictureController) -> Bool {
    !playing
  }

  func pictureInPictureController(_ pictureInPictureController: AVPictureInPictureController,
    didTransitionToRenderSize newRenderSize: CMVideoDimensions) {
    log("render-size=\(newRenderSize.width)x\(newRenderSize.height)")
    render(force: true)
  }

  func pictureInPictureController(_ pictureInPictureController: AVPictureInPictureController,
    skipByInterval skipInterval: CMTime, completion completionHandler: @escaping () -> Void) {
    completionHandler()
  }
}

@_cdecl("init_plugin_lyric_pip")
func initPlugin() -> Plugin {
  if #available(iOS 15.0, *) { return LyricPipPlugin() }
  return Plugin()
}
