import Foundation

/// R4.2 — Dead Man's Switch: condición **crítica repetida en muestras consecutivas** antes de abortar.
/// Evita un solo frame espurio; exige trazabilidad para certificación de misión.
public final class DeadMansSwitchAccumulator: @unchecked Sendable {
    /// Umbral de riesgo de lesión (0–100) que cuenta como crítico junto a visión/biomecánica.
    public var injuryRiskThreshold: UInt8 = 88
    /// Número de ticks consecutivos en estado crítico requeridos para disparar DMS.
    public var requiredConsecutiveTicks: Int = 3

    private var consecutiveCritical: Int = 0

    public init() {}

    /// `biomechanicalCritical`: salida del motor de visión / fusión (valgo extremo, colapso, asimetría > threshold).
    public func recordTick(injuryRisk: UInt8, biomechanicalCritical: Bool) -> Bool {
        let critical = injuryRisk >= injuryRiskThreshold || biomechanicalCritical
        if critical {
            consecutiveCritical += 1
        } else {
            consecutiveCritical = 0
        }
        return consecutiveCritical >= requiredConsecutiveTicks
    }

    /// Tras confirmación explícita usuario / entrenador (modo misión).
    public func acknowledgeReset() {
        consecutiveCritical = 0
    }
}
