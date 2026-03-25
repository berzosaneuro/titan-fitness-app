import Foundation

/// Patrón adaptador: sensores de terceros (EMG, plataformas de fuerza, potenciómetros) → `SensorSample` unificado.
public protocol ThirdPartySensorAdapting: Sendable {
    var sourceIdentifier: String { get }
    func mapToSamples(raw: Data, masterTimestampMs: UInt64) throws -> [SensorSample]
}

/// Registro de adaptadores por identificador de fabricante / UUID de servicio BLE.
public struct SensorAdapterRegistry: Sendable {
    private let adapters: [String: any ThirdPartySensorAdapting]

    public init(adapters: [String: any ThirdPartySensorAdapting]) {
        self.adapters = adapters
    }

    public func adapter(for identifier: String) -> (any ThirdPartySensorAdapting)? {
        adapters[identifier]
    }
}
