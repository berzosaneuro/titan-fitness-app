/**
 * trainingSession.js — Gestión de sesiones de entrenamiento y notas en Supabase.
 *
 * Tablas asumidas (ver next-prep/ para migraciones):
 *   profiles(id, email, full_name, role, tenant_id, created_at)
 *   training_sessions(id, coach_id, athlete_name, started_at, completed_at, status, notes)
 *   telemetry_samples(id, session_id, athlete_name, coach_id, cnsr, ico, injury_risk, hr, recorded_at)
 *   notes(id, coach_id, athlete_name, session_id, content, created_at)
 *   injuries(id, coach_id, athlete_name, session_id, description, severity, created_at)
 *
 * Si Supabase no está configurado, todas las operaciones devuelven ok:true con datos mock
 * para que la UI no quede bloqueada.
 */

import { tryGetSupabaseClient } from './supabaseClient.js';
import { getCurrentUser } from './auth.js';

// ── Helpers ───────────────────────────────────────────────────────────────────

function getClient() {
    return tryGetSupabaseClient();
}

function coachId() {
    return getCurrentUser()?.id ?? null;
}

/** Genera un UUID v4 simple para usar como ID local cuando Supabase no está disponible. */
function localUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
    });
}

// ── profiles ──────────────────────────────────────────────────────────────────

/**
 * Verifica que existe un perfil en `profiles` para el usuario autenticado.
 * Si no existe, lo crea con los datos de auth.
 */
export async function ensureUserProfile() {
    const client = getClient();
    const user = getCurrentUser();
    if (!client || !user) return;

    try {
        const { data, error } = await client
            .from('profiles')
            .select('id')
            .eq('id', user.id)
            .maybeSingle();

        if (error && error.code !== 'PGRST116') {
            console.warn('[trainingSession] ensureUserProfile select', error.message);
            return;
        }

        if (!data) {
            const { error: insertError } = await client.from('profiles').insert({
                id: user.id,
                email: user.email,
                full_name: user.name || '',
                role: user.role || 'coach',
                tenant_id: user.tenantId || '',
            });
            if (insertError) {
                console.warn('[trainingSession] ensureUserProfile insert', insertError.message);
            }
        }
    } catch (err) {
        console.warn('[trainingSession] ensureUserProfile (throw)', err);
    }
}

// ── training_sessions ─────────────────────────────────────────────────────────

/**
 * Inicia una sesión de entrenamiento.
 * @param {string} athleteName
 * @returns {Promise<{ ok: boolean, sessionId: string, error?: string }>}
 */
export async function startSession(athleteName) {
    const client = getClient();
    const uid = coachId();

    if (!client || !uid) {
        // Sin Supabase: sesión local
        return { ok: true, sessionId: localUUID() };
    }

    try {
        const { data, error } = await client
            .from('training_sessions')
            .insert({
                coach_id: uid,
                athlete_name: athleteName,
                started_at: new Date().toISOString(),
                status: 'active',
            })
            .select('id')
            .single();

        if (error) {
            console.warn('[trainingSession] startSession', error.message);
            // Fallback local para no bloquear la UI
            return { ok: true, sessionId: localUUID() };
        }
        return { ok: true, sessionId: data.id };
    } catch (err) {
        console.warn('[trainingSession] startSession (throw)', err);
        return { ok: true, sessionId: localUUID() };
    }
}

/**
 * Marca una sesión como completada.
 * @param {string} sessionId
 */
export async function completeSession(sessionId) {
    const client = getClient();
    if (!client || !sessionId) return;
    try {
        await client
            .from('training_sessions')
            .update({ status: 'completed', completed_at: new Date().toISOString() })
            .eq('id', sessionId);
    } catch (err) {
        console.warn('[trainingSession] completeSession', err);
    }
}

/**
 * Marca una sesión como abortada.
 * @param {string} sessionId
 */
export async function abortSession(sessionId) {
    const client = getClient();
    if (!client || !sessionId) return;
    try {
        await client
            .from('training_sessions')
            .update({ status: 'aborted', completed_at: new Date().toISOString() })
            .eq('id', sessionId);
    } catch (err) {
        console.warn('[trainingSession] abortSession', err);
    }
}

