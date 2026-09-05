import AVFoundation
import AudioStreaming
import MediaPlayer
import Tauri
import UIKit
import WebKit

private struct SourceRequest: Decodable {
  let source: String
  let autoPlay: Bool
}
private struct ControlRequest: Decodable {
  let action: String
  let position: Double?
}
private struct MetadataRequest: Decodable {
  let title: String
  let artist: String
  let album: String
  let cover: String
  let enabled: Bool
  let dynamic: Bool?
  let offset: Double?
  let lines: [ControlLyric]?
}
private struct ControlLyric: Decodable {
  let start: Double
  let end: Double
  let text: String
}
private struct VisibilityRequest: Decodable { let visible: Bool }

final class NativeAudioPlugin: Plugin, AudioPlayerDelegate {
  private var player: AudioPlayer?
  private var audioEffects = AudioEffects()
  private var effects = EffectRequest(volume: 1, speed: 1, pitch: 0, pitchSync: true,
    enabled: false, bands: Array(repeating: 0, count: 10), preamp: 0)
  private var pendingLoad: Invoke?
  private var loadTimeout: DispatchWorkItem?
  private var autoPlay = true
  private var sourceURL: URL?
  private var visible = true
  private var timer: Timer?
  private var remoteTargets: [(MPRemoteCommand, Any)] = []
  private var observers: [NSObjectProtocol] = []
  private var resumeAfterInterruption = false
  private var artworkTask: URLSessionDataTask?
  private var artworkURL = ""
  private var mediaEnabled = true
  private var metadataValue: MetadataRequest?
  private var lastLyricUpdate = Date.distantPast

  override func load(webview: WKWebView) {
    super.load(webview: webview)
    DispatchQueue.main.async { self.installControls() }
  }

  deinit {
    timer?.invalidate()
    loadTimeout?.cancel()
    artworkTask?.cancel()
    for (command, target) in remoteTargets { command.removeTarget(target) }
    for observer in observers { NotificationCenter.default.removeObserver(observer) }
    player?.delegate = nil
    player?.stop()
  }

  /** 创建单个流式播放器，切歌后释放旧解码器与网络连接。 */
  @objc func load(_ invoke: Invoke) throws {
    let request = try invoke.parseArgs(SourceRequest.self)
    DispatchQueue.main.async {
      guard let url = request.source.hasPrefix("/") ? URL(fileURLWithPath: request.source) : URL(string: request.source),
            ["https", "http", "file"].contains(url.scheme ?? "") else {
        invoke.reject("原生播放器不支持该音源地址"); return
      }
      self.loadTimeout?.cancel()
      self.pendingLoad?.reject("已切换歌曲")
      self.pendingLoad = nil
      self.player?.delegate = nil
      self.player?.stop()
      self.player = nil
      do {
        let session = AVAudioSession.sharedInstance()
        try session.setCategory(.playback, mode: .default)
        try session.setActive(true)
        let player = AudioPlayer()
        self.audioEffects = AudioEffects()
        player.attach(nodes: [self.audioEffects.equalizer, self.audioEffects.timePitch])
        self.player = player
        self.sourceURL = url
        self.autoPlay = request.autoPlay
        self.applyEffects()
        // 预载不应短暂漏出声音，缓冲完成后再恢复目标音量。
        if !request.autoPlay { player.volume = 0 }
        self.pendingLoad = invoke
        player.delegate = self
        player.play(url: url)
        let timeout = DispatchWorkItem { [weak self, weak player] in
          guard let self = self, self.player === player, let pending = self.pendingLoad else { return }
          self.pendingLoad = nil
          player?.stop()
          pending.reject("原生音频加载超时")
        }
        self.loadTimeout = timeout
        DispatchQueue.main.asyncAfter(deadline: .now() + 25, execute: timeout)
      } catch { invoke.reject(error.localizedDescription) }
    }
  }

  private func applyEffects() {
    guard let player = player else { return }
    audioEffects.apply(effects)
    player.volume = pendingLoad != nil && !autoPlay ? 0 : effects.volume
    player.rate = effects.speed
    updatePosition()
  }

  @objc func configure(_ invoke: Invoke) throws {
    let value = try invoke.parseArgs(EffectRequest.self)
    guard value.bands.count == 10,
          value.bands.allSatisfy({ $0.isFinite && abs($0) <= 12 }),
          value.volume.isFinite, (0...1).contains(value.volume),
          value.speed.isFinite, (0.5...2).contains(value.speed),
          value.pitch.isFinite, abs(value.pitch) <= 12,
          value.preamp.isFinite, abs(value.preamp) <= 12 else {
      invoke.reject("音效参数超出范围"); return
    }
    DispatchQueue.main.async {
      self.effects = value
      self.applyEffects()
      invoke.resolve()
    }
  }

