/**
 * Dashboard modo empresa: KPIs + carril de alertas (datos workspace).
 */
import { getCurrentUser } from '../auth.js';
import { getWorkspaceAlerts, getWorkspaceKpis, loadWorkspace } from '../data/workspace-store.js';
import { TENANT_CONFIG } from '../ai.js';
import { planLimitsForTier } from '../data/supabase-contract.js';
import { countSessionsInLastDays } from '../trainingSession.js';

function esc(s) {
    const d = document.createElement('div');
    d.textContent = s == null ? '' : String(s);
    return d.innerHTML;
}

function fmtMoney(n) {
    return (
        new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(
            n
        ) + ' /mes'
    );
}

function fmtPct(x) {
    return Math.round(x * 100) + '%';
}

export async function refreshEnterpriseHome() {
    const user = getCurrentUser();
    if (!user) return;
    const ws = loadWorkspace(user);
    const kpis = ws.kpis || getWorkspaceKpis(user);
    const alerts = ws.alerts || getWorkspaceAlerts(user);
    const tier = (ws.planLimits && ws.planLimits.tier) || TENANT_CONFIG.plan || 'pro';
    const limits = planLimitsForTier(tier);
    const sessions7d = await countSessionsInLastDays(7);

    const kpiHost = document.getElementById('enterprise-kpi-strip');
    if (kpiHost) {
        const thirdValue =
            sessions7d != null ? esc(String(sessions7d)) : esc(fmtMoney(kpis.revenueMonthlyMock));
        const thirdLabel = sessions7d != null ? 'Sesiones telemetría (7d)' : 'Ingresos recurrentes';
        const thirdHint =
            sessions7d != null
                ? 'Datos reales · Supabase'
                : 'Previsión workspace · conecta Supabase para sesiones';
        kpiHost.innerHTML =
            '<article class="kpi-card kpi-card--clients">' +
            '<div class="kpi-card__icon">👥</div>' +
            '<div class="kpi-card__body">' +
            '<div class="kpi-card__value">' +
            esc(kpis.activeClients) +
            '</div>' +
            '<div class="kpi-card__label">Clientes activos</div>' +
            '<div class="kpi-card__hint">Límite plan · ' +
            esc(String(limits.maxAthletes)) +
            '</div></div></article>' +
            '<article class="kpi-card kpi-card--adh">' +
            '<div class="kpi-card__icon">📈</div>' +
            '<div class="kpi-card__body">' +
            '<div class="kpi-card__value">' +
            esc(fmtPct(kpis.adherenceAvg)) +
            '</div>' +
            '<div class="kpi-card__label">Adherencia media</div>' +
            '<div class="kpi-card__hint">Check-ins + sesiones</div></div></article>' +
            '<article class="kpi-card kpi-card--rev">' +
            '<div class="kpi-card__icon">📡</div>' +
            '<div class="kpi-card__body">' +
            '<div class="kpi-card__value kpi-card__value--sm">' +
            thirdValue +
            '</div>' +
            '<div class="kpi-card__label">' +
            esc(thirdLabel) +
            '</div>' +
            '<div class="kpi-card__hint">' +
            esc(thirdHint) +
            '</div></div></article>';
    }

    const rail = document.getElementById('enterprise-alert-rail');
    if (rail) {
        const org = ws.organizationName || 'Organización';
        rail.innerHTML =
            '<div class="alert-rail__head">' +
            '<span class="alert-rail__org">' +
            esc(org) +
            '</span>' +
            '<span class="alert-rail__tenant text-small">Tenant · ' +
            esc(user.tenantId || TENANT_CONFIG.tenantId) +
            ' · IA hoy ' +
            esc(String(kpis.aiCallsUsed || 0)) +
            '/' +
            esc(String(limits.maxAiPerDay)) +
            '</span></div>' +
            '<div class="alert-rail__scroller">' +
            alerts
                .map(
                    (a) =>
                        '<article class="alert-chip alert-chip--' +
                        esc(a.severity) +
                        '" data-alert-id="' +
                        esc(a.id) +
                        '">' +
                        '<div class="alert-chip__title">' +
                        esc(a.title) +
                        '</div>' +
                        '<div class="alert-chip__athlete text-small">' +
                        esc(a.athlete) +
                        '</div>' +
                        '<p class="alert-chip__detail text-small">' +
                        esc(a.detail) +
                        '</p>' +
                        '<div class="alert-chip__action text-neon text-small">' +
                        esc(a.action) +
                        '</div></article>'
                )
                .join('') +
            '</div>';
    }
}
