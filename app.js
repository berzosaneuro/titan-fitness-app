/**
 * A�S ROOM OS — lógica de aplicación (UI, navegación, modales).
 * Autenticación: ./auth.js (sin DOM). IA: ./ai.js (sin DOM).
 */
import {
    analyzeAthlete,
    generateClientMessage,
    getAILogSnapshot,
    getDailySummary,
    suggestPlanAdjustments,
    TENANT_CONFIG,
} from './ai.js';
import {
    getCurrentUser,
    getSession,
    login,
    logout as authLogout,
    signup,
} from './auth.js';

// ——— Rutas (preparado Next.js App Router) ———
const SCREEN_IDS = {
    INICIO: 'inicio',
    ATLETAS: 'atletas',
    ATHLETE_DETAIL: 'athlete-detail',
    CREADOR: 'creador',
    OFICINA: 'oficina',
};

const PATH_BY_SCREEN = {
    [SCREEN_IDS.INICIO]: '/inicio',
    [SCREEN_IDS.ATLETAS]: '/atletas',
    [SCREEN_IDS.ATHLETE_DETAIL]: '/atletas/detalle',
    [SCREEN_IDS.CREADOR]: '/creador',
    [SCREEN_IDS.OFICINA]: '/oficina',
};

const PATH_MATCHERS = [
    { prefix: '/atletas/detalle', screenId: SCREEN_IDS.ATHLETE_DETAIL },
    { prefix: '/atletas', screenId: SCREEN_IDS.ATLETAS },
    { prefix: '/creador', screenId: SCREEN_IDS.CREADOR },
    { prefix: '/oficina', screenId: SCREEN_IDS.OFICINA },
    { prefix: '/inicio', screenId: SCREEN_IDS.INICIO },
];

function screenIdFromPathname(pathname) {
    const p = pathname.replace(/\/+$/, '') || '/';
    if (p === '/' || p === '') return SCREEN_IDS.INICIO;
    for (const { prefix, screenId } of PATH_MATCHERS) {
        if (p === prefix || p.startsWith(prefix + '/')) return screenId;
    }
    return SCREEN_IDS.INICIO;
}

function pathnameForScreen(screenId) {
    return PATH_BY_SCREEN[screenId] || '/inicio';
}

function screenIdToNavRoute(screenId) {
    return screenId === SCREEN_IDS.ATHLETE_DETAIL ? SCREEN_IDS.ATLETAS : screenId;
}

// ——— DOM utils ———
function scrollToTop() {
    window.scrollTo(0, 0);
}

function queryAll(sel) {
    return Array.from(document.querySelectorAll(sel));
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

const SELECTORS = {
    screens: '.screen',
    navItems: '.nav-item',
    variantTabs: '.variant-tab',
    creatorTabs: '.tab',
    clientItems: '.client-list-item',
};

function pushScreenPath(screenId, opts = {}) {
    const path = pathnameForScreen(screenId);
    const method = opts.replace ? 'replaceState' : 'pushState';
    window.history[method]({ screenId }, '', path);
}

function getScreenIdFromLocation() {
    return screenIdFromPathname(window.location.pathname);
}

function initHistoryRouter(handlers) {
    const onPop = () => handlers.applyRoute(screenIdFromPathname(window.location.pathname));
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
}

function applyScreenVisibility(screenId) {
    queryAll(SELECTORS.screens).forEach((s) => s.classList.remove('active'));
    const el = document.getElementById('screen-' + screenId);
    if (el) el.classList.add('active');
}

function setActiveNav(screenId, clickedNavEl) {
    queryAll(SELECTORS.navItems).forEach((item) => item.classList.remove('active'));
    if (clickedNavEl) {
        clickedNavEl.classList.add('active');
        return;
    }
    const route = screenIdToNavRoute(screenId);
    const item = document.querySelector('[data-nav-route="' + route + '"]');
    if (item) item.classList.add('active');
}

function navigateToScreen(screenId, opts = {}) {
    const { navElement, syncHistory = true, replace = false } = opts;
    if (syncHistory) pushScreenPath(screenId, { replace });
    applyScreenVisibility(screenId);
    setActiveNav(screenId, navElement);
    scrollToTop();
    if (screenId === SCREEN_IDS.INICIO) {
        refreshDailyAISummary();
    }
    if (screenId === SCREEN_IDS.ATHLETE_DETAIL) {
        scheduleAthleteCopilotRefresh();
    }
}

function switchScreen(screen, navEl) {
    navigateToScreen(screen, { navElement: navEl, syncHistory: true });
}

// ——— Modal ———
function modalInputGroup(label, innerHtml) {
    return (
        '<div class="input-group">' +
        '<label class="input-label">' +
        label +
        '</label>' +
        innerHtml +
        '</div>'
    );
}

function showModal(title, body, confirmText, onConfirm) {
    const confirmLabel = confirmText == null ? 'CONFIRMAR' : confirmText;
    document.getElementById('modal-title').textContent = title;
    document.getElementById('modal-body').innerHTML = body;
    const confirmBtn = document.getElementById('modal-confirm');
    confirmBtn.querySelector('.button-text').textContent = confirmLabel;
    if (typeof onConfirm === 'function') {
        confirmBtn.onclick = () => {
            onConfirm();
            closeModal();
        };
    } else {
        confirmBtn.onclick = closeModal;
    }
    document.getElementById('modal').classList.add('open');
}

function closeModal() {
    document.getElementById('modal').classList.remove('open');
}

function showToast(message) {
    const toast = document.createElement('div');
    toast.className = 'A�S ROOM-toast';
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => {
        toast.classList.add('A�S ROOM-toast--out');
        setTimeout(() => toast.remove(), 300);
    }, 2500);
}

