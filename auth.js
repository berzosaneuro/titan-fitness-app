/**
 * Capa de autenticación — Supabase.
 * Sin DOM. Toda la lógica de UI vive en app.js.
 *
 * Configuración:
 * 1) Copia `supabase.config.local.example.js` → `supabase.config.local.js` y pon SUPABASE_ANON_KEY, o
 * 2) Antes de cargar los módulos, define en index.html:
 *    <script>globalThis.__A�S ROOM_SUPABASE__ = { url: '...', anonKey: '...' };</script>
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const DEFAULT_SUPABASE_URL = 'https://ilzkwweahzmcmgipylbi.supabase.co';

const injected =
    typeof globalThis !== 'undefined' && globalThis.__A�S ROOM_SUPABASE__
        ? globalThis.__A�S ROOM_SUPABASE__
        : null;

let SUPABASE_URL = injected?.url || DEFAULT_SUPABASE_URL;
let SUPABASE_ANON_KEY = injected?.anonKey || '';

if (!SUPABASE_ANON_KEY) {
    try {
        const local = await import('./supabase.config.local.js');
        if (local.SUPABASE_URL) SUPABASE_URL = local.SUPABASE_URL;
        if (local.SUPABASE_ANON_KEY) SUPABASE_ANON_KEY = local.SUPABASE_ANON_KEY;
    } catch {
        /* supabase.config.local.js opcional */
    }
}

const PLACEHOLDERS = new Set(['', 'TU_SUPABASE_ANON_KEY', 'YOUR_ANON_KEY', 'your-anon-key']);
const keyOk = SUPABASE_ANON_KEY && !PLACEHOLDERS.has(SUPABASE_ANON_KEY.trim());

if (!keyOk) {
    console.error(
        '[A�S ROOM] Supabase no está configurado: crea supabase.config.local.js (ver supabase.config.local.example.js) o define globalThis.__A�S ROOM_SUPABASE__.'
    );
}

export const supabase = createClient(SUPABASE_URL, keyOk ? SUPABASE_ANON_KEY : 'invalid-placeholder');

export const ROLE = {
    COACH: 'coach',
    ADMIN: 'admin',
    VIEWER: 'viewer',
};

/** True si hay clave válida; la UI puede mostrar aviso si es false. */
export function isSupabaseConfigured() {
    return keyOk;
}

function translateError(error) {
    const msg = (error?.message || '').toLowerCase();
    if (!keyOk) return 'Servicio de acceso no configurado. Revisa supabase.config.local.js.';
    if (msg.includes('invalid login credentials')) return 'Email o contraseña incorrectos.';
    if (msg.includes('email not confirmed')) return 'Confirma tu email antes de acceder.';
    if (msg.includes('user already registered')) return 'Este email ya está registrado.';
    if (msg.includes('invalid email') || msg.includes('unable to validate email'))
        return 'El formato del email no es válido.';
    if (msg.includes('password should be at least'))
        return 'La contraseña debe tener al menos 6 caracteres.';
    if (msg.includes('email address not authorized')) return 'Email no autorizado en este sistema.';
    if (msg.includes('signup is disabled')) return 'El registro está desactivado temporalmente.';
    if (msg.includes('too many requests')) return 'Demasiados intentos. Espera unos minutos.';
    return error?.message || 'Error de autenticación.';
}

/**
 * Registra un nuevo usuario.
 * @returns {{ ok: true, user, requiresConfirmation?: true } | { ok: false, error: string }}
 */
export async function signup(email, password) {
    if (!keyOk) return { ok: false, error: translateError(null) };
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) return { ok: false, error: translateError(error) };
    if (!data.session) {
        return { ok: true, requiresConfirmation: true, user: data.user };
    }
    return { ok: true, user: data.user };
}

/**
 * Inicia sesión con email y contraseña.
 * @returns {{ ok: true, user } | { ok: false, error: string }}
 */
export async function login(email, password) {
    if (!keyOk) return { ok: false, error: translateError(null) };
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { ok: false, error: translateError(error) };
    return { ok: true, user: data.user };
}

/**
 * Cierra sesión del usuario actual.
 */
export async function logout() {
    if (!keyOk) return;
    await supabase.auth.signOut();
}

/**
 * Devuelve la sesión activa o null.
 */
export async function getSession() {
    if (!keyOk) return null;
    const { data } = await supabase.auth.getSession();
    return data.session ?? null;
}

/**
 * Devuelve el usuario autenticado actual o null.
 */
export async function getCurrentUser() {
    const session = await getSession();
    return session?.user ?? null;
}

/**
 * True si hay sesión activa.
 */
export async function isAuthenticated() {
    const session = await getSession();
    return session !== null;
}
