/**
 * app/enterprise-dashboard.js — Dashboard empresarial: KPI strip + rail de alertas.
 * Renderiza en #enterprise-kpi-strip y #enterprise-alert-rail (screen-inicio).
 * Los datos se obtienen de Supabase si está configurado; si no, usa mocks coherentes.
 */

import { tryGetSupabaseClient } from '../supabaseClient.js';
import { getCurrentUser } from '../auth.js';

// ── Helpers DOM ───────────────────────────────────────────────────────────────

function esc(text) {
    const d = document.createElement('div');
    d.textContent = String(text ?? '');
    return d.innerHTML;
}

// ── Mock data ─────────────────────────────────────────────────────────────────

function getMockKPIs() {
    return {
        activeAthletes: 5,
        checkInRate: 82,        // %
        monthlyRevenue: 4200,   // €
        pendingPayments: 1,
        sessionsThisWeek: 18,
        avgAdherence: 87,       // %
    };
}

function getMockAlerts() {
    return [
        {
            id: 'alert-stall',
            type: 'danger',
            icon: '⚠️',
            title: 'Estancamiento',
            body: 'Carlos R. sin cambios en 14 semanas.',
            action: 'Ver ficha',
            athleteName: 'Carlos R.',
        },
        {
            id: 'alert-checkin',
            type: 'warning',
            icon: '📋',
            title: 'Check-in pendiente',
            body: 'Raúl C. no ha enviado el check-in semanal.',
            action: 'Recordar',
            athleteName: 'Raúl C.',
        },
    ];
}

// ── Fetch desde Supabase (opcional) ──────────────────────────────────────────

async function fetchDashboardData() {
    const client = tryGetSupabaseClient();
    const user = getCurrentUser();
    if (!client || !user) return null;

    try {
        // Intentamos una query simple a la vista/tabla de KPIs si existe.
        const { data, error } = await client
            .from('dashboard_kpis')
            .select('*')
            .eq('coach_id', user.id)
            .single();
        if (error || !data) return null;
        return data;
    } catch {
        return null;
    }
}

// ── Render ────────────────────────────────────────────────────────────────────

function renderKPIStrip(kpis) {
    const strip = document.getElementById('enterprise-kpi-strip');
    if (!strip) return;

    const tiles = [
        { label: 'ATLETAS ACTIVOS', value: kpis.activeAthletes, icon: '👥', unit: '' },
        { label: 'TASA CHECK-IN', value: kpis.checkInRate, icon: '📋', unit: '%' },
        { label: 'INGRESOS MES', value: '€' + kpis.monthlyRevenue.toLocaleString('es-ES'), icon: '💰', unit: '' },
        { label: 'ADHERENCIA MEDIA', value: kpis.avgAdherence, icon: '📈', unit: '%' },
    ];

    strip.innerHTML = tiles
        .map(
            (t) =>
                '<div class="kpi-tile cyber-card">' +
                '<div class="kpi-tile__icon">' + t.icon + '</div>' +
                '<div class="kpi-tile__value text-neon">' + esc(t.value) + esc(t.unit) + '</div>' +
                '<div class="kpi-tile__label text-small">' + esc(t.label) + '</div>' +
                '</div>'
        )
        .join('');
}

function renderAlertRail(alerts) {
    const rail = document.getElementById('enterprise-alert-rail');
    if (!rail || !alerts.length) return;

    rail.innerHTML = alerts
        .map(
            (a) =>
                '<div class="enterprise-alert enterprise-alert--' + esc(a.type) + '" data-id="' + esc(a.id) + '">' +
                '<span class="enterprise-alert__icon">' + a.icon + '</span>' +
                '<div class="enterprise-alert__body">' +
                '<span class="enterprise-alert__title">' + esc(a.title) + '</span>' +
                '<span class="text-small enterprise-alert__text">' + esc(a.body) + '</span>' +
                '</div>' +
                '<button type="button" class="enterprise-alert__dismiss text-small" aria-label="Cerrar">✕</button>' +
                '</div>'
        )
        .join('');

    // Bind dismiss buttons
    rail.querySelectorAll('.enterprise-alert__dismiss').forEach((btn) => {
        btn.addEventListener('click', () => {
            const alert = btn.closest('.enterprise-alert');
            if (alert) {
                alert.style.opacity = '0';
                alert.style.transform = 'translateX(20px)';
                setTimeout(() => alert.remove(), 200);
            }
        });
    });
}

// ── Estilos integrados ────────────────────────────────────────────────────────

function injectStyles() {
    if (document.getElementById('enterprise-dash-styles')) return;
    const style = document.createElement('style');
    style.id = 'enterprise-dash-styles';
    style.textContent = `
.enterprise-kpi-strip {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 8px;
    margin: 12px 0;
}
@media (min-width: 480px) {
    .enterprise-kpi-strip { grid-template-columns: repeat(4, 1fr); }
}
.kpi-tile {
    text-align: center;
    padding: 12px 8px !important;
    display: flex; flex-direction: column; align-items: center; gap: 4px;
}
.kpi-tile__icon { font-size: 20px; line-height: 1; }
.kpi-tile__value { font-size: 20px; font-weight: 700; }
.kpi-tile__label { font-size: 9px; text-transform: uppercase; letter-spacing: 0.08em; color: #666; }

.enterprise-alert-rail { display: flex; flex-direction: column; gap: 6px; margin: 8px 0; }
.enterprise-alert {
    display: flex; align-items: center; gap: 10px;
    padding: 10px 12px;
    border-radius: 6px;
    border-left: 3px solid #555;
    background: #0d0d0d;
    transition: opacity 0.2s, transform 0.2s;
}
.enterprise-alert--danger { border-left-color: #FF3B3B; }
.enterprise-alert--warning { border-left-color: #FFB800; }
.enterprise-alert__icon { font-size: 18px; flex-shrink: 0; }
.enterprise-alert__body { flex: 1; display: flex; flex-direction: column; gap: 2px; }
.enterprise-alert__title { font-size: 12px; font-weight: 600; color: #e0e0e0; }
.enterprise-alert__text { color: #888; }
.enterprise-alert__dismiss {
    background: none; border: none; color: #555; cursor: pointer;
    padding: 4px; flex-shrink: 0;
}
.enterprise-alert__dismiss:hover { color: #fff; }
    `;
    document.head.appendChild(style);
}

// ── Punto de entrada ──────────────────────────────────────────────────────────

/**
 * Refresca el dashboard empresarial.
 * Intenta Supabase; fallback a mocks si no está disponible.
 */
export async function refreshEnterpriseHome() {
    injectStyles();
    const mock = getMockKPIs();

    // Render inmediato con mocks mientras se espera Supabase
    renderKPIStrip(mock);
    renderAlertRail(getMockAlerts());

    // Intento de datos reales en background (no bloquea la UI)
    const real = await fetchDashboardData();
    if (real) {
        const merged = { ...mock, ...real };
        renderKPIStrip(merged);
    }
}