const METRIC_MODAL = {
    peso: {
        title: 'Actualizar Peso',
        field:
            '<input type="number" class="cyber-input" placeholder="64.5" step="0.1">',
    },
    cintura: {
        title: 'Actualizar Medida de Cintura',
        field: '<input type="number" class="cyber-input" placeholder="60" step="0.5">',
    },
    hambre: {
        title: 'Registrar Nivel de Hambre',
        field:
            '<input type="range" class="cyber-input" min="1" max="10" value="8" ' +
            'oninput="this.nextElementSibling.textContent = this.value">' +
            '<span class="text-neon u-text-center-block">8</span>',
    },
};

// ——— Estado copiloto (SaaS: vendría del servidor) ———
let currentAthleteName = 'Laura Pro';
let athleteCopilotLoadedFor = null;
let athleteCopilotLoading = false;

function setDailyCardLoading(isLoading) {
    const sk = document.getElementById('ai-daily-skeleton');
    const content = document.getElementById('ai-daily-content');
    if (!sk || !content) return;
    sk.classList.toggle('ai-skeleton--hidden', !isLoading);
    content.classList.toggle('ai-content--hidden', isLoading);
}

function severityClass(sev) {
    if (sev === 'high' || sev === 'alto') return 'ai-priority--high';
    if (sev === 'medium' || sev === 'medio') return 'ai-priority--medium';
    return 'ai-priority--low';
}

function riskBadgeClass(level) {
    const l = (level || '').toLowerCase();
    if (l === 'alto' || l === 'high') return 'ai-risk ai-risk--alto';
    if (l === 'medio' || l === 'medium') return 'ai-risk ai-risk--medio';
    return 'ai-risk ai-risk--bajo';
}

async function refreshDailyAISummary() {
    setDailyCardLoading(true);
    try {
        const summary = await getDailySummary({});
        const content = document.getElementById('ai-daily-content');
        if (!content) return;
        const parts = summary.priorities.map(
            (p) =>
                '<div class="ai-priority ' +
                severityClass(p.severity) +
                '">' +
                '<div class="ai-priority__rank">#' +
                p.rank +
                '</div>' +
                '<div class="ai-priority__body">' +
                '<div class="ai-priority__athlete">' +
                escapeHtml(p.athlete) +
                '</div>' +
                '<div class="text-small ai-priority__label">Por qué</div>' +
                '<div class="text-chrome ai-priority__text">' +
                escapeHtml(p.reason) +
                '</div>' +
                '<div class="text-small ai-priority__label">Acción sugerida (revisar antes de actuar)</div>' +
                '<div class="text-neon ai-priority__action">' +
                escapeHtml(p.action) +
                '</div></div></div>'
        );
        let extra = '';
        if (summary.llmNarrative) {
            extra =
                '<div class="ai-llm-narrative text-small"><span class="ai-chip">IA</span> ' +
                escapeHtml(summary.llmNarrative) +
                '</div>';
        }
        content.innerHTML =
            parts.join('') +
            extra +
            '<div class="ai-source text-small">Fuente: ' +
            escapeHtml(summary.source) +
            ' · Plan ' +
            escapeHtml(TENANT_CONFIG.plan) +
            '</div>' +
            '<div class="text-small ai-disclaimer">' +
            escapeHtml(summary.disclaimer) +
            '</div>';
    } catch (e) {
        const content = document.getElementById('ai-daily-content');
        if (content) {
            content.innerHTML =
                '<p class="text-small u-text-danger">No se pudo generar el resumen. Pulsa ↻ o revisa la consola.</p>';
            content.classList.remove('ai-content--hidden');
        }
        document.getElementById('ai-daily-skeleton')?.classList.add('ai-skeleton--hidden');
    } finally {
        setDailyCardLoading(false);
    }
}

