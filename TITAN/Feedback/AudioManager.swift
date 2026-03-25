import Foundation
#if canImport(AVFoundation)
import AVFoundation
#endif
#if canImport(AudioToolbox)
import AudioToolbox
#endif

/// R1.3 / R4.2 — Tono nominal **800 Hz** para Dead Man's Switch; fallback a sistema si el motor de audio falla.
public enum AudioManager {
    #if canImport(AVFoundation)
    private final class PlaybackRetention: NSObject {
        var engine: AVAudioEngine?
        var player: AVAudioPlayerNode?
    }

    private static let retention = PlaybackRetention()
    private static let retentionLock = NSLock()
    #endif

    public static func playDeadManSwitchTone() {
        #if canImport(AVFoundation)
        retentionLock.lock()
        retention.player?.stop()
        retention.engine?.stop()
        retention.engine?.reset()
        retention.player = nil
        retention.engine = nil
        retentionLock.unlock()

        let session = AVAudioSession.sharedInstance()
        try? session.setCategory(.playback, mode: .default, options: [.duckOthers])
        try? session.setActive(true)

        let engine = AVAudioEngine()
        let player = AVAudioPlayerNode()
        engine.attach(player)

        let sampleRate = engine.outputNode.outputFormat(forBus: 0).sampleRate
        guard sampleRate > 0,
              let format = AVAudioFormat(standardFormatWithSampleRate: sampleRate, channels: 1),
              let buffer = makeSinePCMBuffer(format: format, frequencyHz: 800, duration: 0.4)
        else {
            playSystemFallback()
            return
        }

        engine.connect(player, to: engine.mainMixerNode, format: format)

        do {
            try engine.start()
            retentionLock.lock()
            retention.engine = engine
            retention.player = player
            retentionLock.unlock()

            player.scheduleBuffer(buffer) {
                DispatchQueue.main.async {
                    retentionLock.lock()
                    defer { retentionLock.unlock() }
                    player.stop()
                    engine.stop()
                    engine.reset()
                    if retention.engine === engine {
                        retention.engine = nil
                        retention.player = nil
                    }
                }
            }
            player.play()
        } catch {
            playSystemFallback()
        }
        #elseif canImport(AudioToolbox)
        playSystemFallback()
        #endif
    }

    #if canImport(AudioToolbox)
    private static func playSystemFallback() {
        AudioServicesPlaySystemSound(1057)
    }
    #endif

    #if canImport(AVFoundation)
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
    #endif
}
