/**
 * Vercel Serverless Function: expone configuración pública necesaria para Supabase.
 *
 * Configura en Vercel → Project → Settings → Environment Variables:
 * - SUPABASE_URL
 * - SUPABASE_ANON_KEY
 *
 * IMPORTANTE: NO uses service_role aquí.
 */

module.exports = function handler(req, res) {
  const SUPABASE_URL = String(process.env.SUPABASE_URL || '').trim();
  const SUPABASE_ANON_KEY = String(process.env.SUPABASE_ANON_KEY || '').trim();

  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    res.statusCode = 500;
    res.end(
      JSON.stringify({
        error: 'Missing SUPABASE_URL or SUPABASE_ANON_KEY on server environment.',
      })
    );
    return;
  }

  res.statusCode = 200;
  res.end(
    JSON.stringify({
      SUPABASE_URL,
      SUPABASE_ANON_KEY,
    })
  );
}
