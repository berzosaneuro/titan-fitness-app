/**
 * Ciclo de vida de sesiones de telemetría en Supabase (usuario = auth.uid()).
 */

import { tryGetSupabaseClient } from './supabaseClient.js';

const ACTIVE_SESSION_KEY = 'A�S ROOM_active_session_id';

/**
 * Garantiza fila en `profiles` (usuarios previos a trigger o migraciones).
 * @returns {Promise<{ ok: boolean, error?: string }>}
 */
export async function ensureUserProfile() {
    const client = tryGetSupabaseClient();
    if (!client) {
        return { ok: false, error: 'no_client' };
    }
    const {
        data: { user },
        error: uerr,
    } = await client.auth.getUser();
    if (uerr || !user) {
        return { ok: false, error: uerr?.message || 'no_user' };
    }
    const { error } = await client.from('profiles').upsert(
        { id: user.id, email: user.email || '' },
        { onConflict: 'id' }
    );
    if (error) {
        return { ok: false, error: error.message };
    }
    return { ok: true };
}

/**
 * @returns {string | null}
 */
export function getStoredActiveSessionId() {
    try {
        return sessionStorage.getItem(ACTIVE_SESSION_KEY);
    } catch {
        return null;
    }
}

export function clearStoredActiveSession() {
    try {
        sessionStorage.removeItem(ACTIVE_SESSION_KEY);
    } catch {
        /* ignore */
    }
}

/**
 * @returns {Promise<{ ok: true, session: object, resumed: boolean } | { ok: false, error: string }>}
 */
export async function startSession() {
    const client = tryGetSupabaseClient();
    if (!client) {
        return { ok: false, error: 'Supabase no configurado.' };
    }
    const {
        data: { session: authSession },
        error: sErr,
    } = await client.auth.getSession();
    if (sErr || !authSession?.user) {
        return { ok: false, error: 'Sesión expirada. Vuelve a entrar.' };
    }

    const prof = await ensureUserProfile();
    if (!prof.ok && prof.error !== 'no_client') {
        return { ok: false, error: 'No se pudo sincronizar el perfil: ' + (prof.error || '') };
    }

    const { data: existing, error: exErr } = await client
        .from('sessions')
        .select('id,status,started_at,ended_at')
        .eq('user_id', authSession.user.id)
        .eq('status', 'active')
        .maybeSingle();

    if (exErr) {
        return { ok: false, error: exErr.message };
    }

    if (existing) {
        try {
            sessionStorage.setItem(ACTIVE_SESSION_KEY, existing.id);
        } catch {
            /* ignore */
        }
        return { ok: true, session: existing, resumed: true };
    }

    const { data, error } = await client
        .from('sessions')
        .insert({ user_id: authSession.user.id, status: 'active' })
        .select('id,status,started_at,ended_at')
        .single();

    if (error) {
        return { ok: false, error: error.message };
    }
    try {
        sessionStorage.setItem(ACTIVE_SESSION_KEY, data.id);
    } catch {
        /* ignore */
    }
    return { ok: true, session: data, resumed: false };
}

/**
 * @param {string} sessionId
 * @param {'active'|'completed'|'aborted'} status
 * @returns {Promise<{ ok: boolean, error?: string }>}
 */
export async function updateSessionStatus(sessionId, status) {
    if (!sessionId) {
        return { ok: false, error: 'sessionId requerido.' };
    }
    const allowed = ['active', 'completed', 'aborted'];
    if (!allowed.includes(status)) {
        return { ok: false, error: 'Estado no permitido.' };
    }
    const client = tryGetSupabaseClient();
    if (!client) {
        return { ok: false, error: 'no_client' };
    }
    const patch = { status };
    if (status === 'completed' || status === 'aborted') {
        patch.ended_at = new Date().toISOString();
    }
    const { error } = await client.from('sessions').update(patch).eq('id', sessionId);
    if (error) {
        return { ok: false, error: error.message };
    }
    return { ok: true };
}

/**
 * @param {'completed'|'aborted'} status
 * @returns {Promise<{ ok: boolean, error?: string }>}
 */
export async function endSession(status) {
    const id = getStoredActiveSessionId();
    if (!id) {
        return { ok: false, error: 'No hay sesión activa en este dispositivo.' };
    }
    const r = await updateSessionStatus(id, status);
    if (r.ok) {
        try {
            sessionStorage.removeItem(ACTIVE_SESSION_KEY);
        } catch {
            /* ignore */
        }
    }
    return r;
}

/**
 * Cierra sesión activa al cerrar la app (sin bloquear logout).
 */
export async function finalizeActiveSessionOnLogout() {
    const id = getStoredActiveSessionId();
    if (!id) {
        return;
    }
    const client = tryGetSupabaseClient();
    if (!client) {
        try {
            sessionStorage.removeItem(ACTIVE_SESSION_KEY);
        } catch {
            /* ignore */
        }
        return;
    }
    await client
        .from('sessions')
        .update({ status: 'aborted', ended_at: new Date().toISOString() })
        .eq('id', id);
    try {
        sessionStorage.removeItem(ACTIVE_SESSION_KEY);
    } catch {
        /* ignore */
    }
}

/**
 * @param {string} sessionId
 * @returns {Promise<object | null>}
 */
export async function fetchLatestTelemetryRow(sessionId) {
    const client = tryGetSupabaseClient();
    if (!client || !sessionId) {
        return null;
    }
    const { data, error } = await client
        .from('telemetry')
        .select('cnsr,ico,injury_risk,heart_rate,created_at')
        .eq('session_id', sessionId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
    if (error) {
        return null;
    }
    return data;
}

/**
 * @param {number} days
 * @returns {Promise<number | null>}
 */
export async function countSessionsInLastDays(days) {
    const client = tryGetSupabaseClient();
    if (!client) {
        return null;
    }
    const {
        data: { user },
    } = await client.auth.getUser();
    if (!user) {
        return null;
    }
    const since = new Date(Date.now() - Math.max(1, days) * 86400000).toISOString();
    const { count, error } = await client
        .from('sessions')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .gte('started_at', since);
    if (error) {
        return null;
    }
    return count ?? 0;
}

/**
 * @param {string} description
 * @param {number} severity
 * @returns {Promise<{ ok: boolean, error?: string }>}
 */
export async function insertInjury(description, severity) {
    const client = tryGetSupabaseClient();
    if (!client) {
        return { ok: false, error: 'Supabase no configurado.' };
    }
    const {
        data: { user },
    } = await client.auth.getUser();
    if (!user) {
        return { ok: false, error: 'No autenticado.' };
    }
    const { error } = await client.from('injuries').insert({
        user_id: user.id,
        description: String(description || '').trim(),
        severity: Number(severity),
    });
    if (error) {
        return { ok: false, error: error.message };
    }
    return { ok: true };
}

/**
 * @param {string} content
 * @param {string | null} sessionId
 * @returns {Promise<{ ok: boolean, error?: string }>}
 */
export async function insertNote(content, sessionId = null) {
    const client = tryGetSupabaseClient();
    if (!client) {
        return { ok: false, error: 'Supabase no configurado.' };
    }
    const {
        data: { user },
    } = await client.auth.getUser();
    if (!user) {
        return { ok: false, error: 'No autenticado.' };
    }
    const row = {
        user_id: user.id,
        content: String(content || '').trim(),
        session_id: sessionId || null,
    };
    const { error } = await client.from('notes').insert(row);
    if (error) {
        return { ok: false, error: error.message };
    }
    return { ok: true };
}
