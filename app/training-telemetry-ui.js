/**
 * UI telemetría + sesión Supabase (ficha atleta). Solo datos introducidos por el usuario o leídos de BD.
 */

import { addToQueue, flushQueue, getPendingCount, isBrowserOnline } from '../telemetryQueue.js';
import {
    clearStoredActiveSession,
    endSession,
    fetchLatestTelemetryRow,
    getStoredActiveSessionId,
    insertInjury,
    insertNote,
    startSession,
} from '../trainingSession.js';
import { tryGetSupabaseClient } from '../supabaseClient.js';

function el(id) {
    return document.getElementById(id);
}

function setHint(text, isError) {
    const h = el('tt-hint');
    if (!h) return;
    h.textContent = text || '';
    h.classList.toggle('u-text-danger', Boolean(isError));
}

function readMetric(id) {
    const n = el(id);
    if (!n || n.value === '') {
        return null;
    }
    const v = Number(n.value);
    return Number.isFinite(v) ? v : null;
}

async function refreshOfflineBadge() {
    const badge = el('tt-offline-badge');
    const q = el('tt-queue-count');
    if (badge) {
        const online = isBrowserOnline();
        badge.classList.toggle('is-hidden', online);
        badge.textContent = online ? '' : 'Sin red · cola local';
    }
    if (q) {
        try {
            const n = await getPendingCount();
            q.textContent = n > 0 ? `${n} pendiente(s)` : '';
        } catch {
            q.textContent = '';
        }
    }
}

async function refreshDisplayedMetrics(sessionId) {
    const row = sessionId ? await fetchLatestTelemetryRow(sessionId) : null;
    const set = (id, val) => {
        const n = el(id);
        if (n) {
            n.textContent = val == null ? '—' : String(val);
        }
    };
    if (!row) {
        set('tt-val-cnsr', null);
        set('tt-val-ico', null);
        set('tt-val-risk', null);
        set('tt-val-hr', null);
        return;
    }
    set('tt-val-cnsr', row.cnsr);
    set('tt-val-ico', row.ico);
    set('tt-val-risk', row.injury_risk);
    set('tt-val-hr', row.heart_rate);
}

function updateSessionBanner(activeId) {
    const b = el('tt-session-banner');
    if (!b) return;
    if (!activeId) {
        b.textContent = 'Sin sesión activa. Inicia una para registrar telemetría.';
        return;
    }
    b.textContent = `Sesión activa · ${activeId.slice(0, 8)}…`;
}

let pollTimer = null;

function stopPoll() {
    if (pollTimer) {
        clearInterval(pollTimer);
        pollTimer = null;
    }
}

function startPoll(sessionId) {
    stopPoll();
    if (!sessionId) {
        return;
    }
    pollTimer = window.setInterval(() => {
        void (async () => {
            await refreshDisplayedMetrics(sessionId);
            await refreshOfflineBadge();
            void flushQueue();
        })();
    }, 8000);
}

function setButtonsState(active) {
    const start = el('tt-btn-start');
    const done = el('tt-btn-complete');
    const abort = el('tt-btn-abort');
    const sample = el('tt-btn-sample');
    if (start) start.disabled = active;
    if (done) done.disabled = !active;
    if (abort) abort.disabled = !active;
    if (sample) sample.disabled = !active;
}

async function syncUiFromStorage() {
    const sid = getStoredActiveSessionId();
    const client = tryGetSupabaseClient();
    if (client && sid) {
        const {
            data: { user },
        } = await client.auth.getUser();
        if (!user) {
            clearStoredActiveSession();
            updateSessionBanner(null);
            setButtonsState(false);
            await refreshDisplayedMetrics(null);
            return;
        }
        const { data, error } = await client
            .from('sessions')
            .select('id,status')
            .eq('id', sid)
            .eq('user_id', user.id)
            .maybeSingle();
        if (error || !data || data.status !== 'active') {
            clearStoredActiveSession();
            updateSessionBanner(null);
            setButtonsState(false);
            await refreshDisplayedMetrics(null);
            return;
        }
    }
    const active = Boolean(getStoredActiveSessionId());
    updateSessionBanner(getStoredActiveSessionId());
    setButtonsState(active);
    await refreshDisplayedMetrics(getStoredActiveSessionId());
    if (active) {
        startPoll(getStoredActiveSessionId());
    } else {
        stopPoll();
    }
}