function toggleAthleteCopilot(headerEl) {
    const body = document.getElementById('ai-athlete-panel');
    const arrow = headerEl.querySelector('.ai-chevron');
    if (!body) return;
    const open = body.classList.toggle('ai-copilot-body--open');
    if (arrow) arrow.textContent = open ? '▲' : '▼';
    if (open) scheduleAthleteCopilotRefresh();
}

function scheduleAthleteCopilotRefresh() {
    if (athleteCopilotLoading) return;
    const body = document.getElementById('ai-athlete-panel');
    if (!body || !body.classList.contains('ai-copilot-body--open')) return;
    if (athleteCopilotLoadedFor === currentAthleteName) return;
    void refreshAthleteCopilotPanel();
}

async function refreshAthleteCopilotPanel() {
    const body = document.getElementById('ai-athlete-panel');
    if (!body) return;
    athleteCopilotLoading = true;
    body.innerHTML =
        '<div class="ai-loading text-neon">Generando análisis…</div>' +
        '<div class="ai-skeleton-lines"><div></div><div></div><div></div></div>';
    try {
        const analysis = await analyzeAthlete({ name: currentAthleteName });
        athleteCopilotLoadedFor = currentAthleteName;
        const sug = analysis.suggestions
            .map(
                (s) =>
                    '<li class="ai-suggestion-item"><strong>' +
                    escapeHtml(s.title) +
                    '</strong> — ' +
                    escapeHtml(s.detail) +
                    '</li>'
            )
            .join('');
        let extra = '';
        if (analysis.llmNarrative) {
            extra =
                '<div class="ai-llm-narrative text-small u-mt-8"><span class="ai-chip">IA</span> ' +
                escapeHtml(analysis.llmNarrative) +
                '</div>';
        }
        body.innerHTML =
            '<div class="text-small u-mb-8">Nivel de riesgo (heurística + datos disponibles)</div>' +
            '<div class="' +
            riskBadgeClass(analysis.riskLevel) +
            '">' +
            escapeHtml(String(analysis.riskLevel).toUpperCase()) +
            '</div>' +
            '<div class="text-small ai-priority__label u-mt-10">Por qué este nivel</div>' +
            '<div class="text-chrome">' +
            escapeHtml(analysis.whyRisk) +
            '</div>' +
            '<div class="text-small ai-priority__label u-mt-10">Análisis de progreso</div>' +
            '<div class="text-chrome">' +
            escapeHtml(analysis.progressAnalysis) +
            '</div>' +
            '<div class="text-small ai-priority__label u-mt-10">Sugerencias (recomendaciones, no órdenes)</div>' +
            '<ul class="ai-suggestion-list">' +
            sug +
            '</ul>' +
            extra +
            '<div class="cyber-button secondary u-mt-15" onclick="window.generateAthleteClientMessage()"><span class="button-text">💬 GENERAR MENSAJE PARA CLIENTE</span></div>' +
            '<div class="text-small ai-disclaimer u-mt-10">' +
            escapeHtml(analysis.disclaimer) +
            '</div>' +
            '<div class="text-small">Fuente: ' +
            escapeHtml(analysis.source) +
            '</div>';
    } finally {
        athleteCopilotLoading = false;
    }
}

