/**
 * Autenticación con Supabase Auth (sin DOM).
 * Requiere `supabaseClient.js` + variables de entorno y que exista `window.supabase.createClient`
 * (vía UMD o import ESM desde `index.html`).
 */

import { getSupabaseClient } from './supabaseClient.js';

/** Roles sugeridos en `user_metadata.role` (app / RLS) */
export const ROLE = {
    COACH: 'coach',
    ADMIN: 'admin',
    VIEWER: 'viewer',
};

const LEGACY_STORAGE_KEY = 'titan-user';

const DEBUG_AUTH =
    typeof globalThis !== 'undefined' &&
    globalThis.__ENV__ &&
    typeof globalThis.__ENV__ === 'object' &&
    globalThis.__ENV__.DEBUG_AUTH === true;

function debugAuth(...args) {
    if (!DEBUG_AUTH) return;
    console.log(...args);
}

function normalizeEmail(email) {
    return String(email || '')
        .trim()
        .toLowerCase();
}

/**
 * Perfil de aplicación alineado con workspace multi-tenant (`user_metadata` en Supabase).
 * @param {import('@supabase/supabase-js').User | null} user
 */
export function mapSupabaseUserToProfile(user) {
    if (!user) return null;
    const meta = user.user_metadata && typeof user.user_metadata === 'object' ? user.user_metadata : {};
    return {
        id: user.id,
        email: normalizeEmail(user.email),
        name: meta.full_name != null ? String(meta.full_name) : meta.name != null ? String(meta.name) : '',
        role: meta.role != null ? String(meta.role) : ROLE.COACH,
        tenantId: meta.tenant_id != null ? String(meta.tenant_id) : '',
        organizationName: meta.organization_name != null ? String(meta.organization_name) : '',
        planTier: meta.plan_tier != null ? String(meta.plan_tier) : 'standard',
    };
}

/** @type {ReturnType<typeof mapSupabaseUserToProfile> | null} */
let cachedUser = null;

let authSubscriptionStarted = false;

const externalAuthListeners = new Set();

function clearLegacyLocalProfile() {
    try {
        localStorage.removeItem(LEGACY_STORAGE_KEY);
    } catch {
        /* ignore */
    }
}

function ensureAuthSubscription() {
    if (authSubscriptionStarted) return;
    const client = getSupabaseClient();
    authSubscriptionStarted = true;
    client.auth.onAuthStateChange((event, session) => {
        cachedUser = session?.user ? mapSupabaseUserToProfile(session.user) : null;
        externalAuthListeners.forEach((cb) => {
            try {
                cb(event, session);
            } catch (err) {
                console.error('[auth] onAuthStateChange listener', err);
            }
        });
    });
}

/**
 * Restaura la sesión desde el almacenamiento de Supabase y registra el listener global.
 * Llama una vez al arranque de la app (p. ej. desde `initApp`).
 */
export async function hydrateAuth() {
    clearLegacyLocalProfile();
    try {
        const client = getSupabaseClient();
        ensureAuthSubscription();
        const {
            data: { session },
            error,
        } = await client.auth.getSession();
        if (error) {
            console.error('[auth] getSession', error.message);
            cachedUser = null;
            return;
        }
        cachedUser = session?.user ? mapSupabaseUserToProfile(session.user) : null;
    } catch (err) {
        console.error('[auth] hydrateAuth', err);
        cachedUser = null;
    }
}

/**
 * @returns {object | null} Perfil cacheado (sincronizado con la sesión de Supabase).
 */
export function getCurrentUser() {
    return cachedUser;
}

export function isAuthenticated() {
    return cachedUser != null;
}

/**
 * Sesión actual del SDK.
 * @returns {Promise<{ session: import('@supabase/supabase-js').Session | null, error: Error | null }>}
 */
export async function getSession() {
    const client = getSupabaseClient();
    const { data, error } = await client.auth.getSession();
    return {
        session: data.session,
        error: error ?? null,
    };
}

/**
 * Escucha cambios de sesión (login, logout, refresh, etc.).
 * @param {(event: string, session: import('@supabase/supabase-js').Session | null) => void} callback
 * @returns {() => void} función para dejar de escuchar este callback
 */
export function onAuthStateChange(callback) {
    if (typeof callback !== 'function') {
        return () => {};
    }
    getSupabaseClient();
    ensureAuthSubscription();
    externalAuthListeners.add(callback);
    return () => {
        externalAuthListeners.delete(callback);
    };
}

/**
 * @returns {Promise<{ ok: true, user: object } | { ok: false, error: string }>}
 */
export async function login(email, password) {
    const e = normalizeEmail(email);
    if (!e || !password) {
        return { ok: false, error: 'Introduce email y contraseña.' };
    }
    try {
        const client = getSupabaseClient();
        ensureAuthSubscription();
        debugAuth('[auth] login:start', { email: e });
        const { data, error } = await client.auth.signInWithPassword({
            email: e,
            password,
        });
        if (error) {
            debugAuth('[auth] login:error', error);
            return { ok: false, error: translateAuthError(error) };
        }
        if (!data.user) {
            debugAuth('[auth] login:missing-user', { email: e, data });
            return { ok: false, error: 'No se recibió el usuario tras iniciar sesión.' };
        }
        const user = mapSupabaseUserToProfile(data.user);
        cachedUser = user;
        return { ok: true, user };
    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return { ok: false, error: msg || 'Error al iniciar sesión.' };
    }
}

/**
 * @returns {Promise<{ ok: true, user: object | null, needsEmailConfirmation: boolean } | { ok: false, error: string }>}
 */
export async function register(email, password) {
    const e = normalizeEmail(email);
    if (!e || !password) {
        return { ok: false, error: 'Introduce email y contraseña.' };
    }
    if (password.length < 6) {
        return { ok: false, error: 'La contraseña debe tener al menos 6 caracteres.' };
    }
    try {
        const client = getSupabaseClient();
        ensureAuthSubscription();
        debugAuth('[auth] signup:start', { email: e });
        const { data, error } = await client.auth.signUp({
            email: e,
            password,
        });
        if (error) {
            debugAuth('[auth] signup:error', error);
            return { ok: false, error: translateAuthError(error) };
        }
        const needsEmailConfirmation = !data.session;
        const user = data.user ? mapSupabaseUserToProfile(data.user) : null;
        if (data.session && user) {
            cachedUser = user;
        }
        return { ok: true, user, needsEmailConfirmation };
    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return { ok: false, error: msg || 'Error al registrar la cuenta.' };
    }
}

// Alias para el contrato esperado (signup).
export const signup = register;

export async function logout() {
    try {
        const client = getSupabaseClient();
        await client.auth.signOut();
    } catch (err) {
        console.error('[auth] signOut', err);
    } finally {
        cachedUser = null;
    }
}

/** @param {import('@supabase/supabase-js').AuthError} error */
function translateAuthError(error) {
    if (!error?.message) return 'Error de autenticación.';
    const map = {
        'Invalid login credentials': 'Credenciales incorrectas.',
        'Email not confirmed': 'Confirma tu email antes de entrar.',
    };
    return map[error.message] || error.message;
}

/**
 * Contrato para extensiones (telemetría, tests).
 */
export const authAdapter = {
    ROLE,
    hydrateAuth,
    getCurrentUser,
    isAuthenticated,
    getSession,
    login,
    signup,
    register,
    logout,
    onAuthStateChange,
};
