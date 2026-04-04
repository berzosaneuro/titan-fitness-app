/**
 * data/workspace-store.js — Persistencia local del workspace (atletas, preferencias de coach).
 * Fase actual: datos demo en memoria + localStorage.
 * Fase siguiente: Supabase `athletes` table (ver next-prep/).
 */

import { tryGetSupabaseClient } from '../supabaseClient.js';

/** Atletas demo coherentes con la UI y con ai.js. */
const DEMO_ATHLETES = [
    {
        id: 'demo-laura',
        name: 'Laura Pro',
        phase: 'WELLNESS • 2 WEEKS OUT',
        status: 'active',
        lastCheckin: 'Hoy',
        weight: 64.5,
        waist: 60,
        hunger: 8,
        risk: 'bajo',
    },
    {
        id: 'demo-javi',
        name: 'Javi M.',
        phase: 'HIPERTROFIA',
        status: 'active',
        lastCheckin: 'Hoy',
        weight: 82.0,
        waist: 85,
        hunger: 5,
        risk: 'bajo',
    },
    {
        id: 'demo-carlos',
        name: 'Carlos R.',
        phase: 'DEFINICIÓN',
        status: 'danger',
        lastCheckin: 'Hace 3 días',
        weight: 78.5,
        waist: 88,
        hunger: 6,
        risk: 'alto',
    },
    {
        id: 'demo-raul',
        name: 'Raúl C.',
        phase: 'RECOMPOSICIÓN',
        status: 'warning',
        lastCheckin: 'Pendiente',
        weight: 90.0,
        waist: 95,
        hunger: 4,
        risk: 'medio',
    },
    {
        id: 'demo-maria',
        name: 'María S.',
        phase: 'POST-PARTO',
        status: 'active',
        lastCheckin: 'Ayer',
        weight: 68.0,
        waist: 75,
        hunger: 5,
        risk: 'bajo',
    },
];

/**
 * Devuelve solo los nombres de los atletas del workspace.
 * Compatible con el contrato que espera app.js: `listAthleteNames(user)`.
 * @param {object|null} _user  Usuario autenticado (reservado para multi-tenant Supabase)
 * @returns {string[]}
 */
export function listAthleteNames(_user) {
    return DEMO_ATHLETES.map((a) => a.name);
}

/**
 * Devuelve los atletas completos (para renderizar la lista).
 * @param {object|null} _user
 * @returns {typeof DEMO_ATHLETES}
 */
export function listAthletes(_user) {
    return [...DEMO_ATHLETES];
}

/**
 * Encuentra un atleta por nombre.
 * @param {string} name
 * @returns {typeof DEMO_ATHLETES[0] | undefined}
 */
export function findAthleteByName(name) {
    return DEMO_ATHLETES.find((a) => a.name === name);
}

/**
 * Intenta cargar atletas reales desde Supabase.
 * Devuelve null si Supabase no está configurado o la tabla no existe.
 * @param {string} coachId
 * @returns {Promise<Array|null>}
 */
export async function fetchAthletesFromSupabase(coachId) {
    const client = tryGetSupabaseClient();
    if (!client || !coachId) return null;
    try {
        const { data, error } = await client
            .from('athletes')
            .select('id, name, phase, status, last_checkin, weight, waist, hunger, risk')
            .eq('coach_id', coachId)
            .order('name');
        if (error) {
            console.warn('[workspace-store] fetchAthletes', error.message);
            return null;
        }
        return data || null;
    } catch (err) {
        console.warn('[workspace-store] fetchAthletes (throw)', err);
        return null;
    }
}

/**
 * Actualiza una métrica de un atleta en Supabase.
 * @param {string} athleteId
 * @param {{ weight?: number, waist?: number, hunger?: number }} metrics
 * @returns {Promise<{ ok: boolean, error?: string }>}
 */
export async function updateAthleteMetrics(athleteId, metrics) {
    const client = tryGetSupabaseClient();
    if (!client) return { ok: false, error: 'Supabase no configurado' };
    try {
        const { error } = await client
            .from('athletes')
            .update({ ...metrics, updated_at: new Date().toISOString() })
            .eq('id', athleteId);
        if (error) return { ok: false, error: error.message };
        return { ok: true };
    } catch (err) {
        return { ok: false, error: String(err?.message || err) };
    }
}
