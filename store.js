/**
 * store.js — Estado global centralizado (sin frameworks).
 * Patrón publish/subscribe minimalista. Expone get/set/subscribe.
 */

const _state = {
    /** Atleta actualmente seleccionado en la vista detalle. */
    currentAthleteName: 'Laura Pro',
    /** Sesión de entrenamiento activa (null si no hay ninguna). */
    activeSession: null,
    /** Número de muestras pendientes en la cola offline. */
    queueCount: 0,
    /** Atleta asignado al plan del creador. */
    planAthlete: 'Laura Pro',
};

/** @type {Set<(state: typeof _state) => void>} */
const _listeners = new Set();

/** Devuelve una copia superficial del estado actual. */
export function getState() {
    return { ..._state };
}

/**
 * Actualiza el estado y notifica a los suscriptores.
 * @param {Partial<typeof _state>} patch
 */
export function setState(patch) {
    Object.assign(_state, patch);
    const snapshot = { ..._state };
    _listeners.forEach((fn) => {
        try {
            fn(snapshot);
        } catch (err) {
            console.error('[store] listener error', err);
        }
    });
}

/**
 * Suscribe una función a cambios de estado.
 * @param {(state: typeof _state) => void} fn
 * @returns {() => void} función para cancelar la suscripción
 */
export function subscribe(fn) {
    _listeners.add(fn);
    return () => _listeners.delete(fn);
}
