import Foundation

/// Vector de features fusionadas para inferencia (HRV, cinemática, fuerza, presión, RPE).
public struct FusedFeatureVector: Sendable {
    public var hrvRMSSD: Double?
    public var restingHR: Double?
    public var accelRMS: Double?
    public var gyroRMS: Double?
    public var forceN: Double?
    public var plantarKPa: Double?
    public var rpe: Double?
    public var suspectRatio: Double
    /// R4.2 — Salida del pipeline visión/biomecánica (valgo extremo, colapso, asimetría persistente).
    public var biomechanicalCritical: Bool

    public init(
        hrvRMSSD: Double? = nil,
        restingHR: Double? = nil,
        accelRMS: Double? = nil,
        gyroRMS: Double? = nil,
        forceN: Double? = nil,
        plantarKPa: Double? = nil,
        rpe: Double? = nil,
        suspectRatio: Double = 0,
        biomechanicalCritical: Bool = false
    ) {
        self.hrvRMSSD = hrvRMSSD
        self.restingHR = restingHR
        self.accelRMS = accelRMS
        self.gyroRMS = gyroRMS
        self.forceN = forceN
        self.plantarKPa = plantarKPa
        self.rpe = rpe
        self.suspectRatio = suspectRatio
        self.biomechanicalCritical = biomechanicalCritical
    }
}

public struct FusionEngine: Sendable {
    public init() {}

    public func fuse(_ samples: [SensorSample]) -> FusedFeatureVector {
        let suspects = samples.filter { $0.payload["suspect"] == 1 }.count
        let ratio = samples.isEmpty ? 0 : Double(suspects) / Double(samples.count)
        let biomech = samples.contains { $0.payload["biomech_critical"] == 1 }
        return FusedFeatureVector(suspectRatio: ratio, biomechanicalCritical: biomech)
    }
}
