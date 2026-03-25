/**
 * Contrato backend (Supabase) — referencia para migración.
 * No ejecuta red: solo tipos y nombres de recursos esperados.
 *
 * Esquema sugerido:
 * - organizations (id, name, plan_tier, stripe_customer_id, created_at)
 * - coaches (id, org_id, user_id, display_name, role)
 * - athletes (id, org_id, coach_id, display_name, phase, targets_json, created_at)
 * - plans (id, athlete_id, kind: 'diet'|'train', body_json, version, published_at)
 * - check_ins (id, athlete_id, payload_json, created_at)
 * - ai_events (id, org_id, coach_id, kind, meta_json, created_at)
 *
 * RLS: row-level por org_id; coach solo ve athletes de su org.
 * Límites SaaS: tabla subscription_usage + Edge Function antes de insert.
 */

export const SUPABASE_TABLES = {
    ORGANIZATIONS: 'organizations',
    COACHES: 'coaches',
    ATHLETES: 'athletes',
    PLANS: 'plans',
    CHECK_INS: 'check_ins',
    AI_EVENTS: 'ai_events',
    /** Esquema telemetría — ver supabase/migrations */
    PROFILES: 'profiles',
    SESSIONS: 'sessions',
    TELEMETRY: 'telemetry',
    INJURIES: 'injuries',
    NOTES: 'notes',
};

/** @typedef {'starter'|'pro'|'enterprise'} PlanTier */

/**
 * @param {PlanTier} tier
 * @returns {{ maxAthletes: number, maxAiPerDay: number }}
 */
export function planLimitsForTier(tier) {
    const map = {
        starter: { maxAthletes: 15, maxAiPerDay: 40 },
        pro: { maxAthletes: 80, maxAiPerDay: 200 },
        enterprise: { maxAthletes: 9999, maxAiPerDay: 2000 },
    };
    return map[tier] || map.pro;
}
