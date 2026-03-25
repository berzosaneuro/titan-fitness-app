import Foundation
import SQLite3

public enum ProfessionalDiagnosticsStoreError: Error, Sendable {
    case sqliteOpenFailed(String?)
    case sqlitePrepareFailed(String?)
    case sqliteExecFailed(String?)
    case missingSchemaResource
}

/// Persistencia transaccional de diagnósticos; el host programa copias del archivo para respaldo (Time Machine / contenedor).
public final class ProfessionalDiagnosticsStore: @unchecked Sendable {
    private let lock = NSLock()
    private var db: OpaquePointer?

    public init(databasePath: String) throws {
        var ptr: OpaquePointer?
        let flags = SQLITE_OPEN_READWRITE | SQLITE_OPEN_CREATE | SQLITE_OPEN_FULLMUTEX
        let rc = sqlite3_open_v2(databasePath, &ptr, flags, nil)
        guard rc == SQLITE_OK, let handle = ptr else {
            let msg = ptr.map { String(cString: sqlite3_errmsg($0)) }
            if let p = ptr { sqlite3_close(p) }
            throw ProfessionalDiagnosticsStoreError.sqliteOpenFailed(msg)
        }
        db = handle
        try applySchema()
    }

    deinit {
        lock.lock()
        if let d = db {
            sqlite3_close(d)
            db = nil
        }
        lock.unlock()
    }

    public func insert(_ record: MissionDiagnosticRecord) throws {
        lock.lock()
        defer { lock.unlock() }
        guard let d = db else { throw ProfessionalDiagnosticsStoreError.sqliteOpenFailed("closed") }
        let sql = """
        INSERT INTO mission_diagnostics (event_uuid, epoch_ms, category, code, severity, payload_json)
        VALUES (?, ?, ?, ?, ?, ?);
        """
        var stmt: OpaquePointer?
        guard sqlite3_prepare_v2(d, sql, -1, &stmt, nil) == SQLITE_OK, let st = stmt else {
            throw ProfessionalDiagnosticsStoreError.sqlitePrepareFailed(String(cString: sqlite3_errmsg(d)))
        }
        defer { sqlite3_finalize(st) }

        let uuidStr = record.id.uuidString
        sqlite3_bind_text(st, 1, uuidStr, -1, SQLITE_TRANSIENT)
        sqlite3_bind_int64(st, 2, record.epochMs)
        sqlite3_bind_text(st, 3, record.category, -1, SQLITE_TRANSIENT)
        sqlite3_bind_text(st, 4, record.code, -1, SQLITE_TRANSIENT)
        sqlite3_bind_text(st, 5, record.severity.rawValue, -1, SQLITE_TRANSIENT)
        sqlite3_bind_text(st, 6, record.payloadJSON, -1, SQLITE_TRANSIENT)

        guard sqlite3_step(st) == SQLITE_DONE else {
            throw ProfessionalDiagnosticsStoreError.sqliteExecFailed(String(cString: sqlite3_errmsg(d)))
        }
    }

    private func applySchema() throws {
        guard let d = db else { throw ProfessionalDiagnosticsStoreError.sqliteOpenFailed(nil) }
        let url =
            Bundle.module.url(forResource: "TitanProfessional", withExtension: "sql", subdirectory: "Professional/Persistence")
            ?? Bundle.module.url(forResource: "TitanProfessional", withExtension: "sql")
        guard let resolved = url else {
            throw ProfessionalDiagnosticsStoreError.missingSchemaResource
        }
        let ddl = try String(contentsOf: resolved, encoding: .utf8)
        var errMsg: UnsafeMutablePointer<Int8>?
        defer { sqlite3_free(errMsg) }
        guard sqlite3_exec(d, ddl, nil, nil, &errMsg) == SQLITE_OK else {
            throw ProfessionalDiagnosticsStoreError.sqliteExecFailed(errMsg.map { String(cString: $0) })
        }
    }
}
