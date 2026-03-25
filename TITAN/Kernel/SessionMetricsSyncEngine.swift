import Foundation
import os.log

public enum SessionMetricsSyncEngineError: Error, Sendable {
    case noBaseURL
    case noAnonKey
    case noJWTSubject
    case transport(Int)
}

public final class SessionMetricsSyncEngine: @unchecked Sendable {
    public static let shared = SessionMetricsSyncEngine()

    private static let pulseLock = NSLock()
    private static var lastOnlinePulseStorage: Date?

    private let session: URLSession
    private let batchLimit = 32
    private let log = Logger(subsystem: "titan.kernel", category: "sync")
    private init() {
        session = {
            let cfg = URLSessionConfiguration.ephemeral
            cfg.waitsForConnectivity = true
            cfg.timeoutIntervalForRequest = 60
            cfg.timeoutIntervalForResource = 120
            return URLSession(configuration: cfg)
        }()
        _ = MissionReachabilityKernel.shared.addOnlineListener {
            SessionMetricsSyncEngine.recordReachabilityPulseStatic()
        }
    }

    private static func recordReachabilityPulseStatic() {
        pulseLock.lock()
        lastOnlinePulseStorage = Date()
        pulseLock.unlock()
    }

    private func apiRoot() throws -> URL {
        guard let base = SupabaseKernelConfig.baseURL() else { throw SessionMetricsSyncEngineError.noBaseURL }
        var s = base.absoluteString.trimmingCharacters(in: .whitespacesAndNewlines)
        if s.hasSuffix("/") { s.removeLast() }
        guard let u = URL(string: s + "/rest/v1") else { throw SessionMetricsSyncEngineError.noBaseURL }
        return u
    }

    private func authHeaders() throws -> [String: String] {
        let key = SupabaseKernelConfig.anonKey()
        guard !key.isEmpty else { throw SessionMetricsSyncEngineError.noAnonKey }
        let bearer = SupabaseKernelConfig.bearerToken()
        return [
            "apikey": key,
            "Authorization": "Bearer \(bearer)",
            "Content-Type": "application/json",
        ]
    }

    private func requireUserUUID() throws -> UUID {
        guard let u = SupabaseKernelConfig.jwtSubjectUUID() else {
            log.error("missing JWT sub")
            throw SessionMetricsSyncEngineError.noJWTSubject
        }
        return u
    }

    private func backoffSeconds(attempt: Int) -> Double {
        min(30.0, pow(2.0, Double(min(attempt, 5)))) + Double.random(in: 0...0.35)
    }

    private func persistFlushFailure(wal: TelemetryWALStore, message: String) {
        do {
            let ids = try wal.distinctPendingSessionIds()
            for sid in ids {
                guard let u = UUID(uuidString: sid) else { continue }
                try wal.setSessionLastSyncError(sessionId: u, message: message)
            }
            if ids.isEmpty, let any = try? wal.sessionIdsWithTelemetry().first {
                try? wal.setSessionLastSyncError(sessionId: any, message: message)
            }
        } catch {
            log.error("persistFlushFailure failed: \(String(describing: error))")
        }
    }

    public func ensureRemoteSession(sessionId: UUID, status: String, metadataJSON: String) async throws {
        guard MissionReachabilityKernel.shared.isOnline() else { return }
        let uid = try requireUserUUID()
        let root = try apiRoot()
        let url = root.appendingPathComponent("sessions")
        var req = URLRequest(url: url)
        req.httpMethod = "POST"
        var h = try authHeaders()
        h["Prefer"] = "return=minimal,resolution=merge-duplicates"
        h.forEach { req.setValue($0.value, forHTTPHeaderField: $0.key) }
        let metaObj = (try? JSONSerialization.jsonObject(with: Data(metadataJSON.utf8))) ?? [String: String]()
        let row: [String: Any] = [
            "id": sessionId.uuidString,
            "user_id": uid.uuidString,
            "status": status,
            "metadata": metaObj,
        ]
        req.httpBody = try JSONSerialization.data(withJSONObject: [row])
        let (_, resp) = try await session.data(for: req)
        guard let http = resp as? HTTPURLResponse else { throw SessionMetricsSyncEngineError.transport(-1) }
        if (200 ... 299).contains(http.statusCode) || http.statusCode == 409 {
            return
        }
        throw SessionMetricsSyncEngineError.transport(http.statusCode)
    }

    public func remoteMetricCount(sessionId: UUID) async throws -> Int {
        let sid = sessionId.uuidString
        let root = try apiRoot()
        var comp = URLComponents(url: root.appendingPathComponent("session_metrics"), resolvingAgainstBaseURL: false)
        comp?.queryItems = [
            URLQueryItem(name: "session_id", value: "eq.\(sid)"),
            URLQueryItem(name: "select", value: "id"),
        ]
        guard let url = comp?.url else { throw SessionMetricsSyncEngineError.noBaseURL }
        var req = URLRequest(url: url)
        req.httpMethod = "GET"
        var h = try authHeaders()
        h["Prefer"] = "count=exact"
        h.forEach { req.setValue($0.value, forHTTPHeaderField: $0.key) }
        let (_, resp) = try await session.data(for: req)
        guard let http = resp as? HTTPURLResponse else { throw SessionMetricsSyncEngineError.transport(-1) }
        guard (200 ... 299).contains(http.statusCode) else {
            throw SessionMetricsSyncEngineError.transport(http.statusCode)
        }
        let cr = http.value(forHTTPHeaderField: "content-range") ?? ""
        if let r = cr.split(separator: "/").last, let n = Int(r) {
            return n
        }
        return 0
    }

