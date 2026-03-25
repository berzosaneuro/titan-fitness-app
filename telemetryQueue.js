/**
 * Cola offline-first de telemetría → Supabase (sin pérdida: IndexedDB o memoria).
 * Requiere sesión Supabase activa al hacer flush.
 */

import { tryGetSupabaseClient } from './supabaseClient.js';

const DB_NAME = 'A�S ROOM-saas-outbox';
const DB_VERSION = 1;
const STORE = 'telemetry_pending';
const BATCH_SIZE = 40;

/** @type {Array<{ id: string, payload: object, attempts: number, lastError: string | null, createdAt: number }>} */
let memoryFallback = [];

let dbPromise = null;

function openIndexedDb() {
    if (typeof indexedDB === 'undefined') {
        return Promise.resolve(null);
    }
    if (dbPromise) {
        return dbPromise;
    }
    dbPromise = new Promise((resolve) => {
        try {
            const req = indexedDB.open(DB_NAME, DB_VERSION);
            req.onerror = () => resolve(null);
            req.onsuccess = () => resolve(req.result);
            req.onupgradeneeded = (ev) => {
                const db = ev.target.result;
                if (!db.objectStoreNames.contains(STORE)) {
                    db.createObjectStore(STORE, { keyPath: 'id' });
                }
            };
        } catch {
            resolve(null);
        }
    });
    return dbPromise;
}

/**
 * @param {IDBDatabase} db
 * @returns {Promise<Array<{ id: string, payload: object, attempts: number, lastError: string | null, createdAt: number }>>}
 */
function idbGetAll(db) {
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE, 'readonly');
        const q = tx.objectStore(STORE).getAll();
        q.onsuccess = () => resolve(q.result || []);
        q.onerror = () => reject(q.error);
    });
}

/**
 * @param {IDBDatabase} db
 * @param {string} id
 */
function idbDelete(db, id) {
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE, 'readwrite');
        tx.objectStore(STORE).delete(id);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
    });
}

/**
 * @param {IDBDatabase} db
 * @param {{ id: string, payload: object, attempts: number, lastError: string | null, createdAt: number }} rec
 */
function idbPut(db, rec) {
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE, 'readwrite');
        tx.objectStore(STORE).put(rec);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
    });
}

async function loadAllPending() {
    const db = await openIndexedDb();
    if (db) {
        const rows = await idbGetAll(db);
        return rows.sort((a, b) => a.createdAt - b.createdAt);
    }
    return [...memoryFallback].sort((a, b) => a.createdAt - b.createdAt);
}

/**
 * @param {import('@supabase/supabase-js').AuthError | { message?: string }} err
 */
function looksLikeAuthError(err) {
    const m = (err && err.message) || '';
    return /jwt|session|auth|401|403/i.test(m);
}

/**
 * Añade una muestra a la cola (persiste en IndexedDB si está disponible).
 * @param {{ session_id: string, cnsr?: number|null, ico?: number|null, injury_risk?: number|null, heart_rate?: number|null, created_at?: string }} data
 * @returns {Promise<{ ok: boolean, error?: string }>}
 */
