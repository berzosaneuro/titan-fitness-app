import Foundation

/// Registro central módulos 101–150. Invocación por `moduleId` sin reflexión; compatible con presupuesto de latencia de misión.
public enum TitanLayer2Registry {
    public static let allModuleIds: [Int] = Array(101 ... 150)

    public static func evaluate(moduleId: Int, context: Layer2MissionContext) async -> Layer2ModuleOutput? {
        switch moduleId {
        case 101: return await TitanModule101_NeuromuscularFatiguePredictive().evaluate(context: context)
        case 102: return await TitanModule102_CognitiveFatigue().evaluate(context: context)
        case 103: return await TitanModule103_VisualFatigueComputed().evaluate(context: context)
        case 104: return await TitanModule104_GlobalPhysiologicalStress().evaluate(context: context)
        case 105: return await TitanModule105_MoodSelfReport().evaluate(context: context)
        case 106: return await TitanModule106_PriorInjuries().evaluate(context: context)
        case 107: return await TitanModule107_ChronicFatigueSignals().evaluate(context: context)
        case 108: return await TitanModule108_EnvironmentalStressOutsider().evaluate(context: context)
        case 109: return await TitanModule109_PosturalStability().evaluate(context: context)
        case 110: return await TitanModule110_RespiratoryResistance().evaluate(context: context)
        case 111: return await TitanModule111_EnergeticStress().evaluate(context: context)
        case 112: return await TitanModule112_LocalMuscularFatigue().evaluate(context: context)
        case 113: return await TitanModule113_GlobalFatigueIndex().evaluate(context: context)
        case 114: return await TitanModule114_RecoveryCapacity().evaluate(context: context)
        case 115: return await TitanModule115_ConcentrationFatigue().evaluate(context: context)
        case 116: return await TitanModule116_CadenceControl().evaluate(context: context)
        case 117: return await TitanModule117_ForceControl().evaluate(context: context)
        case 118: return await TitanModule118_VelocityControl().evaluate(context: context)
        case 119: return await TitanModule119_PowerControl().evaluate(context: context)
        case 120: return await TitanModule120_TechniqueControl().evaluate(context: context)
        case 121: return await TitanModule121_ForceIsometricControl().evaluate(context: context)
        case 122: return await TitanModule122_ForcePlyometricControl().evaluate(context: context)
        case 123: return await TitanModule123_ForceEccentricControl().evaluate(context: context)
        case 124: return await TitanModule124_ForceConcentricControl().evaluate(context: context)
        case 125: return await TitanModule125_ForceTransitionControl().evaluate(context: context)
        case 126: return await TitanModule126_TransitionVelocityIsometric().evaluate(context: context)
        case 127: return await TitanModule127_TransitionVelocityPlyometric().evaluate(context: context)
        case 128: return await TitanModule128_TransitionVelocityEccentric().evaluate(context: context)
        case 129: return await TitanModule129_TransitionVelocityConcentric().evaluate(context: context)
        case 130: return await TitanModule130_InterExerciseTransitionControl().evaluate(context: context)
        case 131: return await TitanModule131_RecoveryRealtimeControl().evaluate(context: context)
        case 132: return await TitanModule132_HydrationRealtimeControl().evaluate(context: context)
        case 133: return await TitanModule133_NutritionRealtimeControl().evaluate(context: context)
        case 134: return await TitanModule134_RestRealtimeControl().evaluate(context: context)
        case 135: return await TitanModule135_InjuryRealtimeControl().evaluate(context: context)
        case 136: return await TitanModule136_MotorCoordinationAdaptiveCoach().evaluate(context: context)
        case 137: return await TitanModule137_StabilityAdaptiveCoach().evaluate(context: context)
        case 138: return await TitanModule138_FlexibilityAdaptiveCoach().evaluate(context: context)
        case 139: return await TitanModule139_StabilizerStrengthAdaptiveCoach().evaluate(context: context)
        case 140: return await TitanModule140_CoordinationPatternAdaptiveCoach().evaluate(context: context)
        case 141: return await TitanModule141_FlexibilitySequenceAdaptiveCoach().evaluate(context: context)
        case 142: return await TitanModule142_RecoveryAdaptiveCoach().evaluate(context: context)
        case 143: return await TitanModule143_InjuryPreventionAdaptiveCoach().evaluate(context: context)
        case 144: return await TitanModule144_HolisticMotorAdaptiveCoach().evaluate(context: context)
        case 145: return await TitanModule145_PeriodizationMicroAdaptiveCoach().evaluate(context: context)
        case 146: return await TitanModule146_InjuryRehabAdaptiveCoach().evaluate(context: context)
        case 147: return await TitanModule147_ResilienceStrengthAdaptiveCoach().evaluate(context: context)
        case 148: return await TitanModule148_NeuromotorSyncAdaptiveCoach().evaluate(context: context)
        case 149: return await TitanModule149_MobilityMaintenanceAdaptiveCoach().evaluate(context: context)
        case 150: return await TitanModule150_RecoveryIntegrityAdaptiveCoach().evaluate(context: context)
        default: return nil
        }
    }

    public static func evaluateRange(_ range: ClosedRange<Int>, context: Layer2MissionContext) async -> [Layer2ModuleOutput] {
        var results: [Layer2ModuleOutput] = []
        for id in range {
            if let o = await evaluate(moduleId: id, context: context) {
                results.append(o)
            }
        }
        return results
    }

    public static func evaluateAll(context: Layer2MissionContext) async -> [Layer2ModuleOutput] {
        await evaluateRange(101 ... 150, context: context)
    }
}