async function generateAthleteClientMessage() {
    showModal(
        'Generando borrador…',
        '<div class="ai-loading text-neon">El copiloto está redactando…</div>',
        'CANCELAR'
    );
    try {
        const draft = await generateClientMessage({
            name: currentAthleteName,
            goal: 'seguimiento y adherencia',
        });
        showModal(
            'Borrador para cliente — revisar antes de enviar',
            '<p class="text-small u-mb-8">' +
                escapeHtml(draft.disclaimer) +
                '</p>' +
                modalInputGroup(
                    'ASUNTO (editable)',
                    '<input type="text" class="cyber-input" id="ai-draft-subject">'
                ) +
                modalInputGroup(
                    'MENSAJE (editable)',
                    '<textarea class="cyber-input" rows="8" id="ai-draft-body"></textarea>'
                ) +
                '<p class="text-small">' +
                escapeHtml(draft.toneNote) +
                '</p>' +
                '<p class="text-small">Fuente modelo: ' +
                escapeHtml(draft.source) +
                '</p>',
            'COPIAR Y CERRAR',
            () => {
                const sub = document.getElementById('ai-draft-subject');
                const bod = document.getElementById('ai-draft-body');
                const t = (sub && sub.value) + '\n\n' + (bod && bod.value);
                if (navigator.clipboard && navigator.clipboard.writeText) {
                    navigator.clipboard.writeText(t).then(() =>
                        showToast('📋 Borrador copiado — revísalo antes de enviar')
                    );
                } else {
                    showToast('Copia manualmente el texto del modal');
                }
            }
        );
        const subEl = document.getElementById('ai-draft-subject');
        const bodEl = document.getElementById('ai-draft-body');
        if (subEl) subEl.value = draft.subject;
        if (bodEl) bodEl.value = draft.body;
    } catch (e) {
        closeModal();
        showToast('No se pudo generar el borrador');
    }
}

// ——— Vault / office / creator / athletes / dashboard ———
function openVault() {
    document.getElementById('vault').classList.add('open');
    document.body.style.overflow = 'hidden';
}

function closeVault() {
    document.getElementById('vault').classList.remove('open');
    document.body.style.overflow = 'auto';
}

function toggleExpenses() {
    const box = document.getElementById('expenses-detail');
    const arrow = document.getElementById('expense-arrow');
    box.classList.toggle('open');
    arrow.textContent = box.classList.contains('open') ? '▲' : '▼';
}

function switchCreatorTab(tab, tabEl) {
    queryAll(SELECTORS.creatorTabs).forEach((t) => t.classList.remove('active'));
    if (tabEl) tabEl.classList.add('active');
    const diet = document.getElementById('creator-diet');
    const train = document.getElementById('creator-train');
    if (tab === 'diet') {
        diet.classList.remove('is-hidden');
        train.classList.add('is-hidden');
    } else {
        diet.classList.add('is-hidden');
        train.classList.remove('is-hidden');
    }
}

function switchVariant(element) {
    const panel = element.closest('#creator-diet, #creator-train');
    const scope = panel || document;
    scope.querySelectorAll(SELECTORS.variantTabs).forEach((tab) => {
        if (tab !== element && !tab.textContent.includes('CREAR')) tab.classList.remove('active');
    });
    if (!element.textContent.includes('CREAR')) element.classList.add('active');
}

function filterAthletes(query) {
    const q = (query || '').toLowerCase();
    queryAll('#athletes-list ' + SELECTORS.clientItems).forEach((item) => {
        const name = item.querySelector('.client-name').textContent.toLowerCase();
        const status = item.querySelector('.client-status').textContent.toLowerCase();
        item.style.display = name.includes(q) || status.includes(q) ? 'block' : 'none';
    });
}

function viewAthlete(name) {
    currentAthleteName = name;
    athleteCopilotLoadedFor = null;
    document.getElementById('athlete-detail-name').textContent = name;
    navigateToScreen(SCREEN_IDS.ATHLETE_DETAIL, { syncHistory: true });
}

function backToAthletes() {
    navigateToScreen(SCREEN_IDS.ATLETAS, { syncHistory: true });
}

function dismissAlert(element) {
    const card = element.closest('.cyber-card');
    card.style.animation = 'cardEntry 0.3s ease-out reverse';
    setTimeout(() => card.remove(), 300);
}

function contactClient(name) {
    showModal(
        'Contactar con ' + name,
        modalInputGroup(
            'ASUNTO',
            '<input type="text" class="cyber-input" placeholder="Revisión de rutina urgente" value="Revisión de progreso">'
        ) +
            modalInputGroup(
                'MENSAJE',
                '<textarea class="cyber-input" rows="4" placeholder="Escribe tu mensaje...">Hola ' +
                    escapeHtml(name) +
                    ', he notado que tu progreso se ha estancado. ¿Podemos agendar una llamada para ajustar tu plan?</textarea>'
            ),
        'ENVIAR MENSAJE',
        () => showToast('📤 Mensaje enviado a ' + name)
    );
}