    private func postMetricRow(wal: TelemetryWALStore, row: TelemetryWALStore.PendingRow) async throws -> Int {
        let uid = try requireUserUUID()
        let root = try apiRoot()
        let url = root.appendingPathComponent("session_metrics")
        var req = URLRequest(url: url)
        req.httpMethod = "POST"
        var h = try authHeaders()
        h["Prefer"] = "return=minimal"
        h.forEach { req.setValue($0.value, forHTTPHeaderField: $0.key) }
        let iso = ISO8601DateFormatter()
        iso.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        let tsStr = iso.string(from: Date(timeIntervalSince1970: row.timestamp))
        let tj: Any
        if let d = row.telemetryJSON.data(using: .utf8),
           let j = try? JSONSerialization.jsonObject(with: d)
        {
            tj = j
        } else {
            tj = row.telemetryJSON
        }
        let dict: [String: Any] = [
            "session_id": row.sessionId,
            "user_id": uid.uuidString,
            "client_side_id": row.clientSideId,
            "timestamp": tsStr,
            "cnsr": row.cnsr,
            "ico": row.ico,
            "injury_risk": row.injuryRisk,
            "telemetry_json": tj,
        ]
        req.httpBody = try JSONSerialization.data(withJSONObject: [dict])
        let (_, resp) = try await session.data(for: req)
        guard let http = resp as? HTTPURLResponse else { throw SessionMetricsSyncEngineError.transport(-1) }
        return http.statusCode
    }

    private func sendRowWithRetries(wal: TelemetryWALStore, row: TelemetryWALStore.PendingRow) async throws {
        var attempt = 0
        while attempt < 8 {
            do {
                let code = try await postMetricRow(wal: wal, row: row)
                if code == 201 || code == 204 || code == 200 {
                    try wal.markSynced(rowIds: [row.id])
                    return
                }
                if code == 409 {
                    try wal.markSynced(rowIds: [row.id])
                    return
                }
                if code == 429 || (500 ... 599).contains(code) {
                    let w = backoffSeconds(attempt: attempt)
                    attempt += 1
                    try await Task.sleep(nanoseconds: UInt64(w * 1_000_000_000))
                    continue
                }
                try wal.markSyncError(rowIds: [row.id], message: "http_\(code)")
                log.error("metric row http \(code) id=\(row.id)")
                return
            } catch {
                log.error("metric row error \(String(describing: error)) id=\(row.id)")
                let w = backoffSeconds(attempt: attempt)
                attempt += 1
                if attempt >= 8 {
                    try wal.markSyncError(rowIds: [row.id], message: String(describing: error))
                    return
                }
                try await Task.sleep(nanoseconds: UInt64(w * 1_000_000_000))
            }
        }
    }

    private func drainAllPending(wal: TelemetryWALStore) async throws {
        var rounds = 0
        while MissionReachabilityKernel.shared.isOnline(), rounds < 128 {
            rounds += 1
            let pending = try wal.fetchPending(limit: batchLimit)
            if pending.isEmpty {
                break
            }
            let sessionStrings = try wal.distinctPendingSessionIds()
            for s in sessionStrings {
                guard let u = UUID(uuidString: s) else { continue }
                if let row = try wal.readSessionRow(id: s) {
                    do {
                        try await ensureRemoteSession(sessionId: u, status: row.status, metadataJSON: row.metadata)
                    } catch {
                        log.error("ensureRemoteSession \(String(describing: error))")
                        persistFlushFailure(wal: wal, message: String(describing: error))
                        throw error
                    }
                }
            }
            for row in pending {
                try await sendRowWithRetries(wal: wal, row: row)
            }
        }
    }

    public func flushPending(
        wal: TelemetryWALStore,
        verificationFocus: UUID? = nil,
        onSyncMismatch: @escaping @Sendable (UUID) -> Void,
        onStable: @escaping @Sendable () -> Void
    ) async throws {
        guard MissionReachabilityKernel.shared.isOnline() else {
            log.info("flush skipped offline")
            return
        }
        do {
            try await drainAllPending(wal: wal)
        } catch {
            log.error("drainAllPending \(String(describing: error))")
            persistFlushFailure(wal: wal, message: String(describing: error))
            throw error
        }
        let remaining = try wal.countPendingTotal()
        guard remaining == 0 else {
            log.error("pending after drain: \(remaining)")
            persistFlushFailure(wal: wal, message: "pending_queue_\(remaining)")
            return
        }
        let toCheck: [UUID]
        if let f = verificationFocus {
            toCheck = [f]
        } else {
            toCheck = try wal.sessionIdsWithTelemetry()
        }
        for u in toCheck {
            let localSynced: Int
            do {
                localSynced = try wal.countSynced(sessionId: u)
            } catch {
                log.error("countSynced \(String(describing: error))")
                persistFlushFailure(wal: wal, message: String(describing: error))
                throw error
            }
            let remote: Int
            do {
                remote = try await remoteMetricCount(sessionId: u)
            } catch {
                log.error("remoteMetricCount \(String(describing: error))")
                try wal.setSessionLastSyncError(sessionId: u, message: String(describing: error))
                throw error
            }
            if localSynced == remote {
                try wal.markSessionVerified(sessionId: u)
            } else {
                log.fault("sync mismatch session=\(u.uuidString) local=\(localSynced) remote=\(remote)")
                try wal.setSessionLastSyncError(
                    sessionId: u,
                    message: "integrity local=\(localSynced) remote=\(remote)"
                )
                onSyncMismatch(u)
                return
            }
        }
        onStable()
    }
}
