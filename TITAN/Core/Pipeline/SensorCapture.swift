import Foundation

/// Reloj maestro ~10 ms: todas las muestras llevan `masterTimestamp` alineado.
public struct SensorSample: Sendable {
    public var masterTimestamp: UInt64 // ms desde epoch de sesión o monotonic convertido
    public var source: SensorSource
    public var payload: [String: Double]

    public init(masterTimestamp: UInt64, source: SensorSource, payload: [String: Double]) {
        self.masterTimestamp = masterTimestamp
        self.source = source
        self.payload = payload
    }
}

public enum SensorSource: String, Sendable {
    case healthKit
    case coreMotion
    case cameraKinematics
    case bleForce
    case blePlantar
    case manualRPE
}

public protocol SensorCapturing: Sendable {
    /// Muestras desde el último tick; reloj maestro unificado en `SensorSample.masterTimestamp`.
    func pullSamples(maxCount: Int) async -> [SensorSample]
}

/// Implementación real: HealthKitManager + MotionManager + CameraManager + BLE.
public final class SensorCapture: SensorCapturing, @unchecked Sendable {
    public init() {}

    public func pullSamples(maxCount: Int) async -> [SensorSample] {
        _ = maxCount
        // STUB: enlace con sensores reales
        []
    }
}