function addEvent() {
    showModal(
        'Añadir Evento a la Agenda',
        modalInputGroup('HORA', '<input type="time" class="cyber-input" value="14:00">') +
            modalInputGroup(
                'DESCRIPCIÓN',
                '<input type="text" class="cyber-input" placeholder="Ej: Revisión con cliente">'
            ),
        'AÑADIR',
        () => showToast('✅ Evento añadido a la agenda')
    );
}

function completeTask(element) {
    const row = element.closest('.row');
    row.style.opacity = '0.5';
    row.style.textDecoration = 'line-through';
    element.textContent = '✓';
    element.style.color = '#00FF88';
    showToast('✅ Tarea completada');
}

function copyLink() {
    const link =
        'https://A�S ROOM-os.app/onboarding/new-client-' +
        Math.random().toString(36).substring(2, 11);
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard
            .writeText(link)
            .then(() => showToast('✅ Enlace copiado al portapapeles'))
            .catch(() => showModal('Enlace de Onboarding', 'Copia este enlace:\n\n' + link));
    } else {
        showModal('Enlace de Onboarding', 'Copia este enlace:\n\n' + link);
    }
}

function showNotifications() {
    showModal(
        '🔔 Notificaciones',
        '<div class="u-modal-scroll">' +
            '<div class="cyber-card u-modal-card">' +
            '<div class="text-chrome u-font-700">Check-in recibido</div>' +
            '<div class="text-small">Javi M. ha enviado su check-in semanal • Hace 2 horas</div></div>' +
            '<div class="cyber-card u-modal-card">' +
            '<div class="text-chrome u-font-700">Pago confirmado</div>' +
            '<div class="text-small">María S. - Plan mensual • Hace 5 horas</div></div>' +
            '<div class="cyber-card alert u-modal-card">' +
            '<div class="text-chrome u-font-700">Alerta de progreso</div>' +
            '<div class="text-small">Carlos R. sin cambios significativos • Hace 1 día</div></div></div>',
        'CERRAR'
    );
}

function updateMetric(type) {
    const cfg = METRIC_MODAL[type];
    if (!cfg) return;
    showModal(
        cfg.title,
        modalInputGroup('NUEVO VALOR', cfg.field),
        'GUARDAR',
        () => showToast('✅ Métrica actualizada correctamente')
    );
}

function addProgressData() {
    showModal(
        'Añadir Datos de Progreso',
        modalInputGroup(
            'PESO (kg)',
            '<input type="number" class="cyber-input" placeholder="64.5" step="0.1">'
        ) + modalInputGroup('FECHA', '<input type="date" class="cyber-input">'),
        'AÑADIR',
        () => showToast('✅ Datos añadidos al gráfico')
    );
}

function createReport() {
    showModal(
        'Crear Nuevo Reporte',
        modalInputGroup(
            'TÍTULO DEL REPORTE',
            '<input type="text" class="cyber-input" placeholder="Ej: Revisión Semanal">'
        ) +
            modalInputGroup(
                'NOTAS',
                '<textarea class="cyber-input" rows="4" placeholder="Observaciones del progreso..."></textarea>'
            ),
        'CREAR REPORTE',
        () => showToast('✅ Reporte creado correctamente')
    );
}

function editNotes(element) {
    const el = element || {};
    const currentNotes = (el.textContent || '').trim();
    showModal(
        'Editar Notas del Entrenador',
        modalInputGroup(
            'NOTAS',
            '<textarea class="cyber-input" rows="6">' +
                escapeHtml(currentNotes) +
                '</textarea>'
        ),
        'GUARDAR',
        () => showToast('✅ Notas actualizadas')
    );
}

function editMeal(number) {
    showModal(
        'Editar Comida ' + number,
        modalInputGroup(
            'ALIMENTO',
            '<input type="text" class="cyber-input" placeholder="Ej: Arroz Basmati">'
        ) +
            modalInputGroup(
                'CANTIDAD (g)',
                '<input type="number" class="cyber-input" placeholder="100">'
            ) +
            '<div class="u-text-center-mt">' +
            '<span class="text-neon u-cursor-pointer">+ Añadir otro alimento</span></div>',
        'GUARDAR CAMBIOS',
        () => showToast('✅ Comida actualizada')
    );
}

