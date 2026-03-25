/**
 * Estado de sesión del coach en la UI (SaaS: sincronizar con API).
 * Separado de auth para no crear dependencias circulares con el creador.
 */

let _planAthlete = 'Laura Pro';

export function getPlanAthlete() {
    return _planAthlete;
}

export function setPlanAthlete(name) {
    _planAthlete = name || 'Laura Pro';
}
