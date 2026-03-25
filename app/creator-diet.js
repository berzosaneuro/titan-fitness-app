/**
 * Creador · nutrición en vivo + barra empresa + pickers de alimentos.
 */
import { getCurrentUser } from '../auth.js';
import { FOODS } from '../data/catalogs.js';
import { getAthleteByName, listAthleteNames, updateAthletePhase } from '../data/workspace-store.js';
import { openTitanPicker } from '../components/dropdown.js';
import { getDietCopilotSurface, getTrainingCopilotSurface } from '../ai/copilot-surfaces.js';
import { getPlanAthlete, setPlanAthlete } from './session.js';

let creatorDietBound = false;

const PHASE_OPTIONS = [
    { id: 'cutting', title: 'Cutting', subtitle: 'Déficit controlado' },
    { id: 'volumen', title: 'Volumen', subtitle: 'Superávit suave / hipertrofia' },
    { id: 'recomposicion', title: 'Recomposición', subtitle: 'Reparto y fuerza' },
    { id: 'wellness', title: 'Wellness', subtitle: 'Salud y hábitos' },
];

function phaseLabel(id) {
    const o = PHASE_OPTIONS.find((p) => p.id === id);
    return o ? o.title : id;
}

export function fmtMacro(n) {
    const v = Math.round(n * 10) / 10;
    return Number.isInteger(v) ? String(v) : v.toFixed(1).replace('.', ',');
}

function applyFoodMacrosToRow(row, food) {
    if (!food || !row) return;
    row.dataset.foodId = food.id;
    row.dataset.p100 = String(food.p100);
    row.dataset.c100 = String(food.c100);
    row.dataset.f100 = String(food.f100);
    row.dataset.k100 = String(food.k100);
    const nm = row.querySelector('.diet-food-pick__name');
    if (nm) nm.textContent = food.name;
    const meta = row.querySelector('.diet-food-pick__meta');
    if (meta) {
        meta.textContent =
            food.p100 +
            'P · ' +
            food.c100 +
            'C · ' +
            food.f100 +
            'F · ' +
            food.k100 +
            ' kcal/100g';
    }
}

export function createFoodRowElement(food, grams) {
    const row = document.createElement('div');
    row.className = 'diet-food-row';
    row.innerHTML =
        '<button type="button" class="diet-food-pick" aria-label="Elegir alimento">' +
        '<span class="diet-food-pick__name"></span>' +
        '<span class="diet-food-pick__meta"></span>' +
        '<span class="diet-food-pick__chev">▾</span>' +
        '</button>' +
        '<div class="diet-food-row__grams">' +
        '<input type="number" class="diet-grams-input" min="0" step="1" value="' +
        String(grams) +
        '" aria-label="Gramos" />' +
        '<span class="diet-food-row__unit">g</span>' +
        '</div>' +
        '<div class="diet-food-row__mini"><span class="dfr-k">0</span> kcal · <span class="dfr-p">0</span>P · <span class="dfr-c">0</span>C · <span class="dfr-f">0</span>F</div>';
    applyFoodMacrosToRow(row, food);
    return row;
}

function parseRowMacros(row) {
    const g = Math.max(0, parseFloat(row.querySelector('.diet-grams-input')?.value) || 0);
    const f = g / 100;
    const p = (parseFloat(row.dataset.p100) || 0) * f;
    const c = (parseFloat(row.dataset.c100) || 0) * f;
    const fat = (parseFloat(row.dataset.f100) || 0) * f;
    const k = (parseFloat(row.dataset.k100) || 0) * f;
    return { g, p, c, f: fat, k };
}

function renderDietCopilot(actual, target) {
    const host = document.getElementById('creator-diet-copilot-body');
    if (!host) return;
    const surf = getDietCopilotSurface(actual, target);
    host.innerHTML =
        '<div class="ai-surface__head text-small">' +
        surf.headline +
        '</div>' +
        surf.items
            .map(
                (it) =>
                    '<div class="ai-surface__item">' +
                    '<div class="ai-surface__sug text-neon">' +
                    it.suggestion +
                    '</div>' +
                    '<div class="ai-surface__why text-small text-metal">' +
                    '<span class="ai-surface__tag">Por qué</span> ' +
                    it.because +
                    '</div></div>'
            )
            .join('');
}

