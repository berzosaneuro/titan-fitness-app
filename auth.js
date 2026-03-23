/**
 * Capa de autenticación — sin DOM.
 * Sustituir persistencia y validación por Supabase/Auth0 sin tocar la UI.
 */

export const STORAGE_KEY = 'titan-user';

/** Roles preparados para RBAC multi-tenant */
export const ROLE = {
    COACH: 'coach',
    ADMIN: 'admin',
    VIEWER: 'viewer',
};

const DEMO_USER = {
    id: 'usr_demo_1',
    email: 'coach@titan.app',
    name: 'Coach Demo',
    role: ROLE.COACH,
    tenantId: 'tenant_demo',
};

const DEMO_PASSWORD = 'Titan2025!';

function delay(ms) {
    return new Promise((r) => setTimeout(r, ms));
}

function normalizeEmail(email) {
    return String(email || '')
        .trim()
        .toLowerCase();
}

function readStoredUser() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== 'object' || !parsed.id) return null;
        return parsed;
    } catch {
        return null;
    }
}

function writeUser(user) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
}

/**
 * @returns {object|null} usuario actual o null
 */
export function getCurrentUser() {
    return readStoredUser();
}

export function isAuthenticated() {
    return readStoredUser() != null;
}

export function logout() {
    localStorage.removeItem(STORAGE_KEY);
}

/**
 * Login simulado (reemplazar por fetch a /api/auth/login).
 * @returns {Promise<{ ok: true, user: object } | { ok: false, error: string }>}
 */
export async function login(email, password) {
    await delay(450);
    const e = normalizeEmail(email);
    if (!e || !password) {
        return { ok: false, error: 'Introduce email y contraseña.' };
    }
    if (e === DEMO_USER.email && password === DEMO_PASSWORD) {
        const user = { ...DEMO_USER, email: e };
        writeUser(user);
        return { ok: true, user };
    }
    return { ok: false, error: 'Credenciales incorrectas. Prueba modo demo o coach@titan.app' };
}

/**
 * Sesión demo sin contraseña (onboarding / trials).
 */
export async function loginAsDemo() {
    await delay(320);
    const user = {
        ...DEMO_USER,
        id: 'usr_demo_guest',
        email: 'demo@titan.app',
        name: 'Invitado demo',
        role: ROLE.COACH,
        tenantId: 'tenant_demo',
        isDemoSession: true,
    };
    writeUser(user);
    return { ok: true, user };
}

/**
 * Contrato listo para inyectar proveedor real (Supabase, Clerk, etc.).
 */
export const authAdapter = {
    STORAGE_KEY,
    getCurrentUser,
    isAuthenticated,
    login,
    loginAsDemo,
    logout,
};