export async function addToQueue(data) {
    const sid = data && data.session_id;
    if (!sid || typeof sid !== 'string') {
        return { ok: false, error: 'session_id requerido.' };
    }
    const hasMetric =
        data.cnsr != null ||
        data.ico != null ||
        data.injury_risk != null ||
        data.heart_rate != null;
    if (!hasMetric) {
        return { ok: false, error: 'Al menos una métrica numérica es obligatoria.' };
    }

    const record = {
        id:
            typeof crypto !== 'undefined' && crypto.randomUUID
                ? crypto.randomUUID()
                : `t-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        payload: {
            session_id: sid,
            cnsr: data.cnsr != null ? Number(data.cnsr) : null,
            ico: data.ico != null ? Number(data.ico) : null,
            injury_risk: data.injury_risk != null ? Number(data.injury_risk) : null,
            heart_rate: data.heart_rate != null ? Number(data.heart_rate) : null,
            created_at: data.created_at || new Date().toISOString(),
        },
        attempts: 0,
        lastError: null,
        createdAt: Date.now(),
    };

    const db = await openIndexedDb();
    if (db) {
        try {
            await idbPut(db, record);
            return { ok: true };
        } catch {
            memoryFallback.push(record);
            return { ok: true };
        }
    }
    memoryFallback.push(record);
    return { ok: true };
}

/**
 * @returns {Promise<number>}
 */
export async function getPendingCount() {
    const all = await loadAllPending();
    return all.length;
}

/**
 * Envía lotes a Supabase y elimina filas enviadas con éxito.
 * @returns {Promise<{ ok: boolean, flushed?: number, reason?: string, error?: string }>}
 */
export async function flushQueue() {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
        return { ok: false, reason: 'offline' };
    }
    const client = tryGetSupabaseClient();
    if (!client) {
        return { ok: false, reason: 'no_client' };
    }

    const {
        data: { session },
        error: sessErr,
    } = await client.auth.getSession();
    if (sessErr || !session?.user) {
        return { ok: false, reason: 'auth' };
    }

    let totalFlushed = 0;

    while (true) {
        const pending = await loadAllPending();
        if (pending.length === 0) {
            return { ok: true, flushed: totalFlushed };
        }

        const batch = pending.slice(0, BATCH_SIZE);
        const rows = batch.map((r) => ({
            session_id: r.payload.session_id,
            user_id: session.user.id,
            cnsr: r.payload.cnsr,
            ico: r.payload.ico,
            injury_risk: r.payload.injury_risk,
            heart_rate: r.payload.heart_rate,
            created_at: r.payload.created_at,
        }));

        const { error } = await client.from('telemetry').insert(rows);

        if (error) {
            if (looksLikeAuthError(error)) {
                await client.auth.refreshSession();
            }
            const msg = error.message || 'insert_error';
            const db = await openIndexedDb();
            for (const rec of batch) {
                const next = {
                    ...rec,
                    attempts: rec.attempts + 1,
                    lastError: msg,
                };
                if (db) {
                    try {
                        await idbPut(db, next);
                    } catch {
                        const i = memoryFallback.findIndex((m) => m.id === rec.id);
                        if (i >= 0) memoryFallback[i] = next;
                    }
                } else {
                    const i = memoryFallback.findIndex((m) => m.id === rec.id);
                    if (i >= 0) memoryFallback[i] = next;
                }
            }
            return { ok: false, error: msg, flushed: totalFlushed };
        }

        const db = await openIndexedDb();
        for (const rec of batch) {
            if (db) {
                try {
                    await idbDelete(db, rec.id);
                } catch {
                    /* ignore */
                }
            }
            memoryFallback = memoryFallback.filter((m) => m.id !== rec.id);
        }
        totalFlushed += batch.length;
    }
}

/**
 * Reintenta envíos fallidos (equivale a flush con red disponible).
 */
export async function retryFailed() {
    return flushQueue();
}

/**
 * Registra listeners de red / visibilidad y flush periódico.
 * @returns {() => void} teardown
 */
export function initTelemetryQueue() {
    if (typeof window === 'undefined') {
        return () => {};
    }

    const tick = () => {
        void flushQueue();
    };

    function onVisible() {
        if (document.visibilityState === 'visible') {
            tick();
        }
    }

    window.addEventListener('online', tick);
    document.addEventListener('visibilitychange', onVisible);

    const interval = window.setInterval(tick, 25000);

    return () => {
        window.removeEventListener('online', tick);
        document.removeEventListener('visibilitychange', onVisible);
        window.clearInterval(interval);
    };
}

export function isBrowserOnline() {
    return typeof navigator === 'undefined' ? true : navigator.onLine;
}
