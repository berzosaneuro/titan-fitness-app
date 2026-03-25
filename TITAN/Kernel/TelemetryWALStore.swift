import Foundation
import SQLite3

public enum TelemetryWALStoreError: Error, Sendable {
    case openFailed(String?)
    case execFailed(String?)
    case prepareFailed(String?)
    case stepFailed(String?)
}

public final class TelemetryWALStore: @unchecked Sendable {
    private var db: OpaquePointer?
    private let isolation = DispatchQueue(label: "titan.kernel.wal", qos: .userInitiated)

    public static func defaultStoreURL() throws -> URL {
        let fm = FileManager.default
        let base = try fm.url(for: .applicationSupportDirectory, in: .userDomainMask, appropriateFor: nil, create: true)
        let dir = base.appendingPathComponent("TITANKernel", isDirectory: true)
        if !fm.fileExists(atPath: dir.path) {
            try fm.createDirectory(at: dir, withIntermediateDirectories: true)
        }
        return dir.appendingPathComponent("titan_kernel_wal.sqlite3")
    }

    public static func open(url: URL? = nil) throws -> TelemetryWALStore {
        let path = try url ?? defaultStoreURL()
        var ptr: OpaquePointer?
        let flags = SQLITE_OPEN_CREATE | SQLITE_OPEN_READWRITE | SQLITE_OPEN_FULLMUTEX
        let rc = sqlite3_open_v2(path.path, &ptr, flags, nil)
        guard rc == SQLITE_OK, let d = ptr else {
            let msg = ptr.map { String(cString: sqlite3_errmsg($0)) }
            if let p = ptr { sqlite3_close(p) }
            throw TelemetryWALStoreError.openFailed(msg)
        }
        try Self.exec(d, "PRAGMA journal_mode=WAL;")
        try Self.exec(d, "PRAGMA synchronous=FULL;")
        try Self.exec(
            d,
            """
            CREATE TABLE IF NOT EXISTS sessions (
                id TEXT PRIMARY KEY NOT NULL,
                status TEXT NOT NULL,
                metadata TEXT NOT NULL DEFAULT '{}'
            );
            """
        )
        try Self.exec(
            d,
            """
            CREATE TABLE IF NOT EXISTS telemetry (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                session_id TEXT NOT NULL,
                client_side_id TEXT NOT NULL,
                timestamp REAL NOT NULL,
                cnsr REAL NOT NULL,
                ico REAL NOT NULL,
                injury_risk REAL NOT NULL,
                telemetry_json TEXT NOT NULL,
                synced INTEGER NOT NULL DEFAULT 0,
                sync_error TEXT,
                UNIQUE(session_id, client_side_id)
            );
            """
        )
        try Self.exec(d, "CREATE INDEX IF NOT EXISTS telemetry_session_synced_idx ON telemetry (session_id, synced);")
        try Self.migrateSessionsColumnsIfNeeded(d)
        return TelemetryWALStore(db: d)
    }

    private static func sessionsHasColumn(_ d: OpaquePointer, _ column: String) -> Bool {
        var st: OpaquePointer?
        guard sqlite3_prepare_v2(d, "PRAGMA table_info(sessions);", -1, &st, nil) == SQLITE_OK, let stmt = st else {
            return false
        }
        defer { sqlite3_finalize(stmt) }
        while sqlite3_step(stmt) == SQLITE_ROW {
            let name = String(cString: sqlite3_column_text(stmt, 1))
            if name == column { return true }
        }
        return false
    }

    private static func migrateSessionsColumnsIfNeeded(_ d: OpaquePointer) throws {
        if !sessionsHasColumn(d, "sync_verified") {
            try exec(d, "ALTER TABLE sessions ADD COLUMN sync_verified INTEGER NOT NULL DEFAULT 0;")
        }
        if !sessionsHasColumn(d, "last_sync_error") {
            try exec(d, "ALTER TABLE sessions ADD COLUMN last_sync_error TEXT;")
        }
    }

    private init(db: OpaquePointer) {
        self.db = db
    }

    deinit {
        if let d = db {
            sqlite3_close(d)
            db = nil
        }
    }

    private static func exec(_ d: OpaquePointer, _ sql: String) throws {
        var err: UnsafeMutablePointer<CChar>?
        let rc = sqlite3_exec(d, sql, nil, nil, &err)
        if rc != SQLITE_OK {
            let msg = err.map { String(cString: $0) }
            if let e = err { sqlite3_free(e) }
            throw TelemetryWALStoreError.execFailed(msg)
        }
    }

