import Foundation

/// Contrato común módulos 101–150 (TITAN iOS 2.0 · Capa 2). Sin lógica Web Coach.
/// Toda inferencia pesada → Core ML en dispositivo; estos tipos orquestan y exponen salidas al pipeline certificado.
public protocol TitanLayer2Module: Sendable {
    static var moduleId: Int { get }
    static var displayName: String { get }
    /// Evalúa con contexto de sesión / pre‑vuelo; latencia acotada en capa superior (&lt; presupuesto misión).
    func evaluate(context: Layer2MissionContext) async -> Layer2ModuleOutput
}

public struct Layer2MissionContext: Sendable {
    public var athleteId: String
    public var sessionId: String
    public var fused: FusedFeatureVector
    public var cnsr: UInt8
    public var ico: UInt8
    public var injuryRisk: UInt8
    public var manualRPE: Double?
    public var epochMs: UInt64

    public init(
        athleteId: String = "",
        sessionId: String = "",
        fused: FusedFeatureVector = FusedFeatureVector(),
        cnsr: UInt8 = 0,
        ico: UInt8 = 0,
        injuryRisk: UInt8 = 0,
        manualRPE: Double? = nil,
        epochMs: UInt64 = 0
    ) {
        self.athleteId = athleteId
        self.sessionId = sessionId
        self.fused = fused
        self.cnsr = cnsr
        self.ico = ico
        self.injuryRisk = injuryRisk
        self.manualRPE = manualRPE
        self.epochMs = epochMs
    }
}

public struct Layer2ModuleOutput: Sendable {
    public var moduleId: Int
    public var primaryMetric: Double
    public var confidence: Double
    public var flags: [String]
    public var coachHint: String
    /// Payload serializable → SQLite / sync backend (agregados coach).
    public var telemetryJSON: String

    public init(
        moduleId: Int,
        primaryMetric: Double,
        confidence: Double = 0.7,
        flags: [String] = [],
        coachHint: String = "",
        telemetryJSON: String = "{}"
    ) {
        self.moduleId = moduleId
        self.primaryMetric = primaryMetric
        self.confidence = confidence
        self.flags = flags
        self.coachHint = coachHint
        self.telemetryJSON = telemetryJSON
    }
}
