import Foundation

// MARK: - I. Diagnóstico profundo y pre‑vuelo extendido (101–115)

public struct TitanModule101_NeuromuscularFatiguePredictive: TitanLayer2Module {
    public static let moduleId = 101
    public static let displayName = "Fatiga neuromuscular predictiva"
    public init() {}
    public func evaluate(context: Layer2MissionContext) async -> Layer2ModuleOutput {
        let m = min(1, context.fused.suspectRatio + (context.manualRPE ?? 5) / 20)
        Layer2ModuleOutput(moduleId: Self.moduleId, primaryMetric: m, coachHint: "Umbral fatiga NMS estimado pre‑sesión")
    }
}

public struct TitanModule102_CognitiveFatigue: TitanLayer2Module {
    public static let moduleId = 102
    public static let displayName = "Fatiga cognitiva"
    public init() {}
    public func evaluate(context: Layer2MissionContext) async -> Layer2ModuleOutput {
        Layer2ModuleOutput(moduleId: Self.moduleId, primaryMetric: Double(100 - context.cnsr) / 100, flags: ["stimulus_reaction_pending"])
    }
}

public struct TitanModule103_VisualFatigueComputed: TitanLayer2Module {
    public static let moduleId = 103
    public static let displayName = "Fatiga visual (cámara)"
    public init() {}
    public func evaluate(context: Layer2MissionContext) async -> Layer2ModuleOutput {
        Layer2ModuleOutput(moduleId: Self.moduleId, primaryMetric: 0, flags: ["fixation_blink_model_required"])
    }
}

public struct TitanModule104_GlobalPhysiologicalStress: TitanLayer2Module {
    public static let moduleId = 104
    public static let displayName = "Estrés fisiológico global"
    public init() {}
    public func evaluate(context: Layer2MissionContext) async -> Layer2ModuleOutput {
        let h = 1 - (context.fused.hrvRMSSD.map { min(1, $0 / 120) } ?? 0.5)
        let stress = (h + Double(context.injuryRisk) / 200 + (context.manualRPE ?? 5) / 15) / 3
        return Layer2ModuleOutput(moduleId: Self.moduleId, primaryMetric: stress, coachHint: "Índice multi‑dimensional HRV·RPE·tono")
    }
}

public struct TitanModule105_MoodSelfReport: TitanLayer2Module {
    public static let moduleId = 105
    public static let displayName = "Estado de ánimo autodeclarado"
    public init() {}
    public func evaluate(context: Layer2MissionContext) async -> Layer2ModuleOutput {
        Layer2ModuleOutput(moduleId: Self.moduleId, primaryMetric: 0.75, flags: ["form_2_3_questions"])
    }
}

public struct TitanModule106_PriorInjuries: TitanLayer2Module {
    public static let moduleId = 106
    public static let displayName = "Lesiones previas"
    public init() {}
    public func evaluate(context: Layer2MissionContext) async -> Layer2ModuleOutput {
        Layer2ModuleOutput(moduleId: Self.moduleId, primaryMetric: 0, coachHint: "Ajuste de plan por historial lesión")
    }
}

public struct TitanModule107_ChronicFatigueSignals: TitanLayer2Module {
    public static let moduleId = 107
    public static let displayName = "Fatiga crónica (HRV + carga)"
    public init() {}
    public func evaluate(context: Layer2MissionContext) async -> Layer2ModuleOutput {
        Layer2ModuleOutput(moduleId: Self.moduleId, primaryMetric: Double(100 - context.ico) / 100, flags: ["rolling_28d_load"])
    }
}

public struct TitanModule108_EnvironmentalStressOutsider: TitanLayer2Module {
    public static let moduleId = 108
    public static let displayName = "Estrés ambiental"
    public init() {}
    public func evaluate(context: Layer2MissionContext) async -> Layer2ModuleOutput {
        Layer2ModuleOutput(moduleId: Self.moduleId, primaryMetric: 0, flags: ["audio_lux_temp_sensors"])
    }
}

public struct TitanModule109_PosturalStability: TitanLayer2Module {
    public static let moduleId = 109
    public static let displayName = "Estabilidad postural"
    public init() {}
    public func evaluate(context: Layer2MissionContext) async -> Layer2ModuleOutput {
        let sway = context.fused.accelRMS ?? 0
        return Layer2ModuleOutput(moduleId: Self.moduleId, primaryMetric: min(1, sway / 5))
    }
}

public struct TitanModule110_RespiratoryResistance: TitanLayer2Module {
    public static let moduleId = 110
    public static let displayName = "Resistencia respiratoria"
    public init() {}
    public func evaluate(context: Layer2MissionContext) async -> Layer2ModuleOutput {
        Layer2ModuleOutput(moduleId: Self.moduleId, primaryMetric: 0, flags: ["breath_pattern_hr_coupling"])
    }
}

public struct TitanModule111_EnergeticStress: TitanLayer2Module {
    public static let moduleId = 111
    public static let displayName = "Estrés energético"
    public init() {}
    public func evaluate(context: Layer2MissionContext) async -> Layer2ModuleOutput {
        let hr = context.fused.restingHR.map { $0 / 200 } ?? 0.4
        let rpe = (context.manualRPE ?? 5) / 10
        return Layer2ModuleOutput(moduleId: Self.moduleId, primaryMetric: (hr + rpe) / 2)
    }
}

public struct TitanModule112_LocalMuscularFatigue: TitanLayer2Module {
    public static let moduleId = 112
    public static let displayName = "Fatiga muscular local"
    public init() {}
    public func evaluate(context: Layer2MissionContext) async -> Layer2ModuleOutput {
        Layer2ModuleOutput(moduleId: Self.moduleId, primaryMetric: context.fused.forceN.map { min(1, $0 / 3000) } ?? 0)
    }
}

public struct TitanModule113_GlobalFatigueIndex: TitanLayer2Module {
    public static let moduleId = 113
    public static let displayName = "Fatiga global"
    public init() {}
    public func evaluate(context: Layer2MissionContext) async -> Layer2ModuleOutput {
        let a = await TitanModule101_NeuromuscularFatiguePredictive().evaluate(context: context).primaryMetric
        let b = await TitanModule102_CognitiveFatigue().evaluate(context: context).primaryMetric
        let c = await TitanModule103_VisualFatigueComputed().evaluate(context: context).primaryMetric
        return Layer2ModuleOutput(moduleId: Self.moduleId, primaryMetric: (a + b + c) / 3, coachHint: "Fusión NMS·cognitiva·visual")
    }
}

public struct TitanModule114_RecoveryCapacity: TitanLayer2Module {
    public static let moduleId = 114
    public static let displayName = "Capacidad de recuperación"
    public init() {}
    public func evaluate(context: Layer2MissionContext) async -> Layer2ModuleOutput {
        Layer2ModuleOutput(moduleId: Self.moduleId, primaryMetric: Double(context.cnsr) / 100)
    }
}

public struct TitanModule115_ConcentrationFatigue: TitanLayer2Module {
    public static let moduleId = 115
    public static let displayName = "Fatiga de concentración"
    public init() {}
    public func evaluate(context: Layer2MissionContext) async -> Layer2ModuleOutput {
        Layer2ModuleOutput(moduleId: Self.moduleId, primaryMetric: Double(100 - context.cnsr) / 100, flags: ["attention_rt_task"])
    }
}
