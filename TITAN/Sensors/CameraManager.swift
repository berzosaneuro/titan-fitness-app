import Foundation
#if canImport(AVFoundation)
import AVFoundation
#endif

/// Captura de baja latencia para visión + Dead Man's Switch (configuración real en app host).
public final class CameraManager: @unchecked Sendable {
    #if canImport(AVFoundation)
    private let session = AVCaptureSession()
    #endif

    public init() {}

    public func prepareSession() {
        #if canImport(AVFoundation)
        session.sessionPreset = .high
        #endif
    }
}
