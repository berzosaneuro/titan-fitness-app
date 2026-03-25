PRAGMA journal_mode=WAL;
PRAGMA synchronous=FULL;
CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY NOT NULL,
    status TEXT NOT NULL,
    metadata TEXT NOT NULL DEFAULT '{}'
);
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
CREATE INDEX IF NOT EXISTS telemetry_session_synced_idx ON telemetry (session_id, synced);
