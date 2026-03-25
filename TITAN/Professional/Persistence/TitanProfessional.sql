-- TITAN iOS · capa profesional — diagnósticos y consentimiento (SQLite, integridad WAL)

PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS mission_diagnostics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_uuid TEXT NOT NULL UNIQUE,
    epoch_ms INTEGER NOT NULL,
    category TEXT NOT NULL,
    code TEXT NOT NULL,
    severity TEXT NOT NULL,
    payload_json TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_diag_epoch ON mission_diagnostics(epoch_ms);
CREATE INDEX IF NOT EXISTS idx_diag_code ON mission_diagnostics(code);

CREATE TABLE IF NOT EXISTS consent_snapshot (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    json_blob TEXT NOT NULL,
    updated_epoch_ms INTEGER NOT NULL
);
