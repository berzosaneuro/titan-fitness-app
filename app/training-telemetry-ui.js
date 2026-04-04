/**
 * app/training-telemetry-ui.js — UI de telemetría de entrenamiento.
 *
 * Gestiona los botones del panel #training-telemetry-card:
 *   Iniciar sesión · Registrar muestra · Finalizar · Abortar · Guardar nota · Registrar lesión
 *
 * Estado de sesión y Supabase viven en trainingSession.js.
 * Cola offline en telemetryQueue.js.
 */

import { getState, setState } from '../store.js';

// ── Estado local de UI ────────────────────────────────────────────────────────

let _session = null;      // { id, athleteName, startedAt }

// ── Helpers DOM ───────────────────────────────────────────────────────────────

function el(id) {
    return document.getElementById(id);
}
function num(id) {
    return parseFloat(el(id)?.value ?? '') || null;
}
function showToast(msg) {
    if (typeof window.showToast === 'function') window.showToast(msg);
}

// ── Estado de botones ─────────────────────────────────────────────────────────

function setSessionActive(active) {
    const start = el('tt-btn-start');
    const complete = el('tt-btn-complete');
    const abort = el('tt-btn-abort');
    const sample = el('tt-btn-sample');

    if (start) start.disabled = active;
    if (complete) complete.disabled = !active;
    if (abort) abort.disabled = !active;
    if (sample) sample.disabled = !active;
}

function setHint(msg, isError = false) {
    const hint = el('tt-hint');
    if (!hint) return;
    hint.textContent = msg;
    hint.style.color = isError ? '#FF3B3B' : '#888';
}

function setBanner(msg) {
    const banner = el('tt-session-banner');
    if (banner) banner.textContent = msg;
}

function updateQueueBadge() {
    const state = getState();
    const badge = el('tt-queue-count');
    if (!badge) return;
    const count = state.queueCount || 0;
    badge.textContent = count > 0 ? count + ' en cola' : '';
}

function updateOfflineBadge(offline) {
    const badge = el('tt-offline-badge');
    if (!badge) return;
    if (offline) {
        badge.textContent = '⚡ Sin red';
        badge.classList.remove('is-hidden');
    } else {
        badge.textContent = '';
        badge.classList.add('is-hidden');
    }
}

// ── Lecturas de inputs ────────────────────────────────────────────────────────

function readSample() {
    return {
        cnsr: num('tt-input-cnsr'),
        ico: num('tt-input-ico'),
        injuryRisk: num('tt-input-risk'),
        hr: num('tt-input-hr'),
    };
}

function clearInputs() {
    ['tt-input-cnsr', 'tt-input-ico', 'tt-input-risk', 'tt-input-hr'].forEach((id) => {
        const input = el(id);
        if (input) input.value = '';
    });
}

// ── Handlers ──────────────────────────────────────────────────────────────────

async function handleStartSession() {
    const state = getState();
    const athleteName = state.currentAthleteName || 'Atleta';

    setHint('Iniciando sesión…');

    try {
        // Importación dinámica para evitar ciclo — trainingSession.js
        const { startSession } = await import('../trainingSession.js');
        const result = await startSession(athleteName);

        if (!result.ok) {
            setHint('Error al iniciar: ' + (result.error || 'desconocido'), true);
            return;
        }

        _session = { id: result.sessionId, athleteName, startedAt: new Date() };
        setState({ activeSession: _session });
        setSessionActive(true);
        setBanner('▶ Sesión activa · ' + athleteName + ' · ' + new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }));
        setHint('Sesión iniciada. Registra muestras con el botón abajo.');
        showToast('▶ Sesión iniciada — ' + athleteName);
    } catch (err) {
        setHint('Error al iniciar sesión.', true);
        console.error('[telemetry-ui] startSession', err);
    }
}

async function handleRecordSample() {
    if (!_session) return;
    const sample = readSample();
    const hasData = Object.values(sample).some((v) => v !== null);
    if (!hasData) {
        setHint('Introduce al menos un valor (CNS-R, ICO, Riesgo o FC).', true);
        return;
    }

    setHint('Guardando muestra…');

    try {
        const { recordSample } = await import('../trainingSession.js');
        const result = await recordSample(_session.id, _session.athleteName, sample);

        if (!result.ok) {
            // Si falla Supabase, va a la cola offline
            const { enqueue } = await import('../telemetryQueue.js');
            enqueue({ sessionId: _session.id, athleteName: _session.athleteName, ...sample });
            setHint('Sin red — muestra en cola offline.');
        } else {
            refreshDisplay(sample);
            setHint('✅ Muestra registrada · ' + new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }));
        }
    } catch (err) {
        console.error('[telemetry-ui] recordSample', err);
        setHint('Error al registrar muestra.', true);
    }

    updateQueueBadge();
}

