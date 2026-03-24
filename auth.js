/**
 * Capa de autenticación — Supabase.
 * Sin DOM. Toda la lógica de UI vive en app.js.
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = 'https://ilzkwweahzmcmgipylbi.supabase.co';
// Obtén esta clave en: Supabase Dashboard → Settings → API → anon public
const SUPABASE_ANON_KEY = 'TU_SUPABASE_ANON_KEY';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export const ROLE = {
    COACH: 'coach',
    ADMIN: 'admin',
    VIEWER: 'viewer',
};

function translateError(error) {
    const msg = (error?.message || '').toLowerCase();
    if (msg.includes('invalid login credentials')) return 'Email o contraseña incorrectos.';
    if (msg.includes('email not confirmed')) return 'Confirma tu email antes de acceder.';
    if (msg.includes('user already registered')) return 'Este email ya está registrado.';
    if (msg.includes('invalid email') || msg.includes('unable to validate email')) return 'El formato del email no es válido.';
    if (msg.includes('password should be at least')) return 'La contraseña debe tener al menos 6 caracteres.';
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
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) return { ok: false, error: translateError(error) };
    // Si confirmación de email está activa, session es null hasta confirmar
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
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { ok: false, error: translateError(error) };
    return { ok: true, user: data.user };
}

/**
 * Cierra sesión del usuario actual.
 */
export async function logout() {
    await supabase.auth.signOut();
}

/**
 * Devuelve la sesión activa o null.
 */
export async function getSession() {
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