  @objc func control(_ invoke: Invoke) throws {
    let request = try invoke.parseArgs(ControlRequest.self)
    DispatchQueue.main.async {
      guard let player = self.player else { invoke.reject("请先加载歌曲"); return }
      switch request.action {
      case "play":
        do { try AVAudioSession.sharedInstance().setActive(true) }
        catch { invoke.reject(error.localizedDescription); return }
        self.autoPlay = true
        if player.state == .stopped, let url = self.sourceURL { player.play(url: url) }
        else { player.resume() }
      case "pause":
        self.resumeAfterInterruption = false
        player.pause()
      case "stop":
        self.pendingLoad?.reject("播放已停止")
        self.pendingLoad = nil
        self.loadTimeout?.cancel()
        player.stop()
      case "seek":
        guard let ms = request.position, ms.isFinite, player.isSeekable else {
          invoke.reject("当前音源暂不支持跳转"); return
        }
        player.seek(to: max(0, min(ms / 1000, player.duration)))
      default: invoke.reject("未知播放操作"); return
      }
      self.updatePosition()
      invoke.resolve(self.snapshot())
    }
  }

  private func snapshot() -> JSObject {
    let state: String
    switch player?.state {
    case .playing, .running: state = "playing"
    case .paused: state = "paused"
    case .bufferring: state = "loading"
    case .stopped: state = "stopped"
    default: state = "idle"
    }
    return ["state": state, "position": (player?.progress ?? 0) * 1000,
      "duration": (player?.duration ?? 0) * 1000, "volume": Double(effects.volume),
      "speed": Double(effects.speed), "isFinished": player?.stopReason == .eof]
  }

  @objc func status(_ invoke: Invoke) {
    DispatchQueue.main.async { invoke.resolve(self.snapshot()) }
  }
  @objc func visibility(_ invoke: Invoke) throws {
    let request = try invoke.parseArgs(VisibilityRequest.self)
    DispatchQueue.main.async { self.visible = request.visible; invoke.resolve() }
  }

  private func updatePosition() {
    guard mediaEnabled else { return }
    var info = MPNowPlayingInfoCenter.default().nowPlayingInfo ?? [:]
    if let value = metadataValue {
      let time = (player?.progress ?? 0) * 1000 + (value.offset ?? 0)
      let line = value.dynamic == true ? value.lines?.last(where: { $0.start <= time }) : nil
      let text = line.flatMap { time < $0.end + 3000 ? $0.text : nil } ?? ""
      info[MPMediaItemPropertyTitle] = text.isEmpty ? value.title : text
      info[MPMediaItemPropertyArtist] = text.isEmpty ? value.artist : "\(value.title) - \(value.artist)"
    }
    info[MPNowPlayingInfoPropertyElapsedPlaybackTime] = player?.progress ?? 0
    info[MPMediaItemPropertyPlaybackDuration] = player?.duration ?? 0
    info[MPNowPlayingInfoPropertyPlaybackRate] = player?.state == .playing ? effects.speed : 0
    MPNowPlayingInfoCenter.default().nowPlayingInfo = info
  }

  @objc func metadata(_ invoke: Invoke) throws {
    let value = try invoke.parseArgs(MetadataRequest.self)
    DispatchQueue.main.async {
      self.mediaEnabled = value.enabled
      self.metadataValue = value
      guard value.enabled else {
        self.artworkTask?.cancel()
        self.artworkURL = ""
        MPNowPlayingInfoCenter.default().nowPlayingInfo = nil
        invoke.resolve(); return
      }
      var info = MPNowPlayingInfoCenter.default().nowPlayingInfo ?? [:]
      info[MPMediaItemPropertyTitle] = value.title
      info[MPMediaItemPropertyArtist] = value.artist
      info[MPMediaItemPropertyAlbumTitle] = value.album
      if value.cover != self.artworkURL {
        self.artworkTask?.cancel()
        self.artworkURL = value.cover
        info.removeValue(forKey: MPMediaItemPropertyArtwork)
        if let url = URL(string: value.cover), ["https", "http"].contains(url.scheme ?? "") {
          self.artworkTask = URLSession.shared.dataTask(with: url) { [weak self] data, _, _ in
            guard let data = data, let image = UIImage(data: data) else { return }
            DispatchQueue.main.async {
              guard let self = self, self.artworkURL == value.cover, self.mediaEnabled else { return }
              var current = MPNowPlayingInfoCenter.default().nowPlayingInfo ?? [:]
              current[MPMediaItemPropertyArtwork] = MPMediaItemArtwork(boundsSize: image.size) { _ in image }
              MPNowPlayingInfoCenter.default().nowPlayingInfo = current
            }
          }
          self.artworkTask?.resume()
        }
      }
      MPNowPlayingInfoCenter.default().nowPlayingInfo = info
      self.updatePosition()
      invoke.resolve()
    }
  }