/**
 * Finaliza cualquier sesión activa al cerrar sesión.
 * Llamado desde logoutApp en app.js.
 */
export async function finalizeActiveSessionOnLogout() {
    const client = getClient();
    const uid = coachId();
    if (!client || !uid) return;
    try {
        await client
            .from('training_sessions')
            .update({ status: 'interrupted', completed_at: new Date().toISOString() })
            .eq('coach_id', uid)
            .eq('status', 'active');
    } catch (err) {
        console.warn('[trainingSession] finalizeActiveSessionOnLogout', err);
    }
}

// ── telemetry_samples ─────────────────────────────────────────────────────────

/**
 * Registra una muestra de telemetría.
 * @param {string|null} sessionId
 * @param {string} athleteName
 * @param {{ cnsr?: number|null, ico?: number|null, injuryRisk?: number|null, hr?: number|null }} sample
 * @returns {Promise<{ ok: boolean, error?: string }>}
 */
export async function recordSample(sessionId, athleteName, sample) {
    const client = getClient();
    const uid = coachId();

    if (!client) {
        // Sin Supabase: registrar en consola y devolver ok
        console.info('[trainingSession] recordSample (local)', { sessionId, athleteName, sample });
        return { ok: true };
    }

    try {
        const { error } = await client.from('telemetry_samples').insert({
            session_id: sessionId || null,
            athlete_name: athleteName,
            coach_id: uid,
            cnsr: sample.cnsr ?? null,
            ico: sample.ico ?? null,
            injury_risk: sample.injuryRisk ?? null,
            hr: sample.hr ?? null,
            recorded_at: new Date().toISOString(),
        });

        if (error) {
            console.warn('[trainingSession] recordSample', error.message);
            return { ok: false, error: error.message };
        }
        return { ok: true };
    } catch (err) {
        const msg = err?.message || String(err);
        console.warn('[trainingSession] recordSample (throw)', msg);
        return { ok: false, error: msg };
    }
}

// ── notes ─────────────────────────────────────────────────────────────────────

/**
 * Inserta una nota en Supabase.
 * @param {string} content
 * @param {string|null} sessionId
 * @returns {Promise<{ ok: boolean, error?: string }>}
 */
export async function insertNote(content, sessionId) {
    const client = getClient();
    const uid = coachId();
    const user = getCurrentUser();

    if (!client) {
        console.info('[trainingSession] insertNote (local)', { content, sessionId });
        return { ok: true };
    }

    try {
        const { error } = await client.from('notes').insert({
            coach_id: uid,
            athlete_name: user?.name || '',
            session_id: sessionId || null,
            content,
            created_at: new Date().toISOString(),
        });

        if (error) {
            console.warn('[trainingSession] insertNote', error.message);
            return { ok: false, error: error.message };
        }
        return { ok: true };
    } catch (err) {
        const msg = err?.message || String(err);
        return { ok: false, error: msg };
    }
}

// ── injuries ──────────────────────────────────────────────────────────────────

/**
 * Registra una lesión.
 * @param {{ athleteName: string, description: string, severity: number, sessionId: string|null }} opts
 * @returns {Promise<{ ok: boolean, error?: string }>}
 */
export async function insertInjury({ athleteName, description, severity, sessionId }) {
    const client = getClient();
    const uid = coachId();

    if (!client) {
        console.info('[trainingSession] insertInjury (local)', { athleteName, description, severity });
        return { ok: true };
    }

    try {
        const { error } = await client.from('injuries').insert({
            coach_id: uid,
            athlete_name: athleteName,
            session_id: sessionId || null,
            description,
            severity: severity ?? 0,
            created_at: new Date().toISOString(),
        });

        if (error) {
            console.warn('[trainingSession] insertInjury', error.message);
            return { ok: false, error: error.message };
        }
        return { ok: true };
    } catch (err) {
        const msg = err?.message || String(err);
        return { ok: false, error: msg };
    }
}
