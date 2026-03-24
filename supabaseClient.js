/**
 * Cliente Supabase (singleton) para el navegador.
 *
 * Requisito: cargar antes el UMD de `@supabase/supabase-js@2` (ver `index.html`).
 *
 * Variables de entorno (primera fuente con valor gana):
 * - `import.meta.env` — p. ej. Vite: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, o nombres sin prefijo si el bundler los inyecta.
 * - `globalThis.__ENV__` — inyección en runtime sin bundler (`__ENV__ = { SUPABASE_URL, SUPABASE_ANON_KEY }`).
 */

/** @returns {{ url: string, anonKey: string }} */
function resolveSupabaseEnv() {
    const metaEnv =
        typeof import.meta !== 'undefined' &&
        import.meta.env &&
        typeof import.meta.env === 'object'
            ? import.meta.env
            : {};

    const injected =
        typeof globalThis !== 'undefined' &&
        globalThis.__ENV__ &&
        typeof globalThis.__ENV__ === 'object'
            ? globalThis.__ENV__
            : {};

    const url = String(
        metaEnv.SUPABASE_URL ||
            metaEnv.VITE_SUPABASE_URL ||
            injected.SUPABASE_URL ||
            ''
    ).trim();

    const anonKey = String(
        metaEnv.SUPABASE_ANON_KEY ||
            metaEnv.VITE_SUPABASE_ANON_KEY ||
            injected.SUPABASE_ANON_KEY ||
            ''
    ).trim();

    return { url, anonKey };
}

/** @returns {boolean} */
export function isSupabaseConfigured() {
    const { url, anonKey } = resolveSupabaseEnv();
    return Boolean(url && anonKey);
}

/**
 * Cliente si hay URL/key y está cargado el UMD; si no, null (sin lanzar).
 * @returns {import('@supabase/supabase-js').SupabaseClient | null}
 */
export function tryGetSupabaseClient() {
    if (!isSupabaseConfigured()) {
        return null;
    }
    try {
        return getSupabaseClient();
    } catch {
        return null;
    }
}

function getCreateClientFn() {
    const lib = typeof globalThis !== 'undefined' ? globalThis.supabase : undefined;
    if (!lib || typeof lib.createClient !== 'function') {
        throw new Error(
            'supabaseClient.js: falta Supabase createClient. Carga Supabase antes que los módulos (UMD en index.html o import ESM desde esm.sh) para que exista window.supabase.createClient.'
        );
    }
    return lib.createClient;
}

let _client = null;

/**
 * Devuelve la instancia única de `SupabaseClient` (lazy).
 * @returns {import('@supabase/supabase-js').SupabaseClient}
 */
export function getSupabaseClient() {
    if (_client) {
        return _client;
    }
    const { url, anonKey } = resolveSupabaseEnv();
    if (!url || !anonKey) {
        throw new Error(
            'supabaseClient.js: define SUPABASE_URL y SUPABASE_ANON_KEY (p. ej. VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY en Vite, o globalThis.__ENV__).'
        );
    }
    const createClient = getCreateClientFn();
    _client = createClient(url, anonKey, {
        auth: {
            persistSession: true,
            autoRefreshToken: true,
            detectSessionInUrl: true,
        },
    });
    return _client;
}

/**
 * Proxy al cliente: permite `supabase.from(...)` con la misma API que el SDK.
 * Los métodos se enlazan correctamente al cliente real.
 */
export const supabase = new Proxy(
    {},
    {
        get(_target, prop, _receiver) {
            const client = getSupabaseClient();
            const value = Reflect.get(client, prop, client);
            if (typeof value === 'function') {
                return value.bind(client);
            }
            return value;
        },
    }
);

export default supabase;
