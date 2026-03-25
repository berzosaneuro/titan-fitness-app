import Foundation

/// Hoja de ruta de cómputo en borde: Core ML (predominante), BNNS para capas FC/conv ligeras, Metal para pre/post‑procesado y visión.
public enum OnDeviceInferenceBackend: String, Sendable, Codable {
    case coreML
    case metalPerformanceShaders
    case accelerateBNNS
}

/// Metadatos para empaquetado de modelos certificados por misión (versión + backend esperado).
public struct CertifiedModelDescriptor: Sendable, Codable {
    public var missionBinaryVersion: String
    public var modelName: String
    public var preferredBackend: OnDeviceInferenceBackend
    public var maxLatencyBudgetMs: Int

    public init(
        missionBinaryVersion: String,
        modelName: String,
        preferredBackend: OnDeviceInferenceBackend = .coreML,
        maxLatencyBudgetMs: Int = 100
    ) {
        self.missionBinaryVersion = missionBinaryVersion
        self.modelName = modelName
        self.preferredBackend = preferredBackend
        self.maxLatencyBudgetMs = maxLatencyBudgetMs
    }
}