export function recalcCreatorDiet() {
    const root = document.getElementById('creator-diet');
    if (!root) return;

    const targets = {
        k: parseFloat(root.dataset.targetKcal) || 2200,
        p: parseFloat(root.dataset.targetP) || 165,
        c: parseFloat(root.dataset.targetC) || 280,
        f: parseFloat(root.dataset.targetF) || 40,
    };

    const sumEl = document.getElementById('diet-target-summary');
    if (sumEl) {
        sumEl.textContent =
            targets.k +
            ' kcal · ' +
            targets.p +
            'P · ' +
            targets.c +
            'C · ' +
            targets.f +
            'F';
    }

    let tK = 0;
    let tP = 0;
    let tC = 0;
    let tF = 0;

    root.querySelectorAll('.diet-food-row').forEach((row) => {
        const m = parseRowMacros(row);
        tK += m.k;
        tP += m.p;
        tC += m.c;
        tF += m.f;
        const kEl = row.querySelector('.dfr-k');
        const pEl = row.querySelector('.dfr-p');
        const cEl = row.querySelector('.dfr-c');
        const fEl = row.querySelector('.dfr-f');
        if (kEl) kEl.textContent = fmtMacro(m.k);
        if (pEl) pEl.textContent = fmtMacro(m.p);
        if (cEl) cEl.textContent = fmtMacro(m.c);
        if (fEl) fEl.textContent = fmtMacro(m.f);
    });

    root.querySelectorAll('.meal-card[data-meal]').forEach((card) => {
        const id = card.getAttribute('data-meal');
        let mK = 0;
        let mP = 0;
        let mC = 0;
        let mF = 0;
        card.querySelectorAll('.diet-food-row').forEach((row) => {
            const m = parseRowMacros(row);
            mK += m.k;
            mP += m.p;
            mC += m.c;
            mF += m.f;
        });
        const out = card.querySelector('[data-meal-sum="' + id + '"]');
        if (out) {
            out.textContent =
                fmtMacro(mK) +
                ' kcal · ' +
                fmtMacro(mP) +
                'P / ' +
                fmtMacro(mC) +
                'C / ' +
                fmtMacro(mF) +
                'F';
        }
    });

    const setText = (id, txt) => {
        const el = document.getElementById(id);
        if (el) el.textContent = txt;
    };
    setText('macro-total-kcal', fmtMacro(tK));
    setText('macro-total-p', fmtMacro(tP));
    setText('macro-total-c', fmtMacro(tC));
    setText('macro-total-f', fmtMacro(tF));

    const pct = (num, den) => (den > 0 ? Math.min(100, Math.round((num / den) * 100)) : 0);
    const barK = document.getElementById('macro-bar-kcal');
    const barP = document.getElementById('macro-bar-p');
    const barC = document.getElementById('macro-bar-c');
    const barF = document.getElementById('macro-bar-f');
    if (barK) barK.style.width = pct(tK, targets.k) + '%';
    if (barP) barP.style.width = pct(tP, targets.p) + '%';
    if (barC) barC.style.width = pct(tC, targets.c) + '%';
    if (barF) barF.style.width = pct(tF, targets.f) + '%';

    setText('macro-pct-kcal', pct(tK, targets.k) + '% obj.');
    setText('macro-pct-p', pct(tP, targets.p) + '% obj.');
    setText('macro-pct-c', pct(tC, targets.c) + '% obj.');
    setText('macro-pct-f', pct(tF, targets.f) + '% obj.');

    const kFromMacros = 4 * tP + 4 * tC + 9 * tF;
    const denom = kFromMacros > 0 ? kFromMacros : 1;
    const pp = Math.round((4 * tP * 100) / denom);
    const cp = Math.round((4 * tC * 100) / denom);
    const fp = Math.max(0, 100 - pp - cp);
    setText('macro-split-p', 'P ' + pp + '%');
    setText('macro-split-c', 'C ' + cp + '%');
    setText('macro-split-f', 'F ' + fp + '%');

    const fb = document.getElementById('diet-feedback');
    if (fb) {
        fb.innerHTML = '';
        const addBadge = (cls, text) => {
            const s = document.createElement('span');
            s.className = 'diet-badge ' + cls;
            s.textContent = text;
            fb.appendChild(s);
        };
        const kRatio = targets.k > 0 ? tK / targets.k : 1;
        if (kRatio < 0.93) {
            addBadge('diet-badge--warn', 'Calorías por debajo del objetivo');
        } else if (kRatio > 1.07) {
            addBadge('diet-badge--danger', 'Calorías por encima del objetivo');
        } else {
            addBadge('diet-badge--ok', 'Calorías en rango');
        }
        const pRatio = targets.p > 0 ? tP / targets.p : 1;
        if (pRatio < 0.88) {
            addBadge('diet-badge--danger', 'Proteína baja vs plan');
        } else if (pRatio > 1.12) {
            addBadge('diet-badge--warn', 'Proteína alta · revisar reparto');
        } else {
            addBadge('diet-badge--ok', 'Proteína alineada');
        }
        if (tC < targets.c * 0.85) {
            addBadge('diet-badge--warn', 'Carbs por debajo · rendimiento');
        } else if (tC > targets.c * 1.12) {
            addBadge('diet-badge--warn', 'Carbs altos vs objetivo');
        } else {
            addBadge('diet-badge--ok', 'Carbs en rango');
        }
    }

    renderDietCopilot(
        { kcal: tK, p: tP, c: tC, f: tF },
        { kcal: targets.k, p: targets.p, c: targets.c, f: targets.f }
    );
}

