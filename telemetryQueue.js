/**
 * telemetryQueue.js — Cola offline de muestras de telemetría.
 *
 * Persiste en localStorage para sobrevivir a recargas.
 * Cuando hay red, intenta vaciar la cola enviando a Supabase.
 * initTelemetryQueue() devuelve una función de cleanup (detach).
 */

import { setState } from './store.js';

const STORAGE_KEY = 'titan_telemetry_queue';
const FLUSH_INTERVAL_MS = 30_000; // intentar cada 30s cuando hay red

/** @type {number | null} */
let _intervalId = null;

// ── Persistencia ──────────────────────────────────────────────────────────────

function loadQueue() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
}

function saveQueue(queue) {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
    } catch {
        // quota exceeded — silenciar
    }
}

function syncQueueCount() {
    const q = loadQueue();
    setState({ queueCount: q.length });
}

// ── API pública ───────────────────────────────────────────────────────────────

/**
 * Añade una muestra a la cola offline.
 * @param {{ sessionId: string|null, athleteName: string, cnsr?: number|null, ico?: number|null, injuryRisk?: number|null, hr?: number|null }} sample
 */
export function enqueue(sample) {
    const queue = loadQueue();
    queue.push({ ...sample, queuedAt: new Date().toISOString() });
    saveQueue(queue);
    syncQueueCount();
    console.log('[telemetryQueue] enqueued, total:', queue.length);
}

/**
 * Intenta enviar todas las muestras pendientes a Supabase.
 * Las que se envíen con éxito se eliminan de la cola.
 * @returns {Promise<{ sent: number, remaining: number }>}
 */
export async function flushQueue() {
    const queue = loadQueue();
    if (!queue.length) return { sent: 0, remaining: 0 };

    let { recordSample } = {};
    try {
        ({ recordSample } = await import('./trainingSession.js'));
    } catch {
        return { sent: 0, remaining: queue.length };
    }

    const remaining = [];
    let sent = 0;

    for (const item of queue) {
        try {
            const result = await recordSample(item.sessionId, item.athleteName, {
                cnsr: item.cnsr ?? null,
                ico: item.ico ?? null,
                injuryRisk: item.injuryRisk ?? null,
                hr: item.hr ?? null,
            });
            if (result.ok) {
                sent++;
            } else {
                remaining.push(item);
            }
        } catch {
            remaining.push(item);
        }
    }

    saveQueue(remaining);
    syncQueueCount();

    if (sent > 0) {
        console.log('[telemetryQueue] flushed', sent, 'items. Remaining:', remaining.length);
    }

    return { sent, remaining: remaining.length };
}

/**
 * Inicia la cola: programa un flush periódico cuando hay red.
 * @returns {() => void} función de cleanup
 */
export function initTelemetryQueue() {
    syncQueueCount();

    function scheduleFlush() {
        if (_intervalId !== null) return;
        _intervalId = setInterval(async () => {
            if (navigator.onLine) {
                const { remaining } = await flushQueue();
                if (remaining === 0 && _intervalId !== null) {
                    clearInterval(_intervalId);
                    _intervalId = null;
                }
            }
        }, FLUSH_INTERVAL_MS);
    }

    // Iniciar flush si hay elementos en cola
    if (loadQueue().length > 0) scheduleFlush();

    // Cuando se recupera la red, intentar flush inmediato
    const onOnline = async () => {
        const { remaining } = await flushQueue();
        if (remaining > 0) scheduleFlush();
    };

    window.addEventListener('online', onOnline);

    // Cleanup
    return function detach() {
        if (_intervalId !== null) {
            clearInterval(_intervalId);
            _intervalId = null;
        }
        window.removeEventListener('online', onOnline);
    };
}
