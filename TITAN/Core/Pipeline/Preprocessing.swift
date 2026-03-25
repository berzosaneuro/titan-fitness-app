import Foundation

/// Filtro de ruido, outliers multimodal, normalización antes de fusión.
public struct Preprocessing: Sendable {
    public init() {}

    /// R2.3: si un pico (ej. FC) no tiene correlato en acelerometría/fuerza/contexto → `suspect`.
    public func filterMultimodal(_ samples: [SensorSample]) -> [SensorSample] {
        samples.map { s in
            var p = s.payload
            if shouldMarkSuspect(s) {
                p["suspect"] = 1
            }
            return SensorSample(masterTimestamp: s.masterTimestamp, source: s.source, payload: p)
        }
    }

    private func shouldMarkSuspect(_ sample: SensorSample) -> Bool {
        // Heurística placeholder
        sample.payload["hr_peak"] == 1 && sample.payload["accel_peak"] != 1
    }
}
