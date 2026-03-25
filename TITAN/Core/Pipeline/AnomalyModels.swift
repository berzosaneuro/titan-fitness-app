import Foundation

/// R2.3 — Contrato para detección de anomalías por sensor y sobre features fusionadas (implementación Core ML / estadística en capas superiores).
public protocol PerSensorAnomalyDetecting: Sendable {
    func score(sample: SensorSample) -> Double
}

public protocol FusedAnomalyDetecting: Sendable {
    func score(vector: FusedFeatureVector) -> Double
}

/// STUB: sustituir por modelos calibrados por sensor.
public struct PassthroughSensorAnomalyDetector: PerSensorAnomalyDetecting {
    public init() {}
    public func score(sample: SensorSample) -> Double {
        sample.payload["suspect"] == 1 ? 0.9 : 0.05
    }
}

/// STUB: modelo sobre vector fusionado previo a inferencia CNS‑R / lesión / ICO.
public struct PassthroughFusedAnomalyDetector: FusedAnomalyDetecting {
    public init() {}
    public func score(vector: FusedFeatureVector) -> Double {
        min(1, vector.suspectRatio * 1.2)
    }
}
