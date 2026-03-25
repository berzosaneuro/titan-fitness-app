import Foundation

public protocol SubsystemHealthProviding: Sendable {
    /// Instantánea coherente para el tick actual; debe ser rápida (sin E/S pesada en hilo crítico si el host cachea).
    func snapshot() async -> MissionSubsystemSnapshot
}

/// Stub predecible: todo nominal hasta que la app inyecte un proveedor con Reachability / callbacks reales.
public struct DefaultSubsystemHealthProvider: SubsystemHealthProviding {
    public init() {}

    public func snapshot() async -> MissionSubsystemSnapshot {
        MissionSubsystemSnapshot.nominal
    }
}

/// Para pruebas o simulación de fallos (inyección de dependencias).
public struct ConfigurableSubsystemHealthProvider: SubsystemHealthProviding {
    public var snapshotValue: MissionSubsystemSnapshot

    public init(snapshotValue: MissionSubsystemSnapshot = .nominal) {
        self.snapshotValue = snapshotValue
    }

    public func snapshot() async -> MissionSubsystemSnapshot {
        snapshotValue
    }
}
