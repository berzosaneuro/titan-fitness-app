import Foundation

/// R2.2 — Reloj maestro con cuantificación nominal **10 ms** para alinear streams (HealthKit, Core Motion, cámara, IoT).
/// Cada driver convierte su timestamp a ms desde el inicio de sesión y luego llama a `alignSampleTimestampMs`.
public enum MasterClock {
    public static let tickResolutionMs: UInt64 = 10

    public static func alignSampleTimestampMs(_ millisecondsSinceSessionStart: UInt64) -> UInt64 {
        (millisecondsSinceSessionStart / tickResolutionMs) * tickResolutionMs
    }
}
