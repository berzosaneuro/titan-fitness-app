import Foundation

/// Estado observable de subsistemas externos (Watch, cámara, BLE, red, batería). El host reemplaza el proveedor por lecturas reales.
public struct MissionSubsystemSnapshot: Sendable, Equatable {
    public var appleWatchReachable: Bool
    public var cameraOperational: Bool
    public var bleForceReachable: Bool
    public var blePlantarReachable: Bool
    public var networkReachable: Bool
    /// true si la batería del dispositivo está por encima del umbral operativo certificado (p. ej. >20 %).
    public var batteryLevelOK: Bool

    public init(
        appleWatchReachable: Bool = true,
        cameraOperational: Bool = true,
        bleForceReachable: Bool = true,
        blePlantarReachable: Bool = true,
        networkReachable: Bool = true,
        batteryLevelOK: Bool = true
    ) {
        self.appleWatchReachable = appleWatchReachable
        self.cameraOperational = cameraOperational
        self.bleForceReachable = bleForceReachable
        self.blePlantarReachable = blePlantarReachable
        self.networkReachable = networkReachable
        self.batteryLevelOK = batteryLevelOK
    }

    public static let nominal = MissionSubsystemSnapshot()

    /// Contexto para `DecisionEngine`: carga conservadora sin alterar layout (solo texto de estado / micro‑ajuste).
    public var degradationContext: MissionDegradationContext {
        var parts: [String] = []
        var tier = MissionDegradationContext.Tier.nominal

        if !appleWatchReachable {
            parts.append("Watch no disponible · HRV/latidos locales")
            tier = max(tier, .conservative)
        }
        if !cameraOperational {
            parts.append("Cámara off · técnica por sensores inerciales")
            tier = max(tier, .conservative)
        }
        if !bleForceReachable {
            parts.append("Fuerza BLE ausente")
            tier = max(tier, .conservative)
        }
        if !blePlantarReachable {
            parts.append("Plantar ausente")
            tier = max(tier, .conservative)
        }
        if !networkReachable {
            parts.append("Red off · solo edge local")
            tier = max(tier, .conservative)
        }
        if !batteryLevelOK {
            parts.append("Batería baja · modo conservador")
            tier = max(tier, .conservative)
        }
        if !cameraOperational && !bleForceReachable {
            tier = .critical
        }

        let notice = parts.isEmpty ? "" : parts.joined(separator: " · ")
        return MissionDegradationContext(tier: tier, userFacingNotice: notice)
    }
}

public struct MissionDegradationContext: Sendable, Equatable {
    public enum Tier: Int, Sendable, Comparable {
        case nominal = 0
        case conservative = 1
        case critical = 2

        public static func < (a: Tier, b: Tier) -> Bool {
            a.rawValue < b.rawValue
        }
    }

    public var tier: Tier
    public var userFacingNotice: String

    public init(tier: Tier = .nominal, userFacingNotice: String = "") {
        self.tier = tier
        self.userFacingNotice = userFacingNotice
    }

    public static let nominal = MissionDegradationContext()
}