export function refreshTrainingCopilotPanel() {
    const host = document.getElementById('creator-train-copilot-body');
    if (!host) return;
    const cards = document.querySelectorAll('#creator-train .exercise-card');
    const blocks = [];
    cards.forEach((card) => {
        const wIn = card.querySelector('.ex-field__in--weight');
        blocks.push({
            name: card.querySelector('.exercise-card__name')?.textContent?.trim() || 'Ejercicio',
            fatigue: card.getAttribute('data-fatigue') || 'media',
            intensity: card.getAttribute('data-intensity') || 'media',
            weight: parseFloat(wIn && wIn.value) || 0,
            prevWeight: parseFloat(card.getAttribute('data-prev-weight')) || 0,
        });
    });
    const surf = getTrainingCopilotSurface(blocks);
    host.innerHTML =
        '<div class="ai-surface__head text-small">' +
        surf.headline +
        '</div>' +
        surf.items
            .map(
                (it) =>
                    '<div class="ai-surface__item">' +
                    '<div class="ai-surface__sug text-neon">' +
                    it.suggestion +
                    '</div>' +
                    '<div class="ai-surface__why text-small text-metal">' +
                    '<span class="ai-surface__tag">Por qué</span> ' +
                    it.because +
                    '</div></div>'
            )
            .join('');
}

function openFoodPickerForRow(row) {
    const items = FOODS.map((f) => ({
        id: f.id,
        title: f.name,
        subtitle: f.p100 + 'P · ' + f.c100 + 'C · ' + f.f100 + 'F',
        meta: f.k100 + ' kcal/100g · ' + f.tags,
    }));
    openTitanPicker({
        title: 'Alimento',
        placeholder: 'Buscar alimento o macro…',
        items,
        searchIn: ['title', 'subtitle', 'meta'],
        onSelect: (it) => {
            const food = FOODS.find((f) => f.id === it.id);
            if (food) applyFoodMacrosToRow(row, food);
            recalcCreatorDiet();
        },
    });
}

function bindTargetInputs(root) {
    const pairs = [
        ['creator-target-kcal', 'targetKcal'],
        ['creator-target-p', 'targetP'],
        ['creator-target-c', 'targetC'],
        ['creator-target-f', 'targetF'],
    ];
    pairs.forEach(([elId, dk]) => {
        const el = document.getElementById(elId);
        if (!el) return;
        el.addEventListener('input', () => {
            const v = parseFloat(el.value);
            if (!Number.isNaN(v) && v >= 0) {
                root.dataset[dk] = String(v);
            }
            recalcCreatorDiet();
        });
    });
}

function updateCreatorContextLabels(name, phaseId) {
    const aBtn = document.getElementById('creator-pick-athlete');
    if (aBtn) aBtn.textContent = name + ' ▾';
    const pBtn = document.getElementById('creator-pick-phase');
    if (pBtn) pBtn.textContent = 'Fase: ' + phaseLabel(phaseId) + ' ▾';
    const phEl = document.getElementById('creator-phase-pill');
    if (phEl) phEl.textContent = phaseLabel(phaseId).toUpperCase();
}

