import Foundation
import SQLite3

public enum Layer2MetricStoreError: Error, Sendable {
    case sqliteOpenFailed(String?)
    case sqlitePrepareFailed(String?)
    case sqliteExecFailed(String?)
    case missingSchemaResource
}

/// Almacén SQLite para salidas de módulos 101–150; hilo seguro con bloqueo interno.
public final class Layer2MetricStore: @unchecked Sendable {
    private let lock = NSLock()
    private var db: OpaquePointer?

    public init(databasePath: String) throws {
        var ptr: OpaquePointer?
        let flags = SQLITE_OPEN_READWRITE | SQLITE_OPEN_CREATE | SQLITE_OPEN_FULLMUTEX
        let rc = sqlite3_open_v2(databasePath, &ptr, flags, nil)
        guard rc == SQLITE_OK, let handle = ptr else {
            let msg = ptr.map { String(cString: sqlite3_errmsg($0)) }
            if let p = ptr { sqlite3_close(p) }
            throw Layer2MetricStoreError.sqliteOpenFailed(msg)
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

    public func persist(output: Layer2ModuleOutput, context: Layer2MissionContext) throws {
        lock.lock()
        defer { lock.unlock() }
        guard let d = db else { throw Layer2MetricStoreError.sqliteOpenFailed("closed") }

        let sql = """
        INSERT INTO layer2_module_outputs (
          athlete_id, session_id, module_id, epoch_ms,
          primary_metric, confidence, flags_json, coach_hint, telemetry_json,
          cnsr, ico, injury_risk
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
        """
        var stmt: OpaquePointer?
        guard sqlite3_prepare_v2(d, sql, -1, &stmt, nil) == SQLITE_OK, let st = stmt else {
            throw Layer2MetricStoreError.sqlitePrepareFailed(String(cString: sqlite3_errmsg(d)))
        }
        defer { sqlite3_finalize(st) }

        let flagsData = try JSONEncoder().encode(output.flags)
        let flagsJson = String(data: flagsData, encoding: .utf8) ?? "[]"

        sqlite3_bind_text(st, 1, context.athleteId, -1, SQLITE_TRANSIENT)
        sqlite3_bind_text(st, 2, context.sessionId, -1, SQLITE_TRANSIENT)
        sqlite3_bind_int(st, 3, Int32(output.moduleId))
        sqlite3_bind_int64(st, 4, Int64(min(context.epochMs, UInt64(Int64.max))))
        sqlite3_bind_double(st, 5, output.primaryMetric)
        sqlite3_bind_double(st, 6, output.confidence)
        sqlite3_bind_text(st, 7, flagsJson, -1, SQLITE_TRANSIENT)
        sqlite3_bind_text(st, 8, output.coachHint, -1, SQLITE_TRANSIENT)
        sqlite3_bind_text(st, 9, output.telemetryJSON, -1, SQLITE_TRANSIENT)
        sqlite3_bind_int(st, 10, Int32(context.cnsr))
        sqlite3_bind_int(st, 11, Int32(context.ico))
        sqlite3_bind_int(st, 12, Int32(context.injuryRisk))

        guard sqlite3_step(st) == SQLITE_DONE else {
            throw Layer2MetricStoreError.sqliteExecFailed(String(cString: sqlite3_errmsg(d)))
        }
    }

    private func applySchema() throws {
        guard let d = db else { throw Layer2MetricStoreError.sqliteOpenFailed(nil) }
        let url =
            Bundle.module.url(forResource: "TitanLayer2", withExtension: "sql", subdirectory: "Layer2/Persistence")
            ?? Bundle.module.url(forResource: "TitanLayer2", withExtension: "sql")
        guard let resolved = url else {
            throw Layer2MetricStoreError.missingSchemaResource
        }
        let ddl = try String(contentsOf: resolved, encoding: .utf8)
        var errMsg: UnsafeMutablePointer<Int8>?
        defer { sqlite3_free(errMsg) }
        guard sqlite3_exec(d, ddl, nil, nil, &errMsg) == SQLITE_OK else {
            let msg = errMsg.map { String(cString: $0) }
            throw Layer2MetricStoreError.sqliteExecFailed(msg)
        }
    }
}