function addSupplement() {
    showModal(
        'Añadir Suplemento',
        modalInputGroup(
            'SUPLEMENTO',
            '<input type="text" class="cyber-input" placeholder="Ej: Beta-Alanina">'
        ) +
            modalInputGroup(
                'DOSIS Y MOMENTO',
                '<input type="text" class="cyber-input" placeholder="Ej: 3g (Pre-entreno)">'
            ),
        'AÑADIR',
        () => showToast('✅ Suplemento añadido')
    );
}

function addExercise() {
    showModal(
        'Añadir Ejercicio',
        modalInputGroup(
            'EJERCICIO',
            '<input type="text" class="cyber-input" placeholder="Ej: Press Banca">'
        ) +
            modalInputGroup(
                'SERIES x REPS',
                '<input type="text" class="cyber-input" placeholder="Ej: 3 x 8-10">'
            ) +
            modalInputGroup(
                'CARGA (kg)',
                '<input type="number" class="cyber-input" placeholder="80">'
            ),
        'AÑADIR EJERCICIO',
        () => showToast('✅ Ejercicio añadido al plan')
    );
}

function createNewVariant() {
    showModal(
        'Crear Nueva Variante',
        modalInputGroup(
            'NOMBRE DE LA VARIANTE',
            '<input type="text" class="cyber-input" placeholder="Ej: DÍA D (Bajo)">'
        ) +
            modalInputGroup(
                'DESCRIPCIÓN',
                '<textarea class="cyber-input" rows="3" placeholder="Día bajo en carbohidratos para descanso activo"></textarea>'
            ),
        'CREAR',
        () => showToast('✅ Nueva variante creada')
    );
}

function saveDraft() {
    showToast('💾 Borrador guardado correctamente');
}

function sendToClient() {
    showModal(
        'Enviar Plan al Cliente',
        modalInputGroup(
            'SELECCIONAR CLIENTE',
            '<select class="cyber-input">' +
                '<option>Laura Pro</option>' +
                '<option>Javi M.</option>' +
                '<option>María S.</option>' +
                '<option>Raúl C.</option></select>'
        ) +
            modalInputGroup(
                'MENSAJE OPCIONAL',
                '<textarea class="cyber-input" rows="3" placeholder="Añade un mensaje personalizado..."></textarea>'
            ),
        'ENVIAR AHORA',
        () => showToast('📤 Plan enviado correctamente')
    );
}

function editFinance(_type) {
    showModal(
        'Editar Facturación',
        modalInputGroup(
            'MONTO (€)',
            '<input type="number" class="cyber-input" placeholder="5000" step="50">'
        ),
        'ACTUALIZAR',
        () => showToast('✅ Facturación actualizada')
    );
}

function editExpense(_type) {
    showModal(
        'Editar Gasto',
        modalInputGroup(
            'MONTO (€)',
            '<input type="number" class="cyber-input" step="10">'
        ),
        'ACTUALIZAR',
        () => showToast('✅ Gasto actualizado')
    );
}

function addExpense() {
    showModal(
        'Añadir Nuevo Gasto',
        modalInputGroup(
            'CONCEPTO',
            '<input type="text" class="cyber-input" placeholder="Ej: Marketing digital">'
        ) +
            modalInputGroup(
                'MONTO (€)',
                '<input type="number" class="cyber-input" placeholder="150" step="10">'
            ),
        'AÑADIR GASTO',
        () => showToast('✅ Gasto añadido')
    );
}

function claimPayment() {
    showModal(
        'Reclamar Pago',
        '<p class="text-chrome">¿Deseas enviar un recordatorio de pago a Carlos Rodríguez?</p>' +
            '<p class="text-small u-mt-10">Se enviará un mensaje automático con los detalles del pago pendiente.</p>',
        'ENVIAR RECORDATORIO',
        () => showToast('📧 Recordatorio de pago enviado')
    );
}

function editProtocol() {
    showModal(
        'Editar Protocolo',
        modalInputGroup(
            'COMPUESTO',
            '<input type="text" class="cyber-input" placeholder="Ej: PRIMOBOLAN">'
        ) +
            modalInputGroup(
                'DOSIFICACIÓN',
                '<input type="text" class="cyber-input" placeholder="Ej: 200mg/sem">'
            ),
        'GUARDAR CAMBIOS',
        () => showToast('✅ Protocolo actualizado')
    );
}