    public func insertSession(id: UUID, status: String, metadataJSON: String) throws {
        try isolation.sync {
            guard let d = db else { throw TelemetryWALStoreError.openFailed("closed") }
            let sql = "INSERT OR REPLACE INTO sessions (id, status, metadata) VALUES (?,?,?);"
            var st: OpaquePointer?
            guard sqlite3_prepare_v2(d, sql, -1, &st, nil) == SQLITE_OK, let stmt = st else {
                throw TelemetryWALStoreError.prepareFailed(String(cString: sqlite3_errmsg(d)))
            }
            defer { sqlite3_finalize(stmt) }
            let us = id.uuidString
            sqlite3_bind_text(stmt, 1, us, -1, SQLITE_TRANSIENT)
            sqlite3_bind_text(stmt, 2, status, -1, SQLITE_TRANSIENT)
            sqlite3_bind_text(stmt, 3, metadataJSON, -1, SQLITE_TRANSIENT)
            let step = sqlite3_step(stmt)
            guard step == SQLITE_DONE else {
                throw TelemetryWALStoreError.stepFailed(String(cString: sqlite3_errmsg(d)))
            }
        }
    }

    public func appendTelemetryFrame(
        sessionId: UUID,
        clientSideId: UUID,
        timestamp: TimeInterval,
        cnsr: Double,
        ico: Double,
        injuryRisk: Double,
        telemetryJSON: String
    ) throws {
        try isolation.sync {
            guard let d = db else { throw TelemetryWALStoreError.openFailed("closed") }
            let sql = """
            INSERT OR IGNORE INTO telemetry (
                session_id, client_side_id, timestamp, cnsr, ico, injury_risk, telemetry_json, synced, sync_error
            ) VALUES (?,?,?,?,?,?,?,0,NULL);
            """
            var st: OpaquePointer?
            guard sqlite3_prepare_v2(d, sql, -1, &st, nil) == SQLITE_OK, let stmt = st else {
                throw TelemetryWALStoreError.prepareFailed(String(cString: sqlite3_errmsg(d)))
            }
            defer { sqlite3_finalize(stmt) }
            let sid = sessionId.uuidString
            let cid = clientSideId.uuidString
            sqlite3_bind_text(stmt, 1, sid, -1, SQLITE_TRANSIENT)
            sqlite3_bind_text(stmt, 2, cid, -1, SQLITE_TRANSIENT)
            sqlite3_bind_double(stmt, 3, timestamp)
            sqlite3_bind_double(stmt, 4, cnsr)
            sqlite3_bind_double(stmt, 5, ico)
            sqlite3_bind_double(stmt, 6, injuryRisk)
            sqlite3_bind_text(stmt, 7, telemetryJSON, -1, SQLITE_TRANSIENT)
            let step = sqlite3_step(stmt)
            guard step == SQLITE_DONE else {
                throw TelemetryWALStoreError.stepFailed(String(cString: sqlite3_errmsg(d)))
            }
        }
    }

    public struct PendingRow: Sendable {
        public let id: Int64
        public let sessionId: String
        public let clientSideId: String
        public let timestamp: TimeInterval
        public let cnsr: Double
        public let ico: Double
        public let injuryRisk: Double
        public let telemetryJSON: String
    }

    public func fetchPending(limit: Int) throws -> [PendingRow] {
        try isolation.sync {
            guard let d = db else { throw TelemetryWALStoreError.openFailed("closed") }
            let sql = """
            SELECT id, session_id, client_side_id, timestamp, cnsr, ico, injury_risk, telemetry_json
            FROM telemetry WHERE synced = 0 ORDER BY id ASC LIMIT ?;
            """
            var st: OpaquePointer?
            guard sqlite3_prepare_v2(d, sql, -1, &st, nil) == SQLITE_OK, let stmt = st else {
                throw TelemetryWALStoreError.prepareFailed(String(cString: sqlite3_errmsg(d)))
            }
            defer { sqlite3_finalize(stmt) }
            sqlite3_bind_int(stmt, 1, Int32(limit))
            var out: [PendingRow] = []
            while sqlite3_step(stmt) == SQLITE_ROW {
                let rowId = sqlite3_column_int64(stmt, 0)
                let sid = String(cString: sqlite3_column_text(stmt, 1))
                let cid = String(cString: sqlite3_column_text(stmt, 2))
                let ts = sqlite3_column_double(stmt, 3)
                let cnsr = sqlite3_column_double(stmt, 4)
                let ico = sqlite3_column_double(stmt, 5)
                let ir = sqlite3_column_double(stmt, 6)
                let tj = String(cString: sqlite3_column_text(stmt, 7))
                out.append(PendingRow(id: rowId, sessionId: sid, clientSideId: cid, timestamp: ts, cnsr: cnsr, ico: ico, injuryRisk: ir, telemetryJSON: tj))
            }
            return out
        }
    }

