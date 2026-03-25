import Foundation
#if canImport(AVFoundation)
import AVFoundation
#endif
#if canImport(UIKit)
import UIKit
#endif

#if canImport(AVFoundation)
public final class DMSPreWarmedAudioKernel: @unchecked Sendable {
    public static let shared = DMSPreWarmedAudioKernel()

    private let lock = NSLock()
    private var engine: AVAudioEngine?
    private var player: AVAudioPlayerNode?
    private var wireFormat: AVAudioFormat?

    private init() {}

    public func prewarm() {
        lock.lock()
        defer { lock.unlock() }
        if engine != nil { return }
        let session = AVAudioSession.sharedInstance()
        try? session.setCategory(.playback, mode: .default, options: [.duckOthers])
        try? session.setActive(true)
        let eng = AVAudioEngine()
        let pl = AVAudioPlayerNode()
        eng.attach(pl)
        let sampleRate = eng.outputNode.outputFormat(forBus: 0).sampleRate
        guard sampleRate > 0,
              let format = AVAudioFormat(standardFormatWithSampleRate: sampleRate, channels: 1)
        else { return }
        eng.connect(pl, to: eng.mainMixerNode, format: format)
        do {
            try eng.start()
            engine = eng
            player = pl
            wireFormat = format
        } catch {
            engine = nil
            player = nil
            wireFormat = nil
        }
    }

    public func playDMSBurst(duration: TimeInterval = 0.4) {
        lock.lock()
        let eng = engine
        let pl = player
        let fmt = wireFormat
        lock.unlock()
        guard let eng, let pl, let format = fmt,
              let buffer = Self.makeSinePCMBuffer(format: format, frequencyHz: 800, duration: duration)
        else { return }
        #if canImport(UIKit)
        DispatchQueue.main.async {
            let h = UIImpactFeedbackGenerator(style: .heavy)
            h.prepare()
            h.impactOccurred(intensity: 1)
        }
        #endif
        pl.stop()
        pl.scheduleBuffer(buffer, at: nil, options: [], completionHandler: nil)
        if !pl.isPlaying {
            pl.play()
        }
        _ = eng
    }

    private static func makeSinePCMBuffer(format: AVAudioFormat, frequencyHz: Double, duration: TimeInterval) -> AVAudioPCMBuffer? {
        let frameCount = max(1, AVAudioFrameCount(duration * format.sampleRate))
        guard let buf = AVAudioPCMBuffer(pcmFormat: format, frameCapacity: frameCount) else { return nil }
        buf.frameLength = frameCount
        guard let ch = buf.floatChannelData?[0] else { return nil }
        let twoPi = 2 * Double.pi
        let sr = format.sampleRate
        let last = max(Int(frameCount) - 1, 1)
        for i in 0..<Int(frameCount) {
            let t = Double(i) / sr
            let linear = Double(i) / Double(last)
            let fade = linear > 0.9 ? (1 - linear) / 0.1 : 1
            ch[i] = Float(0.88 * fade * sin(twoPi * frequencyHz * t))
        }
        return buf
    }
}
#else
public final class DMSPreWarmedAudioKernel: Sendable {
    public static let shared = DMSPreWarmedAudioKernel()
    private init() {}
    public func prewarm() {}
    public func playDMSBurst(duration: TimeInterval = 0.4) { _ = duration }
}
#endif
