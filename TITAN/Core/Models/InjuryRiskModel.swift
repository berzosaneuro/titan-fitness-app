import Foundation

/// CNN+LSTM sobre vídeo + sensores → riesgo 0–100 (stub hasta .mlmodelc + Metal).
public struct InjuryRiskModel: Sendable {
    public init() {}

    public func score(fused: FusedFeatureVector) -> UInt8 {
        if fused.suspectRatio > 0.4 { return 35 }
        return 12
    }
}