    public func markSynced(rowIds: [Int64]) throws {
        try isolation.sync {
            guard let d = db else { throw TelemetryWALStoreError.openFailed("closed") }
            for rid in rowIds {
                let sql = "UPDATE telemetry SET synced = 1, sync_error = NULL WHERE id = ?;"
                var st: OpaquePointer?
                guard sqlite3_prepare_v2(d, sql, -1, &st, nil) == SQLITE_OK, let stmt = st else {
                    throw TelemetryWALStoreError.prepareFailed(String(cString: sqlite3_errmsg(d)))
                }
                defer { sqlite3_finalize(stmt) }
                sqlite3_bind_int64(stmt, 1, rid)
                guard sqlite3_step(stmt) == SQLITE_DONE else {
                    throw TelemetryWALStoreError.stepFailed(String(cString: sqlite3_errmsg(d)))
                }
            }
        }
    }

    public func markSyncError(rowIds: [Int64], message: String) throws {
        try isolation.sync {
            guard let d = db else { throw TelemetryWALStoreError.openFailed("closed") }
            for rid in rowIds {
                let sql = "UPDATE telemetry SET sync_error = ? WHERE id = ?;"
                var st: OpaquePointer?
                guard sqlite3_prepare_v2(d, sql, -1, &st, nil) == SQLITE_OK, let stmt = st else {
                    throw TelemetryWALStoreError.prepareFailed(String(cString: sqlite3_errmsg(d)))
                }
                defer { sqlite3_finalize(stmt) }
                sqlite3_bind_text(stmt, 1, message, -1, SQLITE_TRANSIENT)
                sqlite3_bind_int64(stmt, 2, rid)
                guard sqlite3_step(stmt) == SQLITE_DONE else {
                    throw TelemetryWALStoreError.stepFailed(String(cString: sqlite3_errmsg(d)))
                }
            }
        }
    }

    public func distinctPendingSessionIds() throws -> [String] {
        try isolation.sync {
            guard let d = db else { throw TelemetryWALStoreError.openFailed("closed") }
            let sql = "SELECT DISTINCT session_id FROM telemetry WHERE synced = 0;"
            var st: OpaquePointer?
            guard sqlite3_prepare_v2(d, sql, -1, &st, nil) == SQLITE_OK, let stmt = st else {
                throw TelemetryWALStoreError.prepareFailed(String(cString: sqlite3_errmsg(d)))
            }
            defer { sqlite3_finalize(stmt) }
            var ids: [String] = []
            while sqlite3_step(stmt) == SQLITE_ROW {
                ids.append(String(cString: sqlite3_column_text(stmt, 0)))
            }
            return ids
        }
    }

    public func readSessionRow(id: String) throws -> (status: String, metadata: String)? {
        try isolation.sync {
            guard let d = db else { throw TelemetryWALStoreError.openFailed("closed") }
            let sql = "SELECT status, metadata FROM sessions WHERE id = ? LIMIT 1;"
            var st: OpaquePointer?
            guard sqlite3_prepare_v2(d, sql, -1, &st, nil) == SQLITE_OK, let stmt = st else {
                throw TelemetryWALStoreError.prepareFailed(String(cString: sqlite3_errmsg(d)))
            }
            defer { sqlite3_finalize(stmt) }
            sqlite3_bind_text(stmt, 1, id, -1, SQLITE_TRANSIENT)
            guard sqlite3_step(stmt) == SQLITE_ROW else { return nil }
            let stt = String(cString: sqlite3_column_text(stmt, 0))
            let meta = String(cString: sqlite3_column_text(stmt, 1))
            return (stt, meta)
        }
    }

    public func countPendingTotal() throws -> Int {
        try isolation.sync {
            guard let d = db else { throw TelemetryWALStoreError.openFailed("closed") }
            let sql = "SELECT COUNT(*) FROM telemetry WHERE synced = 0;"
            var st: OpaquePointer?
            guard sqlite3_prepare_v2(d, sql, -1, &st, nil) == SQLITE_OK, let stmt = st else {
                throw TelemetryWALStoreError.prepareFailed(String(cString: sqlite3_errmsg(d)))
            }
            defer { sqlite3_finalize(stmt) }
            guard sqlite3_step(stmt) == SQLITE_ROW else {
                throw TelemetryWALStoreError.stepFailed("countPending")
            }
            return Int(sqlite3_column_int64(stmt, 0))
        }
    }

