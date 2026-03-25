import Foundation

public protocol MissionDiagnosticsRecording: AnyObject, Sendable {
    func record(_ event: MissionDiagnosticRecord)
}

/// Registro en memoria acotado + opcional persistencia asíncrona; hilo seguro.
public final class MissionDiagnosticsCenter: MissionDiagnosticsRecording, @unchecked Sendable {
    public let maxBufferedEvents: Int
    private let lock = NSLock()
    private var buffer: [MissionDiagnosticRecord] = []
    /// Retenido explícitamente si se inyecta; el host puede compartir la misma instancia entre componentes.
    private var sqlSink: ProfessionalDiagnosticsStore?

    public init(maxBufferedEvents: Int = 2_048, sqlSink: ProfessionalDiagnosticsStore? = nil) {
        self.maxBufferedEvents = maxBufferedEvents
        self.sqlSink = sqlSink
    }

    public func attachSQLSink(_ sink: ProfessionalDiagnosticsStore?) {
        lock.lock()
        sqlSink = sink
        lock.unlock()
    }

    public func record(_ event: MissionDiagnosticRecord) {
        lock.lock()
        buffer.append(event)
        if buffer.count > maxBufferedEvents {
            buffer.removeFirst(buffer.count - maxBufferedEvents)
        }
        let sink = sqlSink
        lock.unlock()

        guard let sink else { return }
        DispatchQueue.global(qos: .utility).async {
            try? sink.insert(event)
        }
    }

    public func recentCopy() -> [MissionDiagnosticRecord] {
        lock.lock()
        let c = buffer
        lock.unlock()
        return c
    }
}
