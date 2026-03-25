import Foundation

/// R3.3 — Micro‑ajustes si ICO cae ≥ 15 pts respecto al baseline **o** queda por debajo del **umbral de seguridad** certificado.
/// R4.2 — DMS solo vía `dmsTriggered` (muestras consecutivas en `DeadMansSwitchAccumulator`).
public struct SessionAdjustmentPlan: Sendable {
    public var repetitionState: RepetitionSafetyState
    public var summary: String
    public var seriesDelta: Int
    public var loadScale: Double
    public var restScale: Double

    public init(
        repetitionState: RepetitionSafetyState = .inProgress,
        summary: String = "",
        seriesDelta: Int = 0,
        loadScale: Double = 1,
        restScale: Double = 1
    ) {
        self.repetitionState = repetitionState
        self.summary = summary
        self.seriesDelta = seriesDelta
        self.loadScale = loadScale
        self.restScale = restScale
    }
}

public struct DecisionEngine: Sendable {
    /// Baseline ICO al inicio de bloque (certificar por misión).
    public var sessionBaselineICO: UInt8 = 100
    /// Umbral de seguridad mínimo de ICO; por debajo → micro‑ajuste (R3.3).
    public var safetyFloorICO: UInt8 = 72

    public init() {}

    public func planMicroAdjustments(
        scores: InferenceScores,
        fused: FusedFeatureVector,
        dmsTriggered: Bool,
        degradation: MissionDegradationContext = .nominal
    ) -> SessionAdjustmentPlan {
        if dmsTriggered {
            return SessionAdjustmentPlan(
                repetitionState: .aborted,
                summary: "DMS · repetición ABORTADA · confirmar (usuario o entrenador)",
                seriesDelta: 0,
                loadScale: 1,
                restScale: 1
            )
        }
        let drop = Int(sessionBaselineICO) - Int(scores.ico)
        let belowFloor = scores.ico < safetyFloorICO
        let significantDrop = drop >= 15
        let base: SessionAdjustmentPlan
        if belowFloor || significantDrop {
            _ = fused
            let reason = belowFloor ? "ICO < umbral seguridad (\(safetyFloorICO))" : "ICO −\(drop) vs baseline"
            base = SessionAdjustmentPlan(
                repetitionState: .inProgress,
                summary: "Micro-ajuste (\(reason)): −series, −carga, +descanso · layout inmutable",
                seriesDelta: -1,
                loadScale: 0.9,
                restScale: 1.15
            )
        } else {
            _ = fused
            base = SessionAdjustmentPlan(repetitionState: .inProgress, summary: "ICO en banda segura")
        }
        return applySafeDegradation(base, degradation: degradation)
    }

    /// 2.2 — Carga conservadora adicional sin nuevos controles de UI (solo texto y escalares del plan).
    private func applySafeDegradation(_ plan: SessionAdjustmentPlan, degradation: MissionDegradationContext) -> SessionAdjustmentPlan {
        guard degradation.tier >= .conservative else { return plan }
        var p = plan
        p.loadScale *= 0.9
        p.restScale *= 1.1
        if degradation.tier >= .critical {
            p.loadScale *= 0.9
            p.seriesDelta -= 1
        }
        let prefix = degradation.userFacingNotice.isEmpty ? "Modo degradado conservador" : degradation.userFacingNotice
        p.summary = p.summary.isEmpty ? "[DEG] \(prefix)" : "[DEG] \(prefix) · \(p.summary)"
        return p
    }
}