function applyAISuggestion() {
    showToast('🤖 Sugerencia de IA aplicada al protocolo');
}

/** Sugerencias de plan (demo: modal con IA + mock fallback) */
async function showPlanAdjustmentsDemo() {
    showModal(
        'Sugerencias de plan',
        '<div class="ai-loading text-neon">Analizando contexto…</div>',
        'CANCELAR'
    );
    try {
        const adj = await suggestPlanAdjustments({ screen: 'creador' });
        const items = adj.items
            .map(
                (it) =>
                    '<div class="ai-adjust-item"><div class="text-neon">' +
                    escapeHtml(it.area) +
                    '</div><div class="text-chrome">' +
                    escapeHtml(it.suggestion) +
                    '</div><div class="text-small">' +
                    escapeHtml(it.rationale) +
                    '</div></div>'
            )
            .join('');
        let extra = adj.llmNarrative
            ? '<div class="ai-llm-narrative text-small">' + escapeHtml(adj.llmNarrative) + '</div>'
            : '';
        showModal(
            'Ajustes sugeridos (no aplicados)',
            '<p class="text-small">' +
                escapeHtml(adj.disclaimer) +
                '</p>' +
                items +
                extra +
                '<p class="text-small">Fuente: ' +
                escapeHtml(adj.source) +
                '</p>',
            'ENTENDIDO'
        );
    } catch (e) {
        closeModal();
    }
}

// ——— Bootstrap ———
const api = {
    switchScreen,
    navigateToScreen,
    openVault,
    closeVault,
    toggleExpenses,
    switchCreatorTab,
    switchVariant,
    copyLink,
    filterAthletes,
    viewAthlete,
    backToAthletes,
    showModal,
    closeModal,
    showToast,
    dismissAlert,
    contactClient,
    addEvent,
    completeTask,
    updateMetric,
    addProgressData,
    createReport,
    editNotes,
    editMeal,
    addSupplement,
    addExercise,
    createNewVariant,
    saveDraft,
    sendToClient,
    editFinance,
    editExpense,
    addExpense,
    claimPayment,
    editProtocol,
    applyAISuggestion,
    showNotifications,
    toggleAthleteCopilot,
    generateAthleteClientMessage,
    refreshDailyAISummary,
    showPlanAdjustmentsDemo,
    logoutApp,
};

Object.assign(window, api);
window.A�S ROOMApp = {
    version: '5.0.0-saas-auth',
    routes: { SCREEN_IDS },
    tenant: TENANT_CONFIG,
    getAILogSnapshot,
    suggestPlanAdjustments,
    getCurrentUser,
    initApp,
    ...api,
};

// ——— Capas auth / app (auth.js no toca el DOM; esto es “shell”) ———
const elAuth = () => document.getElementById('auth-screen');
const elApp = () => document.getElementById('app-screen');

let detachPopstate = null;
let A�S ROOMShellStarted = false;

function setAuthLayerVisible(visible) {
    const a = elAuth();
    const p = elApp();
    if (!a || !p) return;
    if (visible) {
        a.classList.add('is-active');
        a.setAttribute('aria-hidden', 'false');
        p.classList.remove('is-active');
        p.setAttribute('aria-hidden', 'true');
    } else {
        a.classList.remove('is-active');
        a.setAttribute('aria-hidden', 'true');
        p.classList.add('is-active');
        p.setAttribute('aria-hidden', 'false');
    }
}

function updateUserBar(user) {
    const out = document.getElementById('app-user-display');
    if (!out || !user) return;
    out.textContent = user.email || user.id || '—';
}

function setAuthFormLoading(loading) {
    const form = document.getElementById('auth-login-form');
    const btn = document.getElementById('auth-submit');
    const toggleBtn = document.getElementById('auth-toggle-btn');
    if (form) form.classList.toggle('auth-card--loading', loading);
    if (btn) btn.disabled = loading;
    if (toggleBtn) toggleBtn.disabled = loading;
}

function setAuthError(message) {
    const box = document.getElementById('auth-error');
    if (!box) return;
    if (message) {
        box.textContent = message;
        box.classList.remove('is-hidden');
    } else {
        box.textContent = '';
        box.classList.add('is-hidden');
    }
}

function stopA�S ROOMShell() {
    if (typeof detachPopstate === 'function') {
        detachPopstate();
        detachPopstate = null;
    }
    A�S ROOMShellStarted = false;
}