    public func sessionIdsWithTelemetry() throws -> [UUID] {
        try isolation.sync {
            guard let d = db else { throw TelemetryWALStoreError.openFailed("closed") }
            let sql = "SELECT DISTINCT session_id FROM telemetry;"
            var st: OpaquePointer?
            guard sqlite3_prepare_v2(d, sql, -1, &st, nil) == SQLITE_OK, let stmt = st else {
                throw TelemetryWALStoreError.prepareFailed(String(cString: sqlite3_errmsg(d)))
            }
            defer { sqlite3_finalize(stmt) }
            var out: [UUID] = []
            while sqlite3_step(stmt) == SQLITE_ROW {
                let s = String(cString: sqlite3_column_text(stmt, 0))
                if let u = UUID(uuidString: s) { out.append(u) }
            }
            return out
        }
    }

    public func markSessionVerified(sessionId: UUID) throws {
        try isolation.sync {
            guard let d = db else { throw TelemetryWALStoreError.openFailed("closed") }
            let sql = "UPDATE sessions SET sync_verified = 1, last_sync_error = NULL WHERE id = ?;"
            var st: OpaquePointer?
            guard sqlite3_prepare_v2(d, sql, -1, &st, nil) == SQLITE_OK, let stmt = st else {
                throw TelemetryWALStoreError.prepareFailed(String(cString: sqlite3_errmsg(d)))
            }
            defer { sqlite3_finalize(stmt) }
            let sid = sessionId.uuidString
            sqlite3_bind_text(stmt, 1, sid, -1, SQLITE_TRANSIENT)
            guard sqlite3_step(stmt) == SQLITE_DONE else {
                throw TelemetryWALStoreError.stepFailed(String(cString: sqlite3_errmsg(d)))
            }
        }
    }

    public func setSessionLastSyncError(sessionId: UUID, message: String) throws {
        try isolation.sync {
            guard let d = db else { throw TelemetryWALStoreError.openFailed("closed") }
            let sql = "UPDATE sessions SET last_sync_error = ? WHERE id = ?;"
            var st: OpaquePointer?
            guard sqlite3_prepare_v2(d, sql, -1, &st, nil) == SQLITE_OK, let stmt = st else {
                throw TelemetryWALStoreError.prepareFailed(String(cString: sqlite3_errmsg(d)))
            }
            defer { sqlite3_finalize(stmt) }
            sqlite3_bind_text(stmt, 1, message, -1, SQLITE_TRANSIENT)
            sqlite3_bind_text(stmt, 2, sessionId.uuidString, -1, SQLITE_TRANSIENT)
            guard sqlite3_step(stmt) == SQLITE_DONE else {
                throw TelemetryWALStoreError.stepFailed(String(cString: sqlite3_errmsg(d)))
            }
        }
    }

    public func updateLocalSessionStatus(sessionId: UUID, status: String) throws {
        try isolation.sync {
            guard let d = db else { throw TelemetryWALStoreError.openFailed("closed") }
            let sql = "UPDATE sessions SET status = ? WHERE id = ?;"
            var st: OpaquePointer?
            guard sqlite3_prepare_v2(d, sql, -1, &st, nil) == SQLITE_OK, let stmt = st else {
                throw TelemetryWALStoreError.prepareFailed(String(cString: sqlite3_errmsg(d)))
            }
            defer { sqlite3_finalize(stmt) }
            sqlite3_bind_text(stmt, 1, status, -1, SQLITE_TRANSIENT)
            sqlite3_bind_text(stmt, 2, sessionId.uuidString, -1, SQLITE_TRANSIENT)
            guard sqlite3_step(stmt) == SQLITE_DONE else {
                throw TelemetryWALStoreError.stepFailed(String(cString: sqlite3_errmsg(d)))
            }
        }
    }

    public func countSynced(sessionId: UUID) throws -> Int {
        try isolation.sync {
            guard let d = db else { throw TelemetryWALStoreError.openFailed("closed") }
            let sql = "SELECT COUNT(*) FROM telemetry WHERE session_id = ? AND synced = 1;"
            var st: OpaquePointer?
            guard sqlite3_prepare_v2(d, sql, -1, &st, nil) == SQLITE_OK, let stmt = st else {
                throw TelemetryWALStoreError.prepareFailed(String(cString: sqlite3_errmsg(d)))
            }
            defer { sqlite3_finalize(stmt) }
            let sid = sessionId.uuidString
            sqlite3_bind_text(stmt, 1, sid, -1, SQLITE_TRANSIENT)
            guard sqlite3_step(stmt) == SQLITE_ROW else {
                throw TelemetryWALStoreError.stepFailed("count")
            }
            return Int(sqlite3_column_int64(stmt, 0))
        }
    }
}
