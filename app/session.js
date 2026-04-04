/**
 * app/session.js — Estado de la sesión del creador de planes.
 * Mantiene qué atleta está asignado al plan activo en el Creador.
 */

import { setState } from '../store.js';

/** @type {string} */
let _planAthlete = 'Laura Pro';

/**
 * Asigna el atleta al plan activo del creador.
 * Actualiza también el store global.
 * @param {string} name
 */
export function setPlanAthlete(name) {
    _planAthlete = name || 'Laura Pro';
    setState({ planAthlete: _planAthlete });
}

/**
 * Devuelve el atleta actualmente asignado al plan.
 * @returns {string}
 */
export function getPlanAthlete() {
    return _planAthlete;
}
