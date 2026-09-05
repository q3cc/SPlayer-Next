import AVFoundation
import Foundation

/** 用确定性的正弦波离线渲染，检测实际输出而不是只核对节点参数。 */
func render(frequency: Double = 1000, gain: Float = 0, preamp: Float = 0,
            enabled: Bool = true, pitch: Float = 0, band: Int = 5) throws -> [Float] {
  let engine = AVAudioEngine()
  let source = AVAudioPlayerNode()
  let effects = AudioEffects()
  var bands = Array(repeating: Float(0), count: 10)
  bands[band] = gain
  effects.apply(EffectRequest(volume: 1, speed: 1, pitch: pitch, pitchSync: true,
    enabled: enabled, bands: bands, preamp: preamp))
  let format = AVAudioFormat(standardFormatWithSampleRate: 48000, channels: 2)!
  for node in [source, effects.equalizer, effects.timePitch] as [AVAudioNode] { engine.attach(node) }
  engine.connect(source, to: effects.equalizer, format: format)
  engine.connect(effects.equalizer, to: effects.timePitch, format: format)
  engine.connect(effects.timePitch, to: engine.mainMixerNode, format: format)
  try engine.enableManualRenderingMode(.offline, format: format, maximumFrameCount: 4096)
  let input = AVAudioPCMBuffer(pcmFormat: format, frameCapacity: 144000)!
  input.frameLength = input.frameCapacity
  for channel in 0..<2 {
    for frame in 0..<Int(input.frameLength) {
      input.floatChannelData![channel][frame] = Float(sin(2 * .pi * frequency * Double(frame) / 48000) * 0.05)
    }
  }
  source.scheduleBuffer(input)
  try engine.start()
  source.play()
  defer { source.stop(); engine.stop() }
  let output = AVAudioPCMBuffer(pcmFormat: engine.manualRenderingFormat, frameCapacity: 4096)!
  var samples: [Float] = []
  var attempts = 0
  while samples.count < 96000 && attempts < 200 {
    attempts += 1
    let state = try engine.renderOffline(4096, to: output)
    if state == .success {
      samples.append(contentsOf: UnsafeBufferPointer(start: output.floatChannelData![0], count: Int(output.frameLength)))
    } else if state == .error { fatalError("离线音频渲染失败") }
  }
  precondition(samples.count >= 96000, "音频渲染未产生足够数据")
  return Array(samples[24000..<72000])
}

func rms(_ samples: [Float]) -> Double {
  sqrt(samples.reduce(0) { $0 + Double($1 * $1) } / Double(samples.count))
}

func measuredFrequency(_ samples: [Float]) -> Double {
  let crossings = zip(samples, samples.dropFirst()).filter { $0.0 <= 0 && $0.1 > 0 }.count
  return Double(crossings) * 48000 / Double(samples.count)
}

let flat = try render()
let boosted = try render(gain: 6)
let cut = try render(gain: -6)
let bypass = try render(gain: 6, preamp: 6, enabled: false)
let preamp = try render(preamp: -6)
let outsideFlat = try render(frequency: 100)
let outsideBoost = try render(frequency: 100, gain: 6)
let raised = try render(pitch: 12)
let lowered = try render(pitch: -12)

let boostRatio = rms(boosted) / rms(flat)
let cutRatio = rms(cut) / rms(flat)
let bypassRatio = rms(bypass) / rms(flat)
let preampRatio = rms(preamp) / rms(flat)
let outsideRatio = rms(outsideBoost) / rms(outsideFlat)
print("EQ +6dB ratio=\(boostRatio), -6dB ratio=\(cutRatio), bypass=\(bypassRatio), preamp -6dB=\(preampRatio), off-band=\(outsideRatio)")
precondition((1.8...2.2).contains(boostRatio), "1kHz 提升没有实际生效")
precondition((0.45...0.56).contains(cutRatio), "1kHz 衰减没有实际生效")
precondition((0.98...1.02).contains(bypassRatio), "关闭均衡器后未恢复原始输出")
precondition((0.45...0.56).contains(preampRatio), "前级增益没有实际生效")
precondition((0.9...1.1).contains(outsideRatio), "频段调节不应变成全频音量变化")
let raisedHz = measuredFrequency(raised)
let loweredHz = measuredFrequency(lowered)
print("Pitch +12=\(raisedHz)Hz, -12=\(loweredHz)Hz")
precondition(abs(raisedHz - 2000) < 50, "升八度没有实际生效")
precondition(abs(loweredHz - 500) < 25, "降八度没有实际生效")
for (index, frequency) in [31.0, 62, 125, 250, 500, 1000, 2000, 4000, 8000, 16000].enumerated() {
  let baseline = try render(frequency: frequency)
  let changed = try render(frequency: frequency, gain: 6, band: index)
  let ratio = rms(changed) / rms(baseline)
  print("Band \(index) \(frequency)Hz +6dB ratio=\(ratio)")
  precondition((1.8...2.2).contains(ratio), "频段 \(frequency)Hz 增益错误")
}
let maximumRatio = rms(try render(gain: 15)) / rms(flat)
let minimumRatio = rms(try render(gain: -15)) / rms(flat)
print("EQ +15dB ratio=\(maximumRatio), -15dB ratio=\(minimumRatio)")
precondition((5.4...5.9).contains(maximumRatio), "最大频段增益没有实际生效")
precondition((0.16...0.20).contains(minimumRatio), "最小频段增益没有实际生效")
print("PASS: 19 项原生音效输出检查")