export async function refreshTrainingTelemetryPanel() {
    await syncUiFromStorage();
    await refreshOfflineBadge();
}

export function initTrainingTelemetryUi() {
    const start = el('tt-btn-start');
    const done = el('tt-btn-complete');
    const abort = el('tt-btn-abort');
    const sample = el('tt-btn-sample');
    const noteBtn = el('tt-btn-save-note');
    const injBtn = el('tt-btn-injury');

    if (start) {
        start.addEventListener('click', async () => {
            if (!isBrowserOnline()) {
                setHint('No hay conexión: la sesión debe crearse en el servidor. Espera a tener red.', true);
                return;
            }
            setHint('Iniciando sesión…');
            const r = await startSession();
            if (!r.ok) {
                setHint(r.error || 'Error al iniciar', true);
                return;
            }
            setHint(r.resumed ? 'Sesión ya activa · reanudada.' : 'Sesión creada en Supabase.');
            await syncUiFromStorage();
            await refreshOfflineBadge();
        });
    }

    if (done) {
        done.addEventListener('click', async () => {
            setHint('Finalizando…');
            const r = await endSession('completed');
            if (!r.ok) {
                setHint(r.error || 'Error al finalizar', true);
                return;
            }
            setHint('Sesión completada. Datos en cola se sincronizarán al tener red.');
            stopPoll();
            await syncUiFromStorage();
            await refreshOfflineBadge();
        });
    }

    if (abort) {
        abort.addEventListener('click', async () => {
            setHint('Abortando…');
            const r = await endSession('aborted');
            if (!r.ok) {
                setHint(r.error || 'Error al abortar', true);
                return;
            }
            setHint('Sesión abortada.');
            stopPoll();
            await syncUiFromStorage();
            await refreshOfflineBadge();
        });
    }

    if (sample) {
        sample.addEventListener('click', async () => {
            const sid = getStoredActiveSessionId();
            if (!sid) {
                setHint('Inicia sesión antes de registrar muestras.', true);
                return;
            }
            const payload = {
                session_id: sid,
                cnsr: readMetric('tt-input-cnsr'),
                ico: readMetric('tt-input-ico'),
                injury_risk: readMetric('tt-input-risk'),
                heart_rate: readMetric('tt-input-hr'),
            };
            const q = await addToQueue(payload);
            if (!q.ok) {
                setHint(q.error || 'No se pudo encolar', true);
                return;
            }
            setHint('Muestra en cola. Sincronizando…');
            await flushQueue();
            await refreshDisplayedMetrics(sid);
            await refreshOfflineBadge();
            setHint(isBrowserOnline() ? 'Muestra guardada (o en cola si hubo error de red).' : 'Sin red: la muestra quedó en cola local.');
        });
    }

    if (noteBtn) {
        noteBtn.addEventListener('click', async () => {
            const ta = el('tt-note-body');
            const text = ta && ta.value;
            if (!text || !String(text).trim()) {
                setHint('Escribe una nota.', true);
                return;
            }
            const sid = getStoredActiveSessionId();
            const r = await insertNote(String(text).trim(), sid);
            if (!r.ok) {
                setHint(r.error || 'No se guardó la nota', true);
                return;
            }
            if (ta) ta.value = '';
            setHint('Nota guardada en Supabase.');
        });
    }

    if (injBtn) {
        injBtn.addEventListener('click', async () => {
            const d = el('tt-injury-desc');
            const s = el('tt-injury-severity');
            const desc = d && d.value;
            const sev = s ? Number(s.value) : NaN;
            if (!desc || !String(desc).trim()) {
                setHint('Describe la lesión.', true);
                return;
            }
            if (!Number.isFinite(sev)) {
                setHint('Gravedad numérica requerida.', true);
                return;
            }
            const r = await insertInjury(String(desc).trim(), sev);
            if (!r.ok) {
                setHint(r.error || 'No se registró la lesión', true);
                return;
            }
            if (d) d.value = '';
            setHint('Lesión registrada en Supabase.');
        });
    }

    window.addEventListener('online', () => {
        void refreshOfflineBadge();
        void flushQueue();
    });
    window.addEventListener('offline', () => {
        void refreshOfflineBadge();
    });
}
