import Foundation

/// Contrato para telemetría central (TLS 1.3 en la capa URLSession del host).
public protocol RemoteTelemetryUploading: Sendable {
    func uploadDiagnosticsBatch(_ records: [MissionDiagnosticRecord]) async throws
}

/// Implementación de referencia: POST JSON; el host configura `URLSession` con TLS mínimo 1.3 y pinning si aplica.
public struct HTTPSJSONDiagnosticsSink: RemoteTelemetryUploading {
    public var endpoint: URL
    public var urlSession: URLSession

    public init(endpoint: URL, urlSession: URLSession = .shared) {
        self.endpoint = endpoint
        self.urlSession = urlSession
    }

    public func uploadDiagnosticsBatch(_ records: [MissionDiagnosticRecord]) async throws {
        var request = URLRequest(url: endpoint)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONEncoder().encode(records)
        let (_, response) = try await urlSession.data(for: request)
        guard let http = response as? HTTPURLResponse, (200 ... 299).contains(http.statusCode) else {
            throw URLError(.badServerResponse)
        }
    }
}
