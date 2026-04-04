/**
 * app/creator-diet.js — Módulo del Creador de Dietas.
 *
 * Responsabilidades:
 *  - initCreatorNutrition(): enlaza eventos de input para cálculo en vivo.
 *  - recalcCreatorDiet(): recalcula macros desde los food rows del DOM.
 *  - syncCreatorPlanFromWorkspace(): actualiza el badge de atleta en el creador.
 *  - refreshTrainingCopilotPanel(): muestra sugerencias IA en el panel copiloto.
 */

import { getPlanAthlete } from './session.js';
import { suggestPlanAdjustments } from '../ai.js';

// ── Selectores ────────────────────────────────────────────────────────────────

const SEL = {
    dietPane: '#creator-diet',
    foodRow: '.diet-food-row',
    gramsInput: '.diet-grams-input',
    miniKcal: '.dfr-k',
    miniP: '.dfr-p',
    miniC: '.dfr-c',
    miniF: '.dfr-f',
    totalKcal: '#macro-total-kcal',
    totalP: '#macro-total-p',
    totalC: '#macro-total-c',
    totalF: '#macro-total-f',
    barKcal: '#macro-bar-kcal',
    barP: '#macro-bar-p',
    barC: '#macro-bar-c',
    barF: '#macro-bar-f',
    pctKcal: '#macro-pct-kcal',
    pctP: '#macro-pct-p',
    pctC: '#macro-pct-c',
    pctF: '#macro-pct-f',
    splitP: '#macro-split-p',
    splitC: '#macro-split-c',
    splitF: '#macro-split-f',
    feedback: '#diet-feedback',
    targetSummary: '#diet-target-summary',
    targetKcal: '#creator-target-kcal',
    targetP: '#creator-target-p',
    targetC: '#creator-target-c',
    targetF: '#creator-target-f',
    pickAthlete: '#creator-pick-athlete',
    phasePill: '#creator-phase-pill',
    copilotBody: '#creator-diet-copilot-body',
    addFoodBtns: '.meal-card__add-food',
    mealSums: '[data-meal-sum]',
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function $(sel, root = document) {
    return root.querySelector(sel);
}
function $$(sel, root = document) {
    return Array.from(root.querySelectorAll(sel));
}
function num(val, fallback = 0) {
    const n = parseFloat(val);
    return isNaN(n) ? fallback : n;
}
function clamp(val, min, max) {
    return Math.min(Math.max(val, min), max);
}
function fmt(n) {
    return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

// ── Cálculo por fila ──────────────────────────────────────────────────────────

/**
 * Calcula macros de una sola fila .diet-food-row y actualiza los spans mini.
 * @param {HTMLElement} row
 * @returns {{ kcal: number, p: number, c: number, f: number }}
 */
function calcRow(row) {
    const grams = num($(SEL.gramsInput, row)?.value, 0);
    const p100 = num(row.dataset.p100, 0);
    const c100 = num(row.dataset.c100, 0);
    const f100 = num(row.dataset.f100, 0);
    const k100 = num(row.dataset.k100, 0);

    const factor = grams / 100;
    const p = parseFloat((p100 * factor).toFixed(1));
    const c = parseFloat((c100 * factor).toFixed(1));
    const f = parseFloat((f100 * factor).toFixed(1));
    const kcal = parseFloat((k100 * factor).toFixed(0));

    const mini = {
        k: $(SEL.miniKcal, row),
        p: $(SEL.miniP, row),
        c: $(SEL.miniC, row),
        f: $(SEL.miniF, row),
    };
    if (mini.k) mini.k.textContent = fmt(kcal);
    if (mini.p) mini.p.textContent = fmt(p);
    if (mini.c) mini.c.textContent = fmt(c);
    if (mini.f) mini.f.textContent = fmt(f);

    return { kcal, p, c, f };
}

// ── Dock de macros ────────────────────────────────────────────────────────────

function updateDock(totals, targets) {
    const set = (sel, val) => {
        const el = $(sel);
        if (el) el.textContent = val;
    };
    const pct = (v, t) => (t > 0 ? clamp(Math.round((v / t) * 100), 0, 150) : 0);
    const bar = (sel, p) => {
        const el = $(sel);
        if (!el) return;
        el.style.width = clamp(p, 0, 100) + '%';
        el.style.background = p > 105 ? '#FF3B3B' : p > 95 ? '#00FF88' : '#00aa55';
    };

    set(SEL.totalKcal, fmt(totals.kcal));
    set(SEL.totalP, fmt(totals.p));
    set(SEL.totalC, fmt(totals.c));
    set(SEL.totalF, fmt(totals.f));

    const pk = pct(totals.kcal, targets.kcal);
    const pp = pct(totals.p, targets.p);
    const pc = pct(totals.c, targets.c);
    const pf = pct(totals.f, targets.f);

    bar(SEL.barKcal, pk);
    bar(SEL.barP, pp);
    bar(SEL.barC, pc);
    bar(SEL.barF, pf);

    set(SEL.pctKcal, pk + '%');
    set(SEL.pctP, pp + '%');
    set(SEL.pctC, pc + '%');
    set(SEL.pctF, pf + '%');

    // Reparto energético (P·4 / C·4 / F·9)
    const totalEnergy = totals.p * 4 + totals.c * 4 + totals.f * 9;
    if (totalEnergy > 0) {
        set(SEL.splitP, 'P ' + Math.round((totals.p * 4 / totalEnergy) * 100) + '%');
        set(SEL.splitC, 'C ' + Math.round((totals.c * 4 / totalEnergy) * 100) + '%');
        set(SEL.splitF, 'F ' + Math.round((totals.f * 9 / totalEnergy) * 100) + '%');
    } else {
        set(SEL.splitP, 'P —%');
        set(SEL.splitC, 'C —%');
        set(SEL.splitF, 'F —%');
    }

    // Feedback semafórico
    const feedback = $(SEL.feedback);
    if (feedback) {
        const diff = totals.kcal - targets.kcal;
        if (Math.abs(diff) < 50) {
            feedback.textContent = '✅ En objetivo';
            feedback.style.color = '#00FF88';
        } else if (diff > 0) {
            feedback.textContent = '+' + Math.round(diff) + ' kcal sobre objetivo';
            feedback.style.color = '#FFB800';
        } else {
            feedback.textContent = Math.round(diff) + ' kcal bajo objetivo';
            feedback.style.color = '#FF3B3B';
        }
    }
}

function readTargets() {
    return {
        kcal: num($(SEL.targetKcal)?.value, 2200),
        p: num($(SEL.targetP)?.value, 165),
        c: num($(SEL.targetC)?.value, 280),
        f: num($(SEL.targetF)?.value, 40),
    };
}

function updateTargetSummary(targets) {
    const el = $(SEL.targetSummary);
    if (el) {
        el.textContent =
            targets.kcal + ' kcal · ' +
            targets.p + 'P · ' +
            targets.c + 'C · ' +
            targets.f + 'F';
    }
}

// ── Subtotales por comida ─────────────────────────────────────────────────────

function calcMealSubtotals() {
    const meals = {};

    // Agrupar filas por comida
    $$('.meal-card').forEach((card) => {
        const mealId = card.dataset.meal;
        if (!mealId) return;
        let totals = { kcal: 0, p: 0, c: 0, f: 0 };
        $$('.diet-food-row', card).forEach((row) => {
            const r = calcRow(row);
            totals.kcal += r.kcal;
            totals.p += r.p;
            totals.c += r.c;
            totals.f += r.f;
        });
        meals[mealId] = totals;

        const sumEl = $('[data-meal-sum="' + mealId + '"]', card);
        if (sumEl) {
            sumEl.textContent =
                fmt(totals.kcal) + ' kcal · ' +
                fmt(totals.p) + 'P / ' +
                fmt(totals.c) + 'C / ' +
                fmt(totals.f) + 'F';
        }
    });

    return meals;
}

// ── API pública ───────────────────────────────────────────────────────────────

/**
 * Recalcula todos los macros del plan visible y actualiza el dock + subtotales.
 */
export function recalcCreatorDiet() {
    const meals = calcMealSubtotals();
    const totals = { kcal: 0, p: 0, c: 0, f: 0 };
    Object.values(meals).forEach((m) => {
        totals.kcal += m.kcal;
        totals.p += m.p;
        totals.c += m.c;
        totals.f += m.f;
    });
    // Redondear totales
    totals.kcal = Math.round(totals.kcal);
    totals.p = parseFloat(totals.p.toFixed(1));
    totals.c = parseFloat(totals.c.toFixed(1));
    totals.f = parseFloat(totals.f.toFixed(1));

    const targets = readTargets();
    updateDock(totals, targets);
}

/**
 * Inicializa todos los event listeners del Creador de Nutrición.
 * Debe llamarse una sola vez al mostrar el app shell.
 */
export function initCreatorNutrition() {
    // Inputs de gramos → recalcular
    document.addEventListener('input', (e) => {
        if (e.target.matches(SEL.gramsInput)) {
            recalcCreatorDiet();
        }
        // Targets del plan → actualizar summary + recalcular
        if (e.target.matches(SEL.targetKcal + ',' + SEL.targetP + ',' + SEL.targetC + ',' + SEL.targetF)) {
            const targets = readTargets();
            updateTargetSummary(targets);
            recalcCreatorDiet();
        }
    });

    // Cálculo inicial
    recalcCreatorDiet();
}

/**
 * Sincroniza el Creador con el atleta activo del workspace.
 */
export function syncCreatorPlanFromWorkspace() {
    const name = getPlanAthlete();
    const btn = $(SEL.pickAthlete);
    if (btn) btn.textContent = (name || 'Sin atleta') + ' ▾';
}

/**
 * Muestra sugerencias de plan del copiloto IA en el panel del Creador.
 */
export async function refreshTrainingCopilotPanel() {
    const body = $(SEL.copilotBody);
    if (!body) return;

    body.innerHTML = '<div class="text-small text-chrome">Analizando plan…</div>';

    try {
        const athlete = getPlanAthlete();
        const adj = await suggestPlanAdjustments({
            screen: 'creador',
            athlete,
            targets: readTargets(),
        });

        if (!adj || !adj.items || !adj.items.length) {
            body.innerHTML = '<p class="text-small">Sin sugerencias disponibles.</p>';
            return;
        }

        body.innerHTML = adj.items
            .map(
                (it) =>
                    '<div class="ai-adjust-item u-mb-10">' +
                    '<div class="text-neon" style="font-size:12px;font-weight:600;">' + _esc(it.area) + '</div>' +
                    '<div class="text-chrome text-small">' + _esc(it.suggestion) + '</div>' +
                    '<div class="text-small" style="color:#555;">' + _esc(it.rationale) + '</div>' +
                    '</div>'
            )
            .join('<div class="divider"></div>') +
            '<div class="text-small" style="color:#444;margin-top:8px;">Fuente: ' + _esc(adj.source) + '</div>';
    } catch (err) {
        body.innerHTML = '<p class="text-small u-text-danger">Error al cargar sugerencias.</p>';
        console.warn('[creator-diet] refreshTrainingCopilotPanel', err);
    }
}

function _esc(text) {
    const d = document.createElement('div');
    d.textContent = String(text ?? '');
    return d.innerHTML;
}
