-- TITAN iOS 2.0 · Capa 2 — persistencia agregada fatiga/estrés/control (SQLite)
-- Ejecutado al abrir almacén; índices para consultas por sesión y módulo.

PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS layer2_module_outputs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    athlete_id TEXT NOT NULL,
    session_id TEXT NOT NULL,
    module_id INTEGER NOT NULL CHECK (module_id >= 101 AND module_id <= 150),
    epoch_ms INTEGER NOT NULL,
    primary_metric REAL NOT NULL,
    confidence REAL NOT NULL,
    flags_json TEXT NOT NULL,
    coach_hint TEXT NOT NULL,
    telemetry_json TEXT NOT NULL,
    cnsr INTEGER,
    ico INTEGER,
    injury_risk INTEGER,
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_layer2_session_epoch ON layer2_module_outputs(session_id, epoch_ms);
CREATE INDEX IF NOT EXISTS idx_layer2_athlete_epoch ON layer2_module_outputs(athlete_id, epoch_ms);
CREATE INDEX IF NOT EXISTS idx_layer2_module_epoch ON layer2_module_outputs(module_id, epoch_ms);
