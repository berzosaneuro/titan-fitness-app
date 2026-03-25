import Foundation

/// CNS‑R: tap test (10 s / dedo) + HRV (RMSSD u otros en vector fusionado) → 0–100; inferencia Core ML en certificación.
public struct CNSModel: Sendable {
    public init() {}

    public func score(fused: FusedFeatureVector, preflightTap: TapTestSession? = nil) -> UInt8 {
        let hrvBranch = recoveryFromHRV(fused)
        guard let tap = preflightTap, !tap.results.isEmpty else {
            return hrvBranch
        }
        let tapBranch = tap.provisionalCNSRContribution()
        return UInt8(min(100, max(40, (Int(hrvBranch) + Int(tapBranch)) / 2)))
    }

    /// RMSSD típico reposo ~20–80 ms; mapeo acotado a banda operativa 45…100.
    private func recoveryFromHRV(_ fused: FusedFeatureVector) -> UInt8 {
        guard let rmssd = fused.hrvRMSSD, rmssd > 0 else { return 72 }
        let mapped = rmssd * 0.65 + 42
        return UInt8(min(100, max(45, mapped)).rounded(.towardZero))
    }
}