function startA�S ROOMShell() {
    if (A�S ROOMShellStarted) return;
    A�S ROOMShellStarted = true;
    canonicalizeRootUrl();
    const initialScreen = getScreenIdFromLocation();
    navigateToScreen(initialScreen, { syncHistory: false });
    detachPopstate = initHistoryRouter({
        applyRoute(screenId) {
            navigateToScreen(screenId, { syncHistory: false });
        },
    });
}

function canonicalizeRootUrl() {
    const path = window.location.pathname;
    if (path === '/' || path === '') {
        window.history.replaceState(
            { screenId: SCREEN_IDS.INICIO },
            '',
            pathnameForScreen(SCREEN_IDS.INICIO)
        );
    }
}

function showAppShell(user) {
    setAuthLayerVisible(false);
    updateUserBar(user);
    startA�S ROOMShell();
}

function showAuthShell() {
    stopA�S ROOMShell();
    closeModal();
    const v = document.getElementById('vault');
    if (v) {
        v.classList.remove('open');
        document.body.style.overflow = 'auto';
    }
    const pw = document.getElementById('auth-password');
    if (pw) pw.value = '';
    setAuthLayerVisible(true);
    setAuthFormLoading(false);
    setAuthError('');
    setAuthSuccess('');
    setAuthMode('login');
}

// ——— Modo del formulario: 'login' | 'register' ———
let authMode = 'login';

function setAuthMode(mode) {
    authMode = mode;
    const title = document.getElementById('auth-mode-title');
    const submitLabel = document.getElementById('auth-submit-label');
    const toggleLabel = document.getElementById('auth-toggle-label');
    const pwInput = document.getElementById('auth-password');
    setAuthError('');
    setAuthSuccess('');
    if (mode === 'register') {
        if (title) title.textContent = 'CREAR CUENTA';
        if (submitLabel) submitLabel.textContent = 'REGISTRARSE';
        if (toggleLabel) toggleLabel.textContent = 'YA TENGO CUENTA';
        if (pwInput) pwInput.setAttribute('autocomplete', 'new-password');
    } else {
        if (title) title.textContent = 'ACCESO COACH';
        if (submitLabel) submitLabel.textContent = 'ACCEDER';
        if (toggleLabel) toggleLabel.textContent = 'CREAR CUENTA';
        if (pwInput) pwInput.setAttribute('autocomplete', 'current-password');
    }
}

function setAuthSuccess(message) {
    const box = document.getElementById('auth-success');
    if (!box) return;
    if (message) {
        box.textContent = message;
        box.classList.remove('is-hidden');
    } else {
        box.textContent = '';
        box.classList.add('is-hidden');
    }
}

function bindAuthUi() {
    const form = document.getElementById('auth-login-form');
    const toggleBtn = document.getElementById('auth-toggle-btn');
    const logoutBtn = document.getElementById('auth-logout-btn');

    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            setAuthError('');
            setAuthSuccess('');
            const email = document.getElementById('auth-email')?.value?.trim() || '';
            const password = document.getElementById('auth-password')?.value || '';

            if (!email || !password) {
                setAuthError('Introduce tu email y contraseña.');
                return;
            }

            setAuthFormLoading(true);

            if (authMode === 'register') {
                const result = await signup(email, password);
                setAuthFormLoading(false);
                if (!result.ok) {
                    setAuthError(result.error || 'No se pudo crear la cuenta.');
                } else if (result.requiresConfirmation) {
                    setAuthSuccess('Cuenta creada. Revisa tu email para confirmar y luego accede.');
                    setAuthMode('login');
                } else {
                    showAppShell(result.user);
                }
            } else {
                const result = await login(email, password);
                setAuthFormLoading(false);
                if (result.ok) showAppShell(result.user);
                else setAuthError(result.error || 'No se pudo iniciar sesión.');
            }
        });
    }

    if (toggleBtn) {
        toggleBtn.addEventListener('click', () => {
            setAuthMode(authMode === 'login' ? 'register' : 'login');
        });
    }

    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => logoutApp());
    }
}

async function logoutApp() {
    await authLogout();
    showAuthShell();
}

async function initApp() {
    const session = await getSession();
    if (session) {
        showAppShell(session.user);
    } else {
        showAuthShell();
    }
    bindAuthUi();
}

try {
    await initApp();
} catch (err) {
    console.error('initApp', err);
    showAuthShell();
    bindAuthUi();
}
