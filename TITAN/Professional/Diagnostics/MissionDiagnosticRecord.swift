import Foundation

/// Evento de diagnóstico interno (latencia, sensores, seguridad). Serializable a JSON / SQLite / telemetría TLS 1.3.
public struct MissionDiagnosticRecord: Sendable, Codable, Equatable {
    public var id: UUID
    public var epochMs: Int64
    public var category: String
    public var code: String
    public var severity: Severity
    public var payloadJSON: String

    public enum Severity: String, Sendable, Codable {
        case debug, info, warning, error, security
    }

    public init(
        id: UUID = UUID(),
        epochMs: Int64 = Int64(Date().timeIntervalSince1970 * 1000),
        category: String,
        code: String,
        severity: Severity = .info,
        payloadJSON: String = "{}"
    ) {
        self.id = id
        self.epochMs = epochMs
        self.category = category
        self.code = code
        self.severity = severity
        self.payloadJSON = payloadJSON
    }
}

public enum MissionDiagnosticCodes {
    public static let latencyTickMs = "LATENCY_TICK_MS"
    public static let latencyBudgetVisual = "LATENCY_BUDGET_VISUAL_100MS"
    public static let latencyBudgetCritical = "LATENCY_BUDGET_CRITICAL_300MS"
    public static let sensorIncoherence = "SENSOR_INCOHERENCE"
    public static let subsystemDegraded = "SUBSYSTEM_DEGRADED"
    public static let dmsTriggered = "DMS_TRIGGERED"
    public static let microAdjustment = "MICRO_ADJUSTMENT"
}
