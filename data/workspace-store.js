/**
 * Workspace multi-tenant (persistencia local hasta backend).
 * Contrato alineado con futuras tablas: organizations, coaches, athletes, plans.
 */

const WS_VERSION = 2;
const WS_PREFIX = 'titan-workspace-v';

/** @typedef {{ kcal: number, p: number, c: number, f: number }} MacroTargets */
/** @typedef {{ id: string, name: string, phase: string, adherence: number, risk: 'low'|'medium'|'high', targets: MacroTargets, notes?: string }} AthleteRow */

/** @returns {AthleteRow[]} */
function seedAthletes() {
    return [
        {
            id: 'ath_laura',
            name: 'Laura Pro',
            phase: 'cutting',
            adherence: 0.94,
            risk: 'low',
            targets: { kcal: 1950, p: 155, c: 180, f: 48 },
            notes: 'Pre-comp · hidratación',
        },
        {
            id: 'ath_javi',
            name: 'Javi M.',
            phase: 'volumen',
            adherence: 0.91,
            risk: 'low',
            targets: { kcal: 2850, p: 185, c: 360, f: 78 },
            notes: 'Hipertrofia · técnica press',
        },
        {
            id: 'ath_carlos',
            name: 'Carlos R.',
            phase: 'cutting',
            adherence: 0.62,
            risk: 'high',
            targets: { kcal: 2100, p: 170, c: 220, f: 55 },
            notes: 'Estancamiento 14 sem',
        },
        {
            id: 'ath_raul',
            name: 'Raúl C.',
            phase: 'recomposicion',
            adherence: 0.71,
            risk: 'medium',
            targets: { kcal: 2350, p: 165, c: 260, f: 62 },
            notes: 'Check-in pendiente',
        },
        {
            id: 'ath_maria',
            name: 'María S.',
            phase: 'wellness',
            adherence: 0.89,
            risk: 'low',
            targets: { kcal: 2050, p: 140, c: 210, f: 58 },
            notes: 'Post-parto adaptación',
        },
    ];
}

function defaultWorkspace() {
    return {
        version: WS_VERSION,
        organizationName: 'TITAN Performance Lab',
        kpis: {
            activeClients: 5,
            adherenceAvg: 0.81,
            revenueMonthlyMock: 4200,
            aiCallsUsed: 12,
        },
        planLimits: {
            maxAthletes: 50,
            maxAiCallsDay: 200,
            tier: 'pro',
        },
        alerts: [
            {
                id: 'alt_stall',
                type: 'stagnation',
                severity: 'high',
                athlete: 'Carlos R.',
                title: 'Estancamiento prolongado',
                detail: 'Sin variación operativa en peso/perímetros >12 semanas en déficit.',
                action: 'Validar adherencia 48h antes de recortar más kcal.',
            },
            {
                id: 'alt_adh',
                type: 'adherence',
                severity: 'medium',
                athlete: 'Raúl C.',
                title: 'Adherencia baja (datos)',
                detail: 'Check-in semanal ausente; riesgo de decisiones a ciegas.',
                action: 'Recordatorio + ventana de 48h para métricas subjetivas.',
            },
            {
                id: 'alt_ot',
                type: 'overtraining',
                severity: 'medium',
                athlete: 'Javi M.',
                title: 'Señal de fatiga acumulada',
                detail: 'RIR declarado bajo en básicos pese a volumen estable.',
                action: 'Deload 1 semana o reduce series accesorias.',
            },
        ],
        athletes: seedAthletes(),
    };
}

function storageKeyForUser(user) {
    const tid = (user && user.tenantId) || 'tenant_anon';
    const uid = (user && user.id) || 'anon';
    return WS_PREFIX + WS_VERSION + ':' + tid + ':' + uid;
}

/**
 * @param {object|null} user desde auth
 */
export function loadWorkspace(user) {
    const key = storageKeyForUser(user);
    try {
        const raw = localStorage.getItem(key);
        if (!raw) {
            const fresh = defaultWorkspace();
            localStorage.setItem(key, JSON.stringify(fresh));
            return fresh;
        }
        const parsed = JSON.parse(raw);
        if (!parsed || !Array.isArray(parsed.athletes)) {
            const fresh = defaultWorkspace();
            localStorage.setItem(key, JSON.stringify(fresh));
            return fresh;
        }
        return parsed;
    } catch {
        return defaultWorkspace();
    }
}

export function saveWorkspace(user, workspace) {
    const key = storageKeyForUser(user);
    try {
        localStorage.setItem(key, JSON.stringify(workspace));
    } catch {
        /* quota */
    }
}

/** Lista nombres para pickers */
export function listAthleteNames(user) {
    return loadWorkspace(user).athletes.map((a) => a.name);
}

/**
 * @param {object|null} user
 * @param {string} name
 * @returns {AthleteRow|null}
 */
export function getAthleteByName(user, name) {
    const ws = loadWorkspace(user);
    return ws.athletes.find((a) => a.name === name) || null;
}

/**
 * Actualiza fase del atleta en el workspace.
 */
export function updateAthletePhase(user, name, phase) {
    const ws = loadWorkspace(user);
    const a = ws.athletes.find((x) => x.name === name);
    if (!a) return;
    a.phase = phase;
    saveWorkspace(user, ws);
}

export function getWorkspaceKpis(user) {
    return loadWorkspace(user).kpis;
}

export function getWorkspaceAlerts(user) {
    return loadWorkspace(user).alerts;
}