async function handleCompleteSession() {
    if (!_session) return;
    setHint('Finalizando sesión…');
    try {
        const { completeSession } = await import('../trainingSession.js');
        await completeSession(_session.id);
    } catch (err) {
        console.warn('[telemetry-ui] completeSession', err);
    }
    _session = null;
    setState({ activeSession: null });
    setSessionActive(false);
    setBanner('—');
    clearInputs();
    setHint('✅ Sesión finalizada y guardada.');
    showToast('✅ Sesión de entrenamiento completada');
}

async function handleAbortSession() {
    if (!_session) return;
    try {
        const { abortSession } = await import('../trainingSession.js');
        await abortSession(_session.id);
    } catch (err) {
        console.warn('[telemetry-ui] abortSession', err);
    }
    _session = null;
    setState({ activeSession: null });
    setSessionActive(false);
    setBanner('—');
    clearInputs();
    setHint('Sesión abortada.');
    showToast('Sesión abortada');
}

async function handleSaveNote() {
    const noteEl = el('tt-note-body');
    const content = (noteEl?.value || '').trim();
    if (!content) {
        setHint('Escribe una nota antes de guardar.', true);
        return;
    }
    try {
        const { insertNote } = await import('../trainingSession.js');
        const result = await insertNote(content, _session?.id || null);
        if (result.ok) {
            showToast('📝 Nota guardada');
            if (noteEl) noteEl.value = '';
            setHint('Nota guardada correctamente.');
        } else {
            showToast('No se pudo guardar la nota');
            setHint('Error al guardar nota: ' + (result.error || ''), true);
        }
    } catch (err) {
        console.error('[telemetry-ui] saveNote', err);
        showToast('Error al guardar nota');
    }
}

async function handleReportInjury() {
    const descEl = el('tt-injury-desc');
    const sevEl = el('tt-injury-severity');
    const desc = (descEl?.value || '').trim();
    const severity = parseFloat(sevEl?.value ?? '') || 0;

    if (!desc) {
        setHint('Describe la lesión antes de registrarla.', true);
        return;
    }
    try {
        const { insertInjury } = await import('../trainingSession.js');
        const state = getState();
        const result = await insertInjury({
            athleteName: state.currentAthleteName,
            description: desc,
            severity,
            sessionId: _session?.id || null,
        });
        if (result.ok) {
            showToast('🩹 Lesión registrada');
            if (descEl) descEl.value = '';
            if (sevEl) sevEl.value = '';
            setHint('Lesión registrada.');
        } else {
            showToast('No se pudo registrar la lesión');
            setHint('Error: ' + (result.error || ''), true);
        }
    } catch (err) {
        console.error('[telemetry-ui] reportInjury', err);
        showToast('Error al registrar lesión');
    }
}

// ── Display de últimas lecturas ───────────────────────────────────────────────

function refreshDisplay(sample) {
    const set = (id, val, unit = '') => {
        const e = el(id);
        if (e) e.textContent = val !== null ? val + unit : '—';
    };
    set('tt-val-cnsr', sample.cnsr);
    set('tt-val-ico', sample.ico);
    set('tt-val-risk', sample.injuryRisk);
    set('tt-val-hr', sample.hr, ' lpm');
}

// ── Inicialización pública ────────────────────────────────────────────────────

/**
 * Enlaza todos los event listeners del panel de telemetría.
 * Llamar una sola vez al inicio de la app (initApp → showAppShell).
 */
export function initTrainingTelemetryUi() {
    // Usamos delegación desde document para que funcione aunque
    // el panel no esté visible cuando se llama initTrainingTelemetryUi.
    document.addEventListener('click', (e) => {
        const id = e.target.closest('button')?.id;
        switch (id) {
            case 'tt-btn-start':
                void handleStartSession();
                break;
            case 'tt-btn-complete':
                void handleCompleteSession();
                break;
            case 'tt-btn-abort':
                void handleAbortSession();
                break;
            case 'tt-btn-sample':
                void handleRecordSample();
                break;
            case 'tt-btn-save-note':
                void handleSaveNote();
                break;
            case 'tt-btn-injury':
                void handleReportInjury();
                break;
        }
    });

    // Red — offline/online detection
    window.addEventListener('offline', () => updateOfflineBadge(true));
    window.addEventListener('online', () => {
        updateOfflineBadge(false);
        // Intentar vaciar la cola cuando se recupera la red
        import('../telemetryQueue.js').then(({ flushQueue }) => {
            void flushQueue();
        }).catch(() => {});
    });

    updateOfflineBadge(!navigator.onLine);
    updateQueueBadge();
}

/**
 * Refresca el panel de telemetría con el último estado conocido.
 * Llamar al navegar a la pantalla de detalle de atleta.
 */
export async function refreshTrainingTelemetryPanel() {
    updateQueueBadge();
    updateOfflineBadge(!navigator.onLine);

    // Si hay sesión activa, restaurar el estado de los botones
    const state = getState();
    if (state.activeSession) {
        _session = state.activeSession;
        setSessionActive(true);
        setBanner('▶ Sesión activa · ' + (_session.athleteName || ''));
    } else {
        setSessionActive(false);
        setBanner('—');
    }
}
