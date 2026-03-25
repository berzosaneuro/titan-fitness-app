import Foundation

/// Salida 0–100 para índices operativos (acotada en capa superior).
public struct InferenceScores: Sendable {
    public var cnsr: UInt8
    public var ico: UInt8
    public var injuryRisk: UInt8

    public init(cnsr: UInt8 = 80, ico: UInt8 = 85, injuryRisk: UInt8 = 10) {
        self.cnsr = cnsr
        self.ico = ico
        self.injuryRisk = injuryRisk
    }
}

/// Invoca Core ML: contratos `*Scoring` sustituibles en tests y por modelos certificados.
public struct InferenceEngine: Sendable {
    private let cns: any CNSRScoring
    private let ico: any ICOScoring
    private let injury: any InjuryRiskScoring

    public init(cns: any CNSRScoring = CNSModel(), ico: any ICOScoring = ICOModel(), injury: any InjuryRiskScoring = InjuryRiskModel()) {
        self.cns = cns
        self.ico = ico
        self.injury = injury
    }

    public func infer(from fused: FusedFeatureVector, preflightTap: TapTestSession? = nil) -> InferenceScores {
        let cnsr = cns.score(fused: fused, preflightTap: preflightTap)
        let risk = injury.score(fused: fused)
        let icoScore = ico.score(cnsr: cnsr, injuryRisk: risk, fused: fused)
        return InferenceScores(cnsr: cnsr, ico: icoScore, injuryRisk: risk)
    }
}
