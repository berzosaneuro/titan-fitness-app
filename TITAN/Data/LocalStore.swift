import Foundation

/// Telemetría local + cola de sync (Core Data / SwiftData en app host).
public protocol TelemetryStoring: Sendable {
    func append(samples: [SensorSample]) async throws
    func flushPending() async throws
}

public actor LocalStore: TelemetryStoring {
    private var buffer: [SensorSample] = []

    public init() {}

    public func append(samples: [SensorSample]) async throws {
        buffer.append(contentsOf: samples)
    }

    public func flushPending() async throws {
        // STUB: persistir y/o POST al backend
        buffer.removeAll(keepingCapacity: true)
    }
}