export function syncCreatorPlanFromWorkspace() {
    const user = getCurrentUser();
    const name = getPlanAthlete();
    const ath = getAthleteByName(user, name);
    const root = document.getElementById('creator-diet');
    if (!root) return;
    if (ath && ath.targets) {
        root.dataset.targetKcal = String(ath.targets.kcal);
        root.dataset.targetP = String(ath.targets.p);
        root.dataset.targetC = String(ath.targets.c);
        root.dataset.targetF = String(ath.targets.f);
        const map = [
            ['creator-target-kcal', ath.targets.kcal],
            ['creator-target-p', ath.targets.p],
            ['creator-target-c', ath.targets.c],
            ['creator-target-f', ath.targets.f],
        ];
        map.forEach(([id, val]) => {
            const el = document.getElementById(id);
            if (el) el.value = String(val);
        });
        updateCreatorContextLabels(ath.name, ath.phase);
    } else {
        updateCreatorContextLabels(name, 'volumen');
    }
    recalcCreatorDiet();
}

function bindEnterpriseBar() {
    const root = document.getElementById('creator-diet');
    const user = () => getCurrentUser();

    const aBtn = document.getElementById('creator-pick-athlete');
    if (aBtn) {
        aBtn.addEventListener('click', () => {
            const names = listAthleteNames(user());
            openTitanPicker({
                title: 'Atleta del plan',
                items: names.map((n) => ({ id: n, title: n, subtitle: 'Cargar objetivos del workspace' })),
                onSelect: (it) => {
                    setPlanAthlete(it.title);
                    syncCreatorPlanFromWorkspace();
                },
            });
        });
    }

    const pBtn = document.getElementById('creator-pick-phase');
    if (pBtn) {
        pBtn.addEventListener('click', () => {
            openTitanPicker({
                title: 'Fase nutricional',
                items: PHASE_OPTIONS.map((p) => ({ id: p.id, title: p.title, subtitle: p.subtitle })),
                onSelect: (it) => {
                    updateAthletePhase(user(), getPlanAthlete(), it.id);
                    updateCreatorContextLabels(getPlanAthlete(), it.id);
                },
            });
        });
    }

    if (root) bindTargetInputs(root);
}

export function initCreatorNutrition() {
    const root = document.getElementById('creator-diet');
    if (!root || creatorDietBound) return;
    creatorDietBound = true;

    root.addEventListener('input', (e) => {
        const t = e.target;
        if (t.classList.contains('diet-grams-input')) {
            recalcCreatorDiet();
        }
    });

    root.addEventListener('click', (e) => {
        const pick = e.target.closest('.diet-food-pick');
        if (pick) {
            const row = pick.closest('.diet-food-row');
            if (row) openFoodPickerForRow(row);
        }
        const addBtn = e.target.closest('.meal-card__add-food');
        if (addBtn) {
            const meal = addBtn.getAttribute('data-meal');
            const card = root.querySelector('.meal-card[data-meal="' + meal + '"]');
            if (!card) return;
            const items = FOODS.map((f) => ({
                id: f.id,
                title: f.name,
                subtitle: f.p100 + 'P · ' + f.c100 + 'C · ' + f.f100 + 'F',
                meta: f.k100 + ' kcal/100g',
            }));
            openTitanPicker({
                title: 'Añadir a comida ' + meal,
                items,
                searchIn: ['title', 'subtitle', 'meta'],
                onSelect: (it) => {
                    const food = FOODS.find((f) => f.id === it.id);
                    if (!food) return;
                    const body = card.querySelector('.meal-card__body');
                    if (!body) return;
                    const row = createFoodRowElement(food, 100);
                    body.appendChild(row);
                    recalcCreatorDiet();
                },
            });
        }
    });

    bindEnterpriseBar();
    const train = document.getElementById('creator-train');
    if (train && !train.dataset.copilotWeightBound) {
        train.dataset.copilotWeightBound = '1';
        train.addEventListener('input', (e) => {
            if (e.target.classList.contains('ex-field__in--weight')) {
                refreshTrainingCopilotPanel();
            }
        });
    }
    syncCreatorPlanFromWorkspace();
    recalcCreatorDiet();
}
