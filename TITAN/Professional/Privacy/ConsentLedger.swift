import Foundation

/// Registro de consentimiento explícito (biometría, telemetría, entrenamiento de modelos con datos anonimizados).
public struct ConsentSnapshot: Sendable, Codable, Equatable {
    public var biometricProcessingAccepted: Bool
    public var telemetryToBackendAccepted: Bool
    public var anonymousModelTrainingAccepted: Bool
    public var exportRequested: Bool
    public var revokedAtEpochMs: Int64?

    public init(
        biometricProcessingAccepted: Bool = false,
        telemetryToBackendAccepted: Bool = false,
        anonymousModelTrainingAccepted: Bool = false,
        exportRequested: Bool = false,
        revokedAtEpochMs: Int64? = nil
    ) {
        self.biometricProcessingAccepted = biometricProcessingAccepted
        self.telemetryToBackendAccepted = telemetryToBackendAccepted
        self.anonymousModelTrainingAccepted = anonymousModelTrainingAccepted
        self.exportRequested = exportRequested
        self.revokedAtEpochMs = revokedAtEpochMs
    }
}

public protocol ConsentLedgering: Sendable {
    func currentSnapshot() async -> ConsentSnapshot
    func update(_ snapshot: ConsentSnapshot) async throws
    /// Historial estándar para portabilidad (JSON agregado por el host desde SQLite / Health export).
    func buildExportPayload() async throws -> Data
}

public actor InMemoryConsentLedger: ConsentLedgering {
    private var snapshot = ConsentSnapshot()

    public init() {}

    public func currentSnapshot() async -> ConsentSnapshot {
        snapshot
    }

    public func update(_ snapshot: ConsentSnapshot) async throws {
        self.snapshot = snapshot
    }

    public func buildExportPayload() async throws -> Data {
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
        return try encoder.encode(snapshot)
    }
}