  private func installControls() {
    let center = MPRemoteCommandCenter.shared()
    for (command, action) in [(center.playCommand, "play"), (center.pauseCommand, "pause"),
                             (center.togglePlayPauseCommand, "toggle"),
                             (center.nextTrackCommand, "next"), (center.previousTrackCommand, "prev")] {
      command.isEnabled = true
      let target = command.addTarget { [weak self] _ in
        guard let self = self, let player = self.player else { return .noSuchContent }
        DispatchQueue.main.async {
          if action == "play" || (action == "toggle" && player.state != .playing) {
            do { try AVAudioSession.sharedInstance().setActive(true) }
            catch { self.trigger("error", data: ["message": error.localizedDescription]); return }
            self.autoPlay = true
            if player.state == .stopped, let url = self.sourceURL { player.play(url: url) }
            else { player.resume() }
          }
          else if action == "pause" || action == "toggle" { self.resumeAfterInterruption = false; player.pause() }
          else { self.trigger("action", data: ["type": action]) }
          self.updatePosition()
        }
        return .success
      }
      remoteTargets.append((command, target))
    }
    let seek = center.changePlaybackPositionCommand
    seek.isEnabled = true
    remoteTargets.append((seek, seek.addTarget { [weak self] event in
      guard let self = self, let event = event as? MPChangePlaybackPositionCommandEvent,
            let player = self.player, player.isSeekable else { return .commandFailed }
      DispatchQueue.main.async { player.seek(to: event.positionTime); self.updatePosition() }
      return .success
    }))
    observers.append(NotificationCenter.default.addObserver(forName: AVAudioSession.interruptionNotification, object: nil, queue: .main) { [weak self] notification in
      guard let self = self, let raw = notification.userInfo?[AVAudioSessionInterruptionTypeKey] as? UInt,
            let type = AVAudioSession.InterruptionType(rawValue: raw) else { return }
      if type == .began {
        self.resumeAfterInterruption = self.player?.state == .playing
        self.player?.pause()
      } else {
        let rawOptions = notification.userInfo?[AVAudioSessionInterruptionOptionKey] as? UInt ?? 0
        if self.resumeAfterInterruption && AVAudioSession.InterruptionOptions(rawValue: rawOptions).contains(.shouldResume) {
          do { try AVAudioSession.sharedInstance().setActive(true); self.player?.resume() }
          catch { self.trigger("error", data: ["message": error.localizedDescription]) }
        }
        self.resumeAfterInterruption = false
      }
    })
    observers.append(NotificationCenter.default.addObserver(forName: AVAudioSession.routeChangeNotification, object: nil, queue: .main) { [weak self] notification in
      if notification.userInfo?[AVAudioSessionRouteChangeReasonKey] as? UInt == AVAudioSession.RouteChangeReason.oldDeviceUnavailable.rawValue {
        self?.player?.pause()
      }
    })
    timer = Timer.scheduledTimer(withTimeInterval: 0.2, repeats: true) { [weak self] _ in
      guard let self = self, self.player?.state == .playing else { return }
      // 后台动态歌词由原生时钟更新，不依赖 WebView 的定时器继续运行。
      if self.metadataValue?.dynamic == true && Date().timeIntervalSince(self.lastLyricUpdate) >= 1 {
        self.lastLyricUpdate = Date()
        self.updatePosition()
      }
      if self.visible { self.trigger("position", data: self.snapshot()) }
    }
  }

  func audioPlayerDidStartPlaying(player: AudioPlayer, with entryId: AudioEntryId) {
    DispatchQueue.main.async {
      guard self.player === player else { return }
      self.loadTimeout?.cancel()
      if let pending = self.pendingLoad {
        if !self.autoPlay { player.pause(); player.volume = self.effects.volume }
        self.pendingLoad = nil
        pending.resolve(self.snapshot())
      }
    }
  }
  func audioPlayerStateChanged(player: AudioPlayer, with newState: AudioPlayerState, previous: AudioPlayerState) {
    DispatchQueue.main.async {
      guard self.player === player else { return }
      self.updatePosition()
      self.trigger("state", data: self.snapshot())
    }
  }
  func audioPlayerDidFinishPlaying(player: AudioPlayer, entryId: AudioEntryId, stopReason: AudioPlayerStopReason, progress: Double, duration: Double) {
    guard stopReason == .eof else { return }
    DispatchQueue.main.async {
      if self.player === player { self.trigger("ended", data: [:]) }
    }
  }
  func audioPlayerUnexpectedError(player: AudioPlayer, error: AudioPlayerError) {
    DispatchQueue.main.async {
      guard self.player === player else { return }
      self.loadTimeout?.cancel()
      if let pending = self.pendingLoad { pending.reject(error.localizedDescription); self.pendingLoad = nil }
      else { self.trigger("error", data: ["message": error.localizedDescription]) }
    }
  }
  func audioPlayerDidFinishBuffering(player: AudioPlayer, with entryId: AudioEntryId) {}
  func audioPlayerDidCancel(player: AudioPlayer, queuedItems: [AudioEntryId]) {}
  func audioPlayerDidReadMetadata(player: AudioPlayer, metadata: [String: String]) {}
}

@_cdecl("init_plugin_native_audio")
func initNativeAudioPlugin() -> Plugin { NativeAudioPlugin() }
