import Foundation

/// ICO global: integra CNS‑R, periferia, carga, riesgo (stub).
public struct ICOModel: Sendable {
    public init() {}

    public func score(cnsr: UInt8, injuryRisk: UInt8, fused: FusedFeatureVector) -> UInt8 {
        _ = fused
        let penalty = min(40, Int(injuryRisk) / 2)
        let v = max(0, min(100, Int(cnsr) - penalty))
        return UInt8(v)
    }
}
