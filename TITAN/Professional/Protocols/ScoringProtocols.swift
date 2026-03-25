import Foundation

// MARK: - Contratos testeables para modelos críticos (inyección en `InferenceEngine`)

public protocol CNSRScoring: Sendable {
    func score(fused: FusedFeatureVector, preflightTap: TapTestSession?) -> UInt8
}

public protocol ICOScoring: Sendable {
    func score(cnsr: UInt8, injuryRisk: UInt8, fused: FusedFeatureVector) -> UInt8
}

public protocol InjuryRiskScoring: Sendable {
    func score(fused: FusedFeatureVector) -> UInt8
}

extension CNSModel: CNSRScoring {}
extension ICOModel: ICOScoring {}
extension InjuryRiskModel: InjuryRiskScoring {}
