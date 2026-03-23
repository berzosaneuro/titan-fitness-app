/**
 * Titan OS — capa de IA (copiloto del entrenador).
 * Sin manipulación de DOM. Lista para: Ollama → backend /api/ai → multi-tenant.
 */

/** @type {{ tenantId: string, plan: 'starter'|'pro'|'enterprise', aiCallsLimitPerDay: number }} */
export const TENANT_CONFIG = {
    tenantId: 'demo-tenant',
    plan: 'pro',
    aiCallsLimitPerDay: 200,
};

/** Historial local (en SaaS → BigQuery / tabla `ai_events`). */
const AI_LOG = [];
const MAX_LOG = 200;

export function logAIEvent(entry) {
    AI_LOG.push({
        ts: new Date().toISOString(),
        tenantId: TENANT_CONFIG.tenantId,
        ...entry,
    });
    if (AI_LOG.length > MAX_LOG) AI_LOG.shift();
}

export function getAILogSnapshot() {
    return [...AI_LOG];
}

/**
 * Llamada a modelo local (Ollama). En producción: sustituir por fetch('/api/ai', { credentials }).
 * CORS: el navegador puede bloquear localhost:11434; el fallback a mock mantiene la app usable.
 */
export async function callAI(prompt) {
    try {
        const res = await fetch('http://localhost:11434/api/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: 'qwen:7b',
                prompt,
                stream: false,
            }),
        });
        if (!res.ok) return null;
        const data = await res.json();
        const text = (data && data.response) || null;
        logAIEvent({ type: 'ollama_ok', model: 'qwen:7b', promptLen: prompt.length });
        return text;
    } catch (e) {
        logAIEvent({ type: 'ollama_error', message: String(e && e.message) });
        return null;
    }
}

/* ---------- Datos demo coherentes con la UI ---------- */

const DASHBOARD_CONTEXT_DEFAULT = {
    checkInsReceived: 23,
    checkInsTotal: 28,
    stalledAthletes: [{ name: 'Carlos R.', weeksNoChange: 14, phase: 'DEFINICIÓN' }],
    pendingCheckIns: ['Raúl C.'],
    positiveOutliers: ['María S.'],
};

const ATHLETE_SEEDS = {
    'Laura Pro': {
        phase: 'WELLNESS • 2 WEEKS OUT',
        weightTrend: 'ligera bajada con buena adherencia',
        hunger: 8,
        notesTheme: 'pre-competición, pierna, hidratación',
    },
    'Javi M.': {
        phase: 'HIPERTROFIA',
        weightTrend: '+2.5 kg en 8 semanas, fuerza estable',
        hunger: 5,
        notesTheme: 'volumen, técnica press',
    },
    'Carlos R.': {
        phase: 'DEFINICIÓN',
        weightTrend: 'sin cambio de peso/medidas en 14 semanas',
        hunger: 6,
        notesTheme: 'estancamiento, posible adaptación metabólica',
    },
    'Raúl C.': {
        phase: 'RECOMPOSICIÓN',
        weightTrend: 'check-in pendiente',
        hunger: 4,
        notesTheme: 'adherencia desconocida esta semana',
    },
    'María S.': {
        phase: 'POST-PARTO',
        weightTrend: 'progreso constante, buena adherencia',
        hunger: 5,
        notesTheme: 'readaptación, core',
    },
};

function seedForAthlete(name) {
    return ATHLETE_SEEDS[name] || ATHLETE_SEEDS['Laura Pro'];
}

/* ---------- FASE 2: mocks estructurados (producción-like) ---------- */

export function getDailySummaryMock(data = {}) {
    const ctx = { ...DASHBOARD_CONTEXT_DEFAULT, ...data };
    return {
        generatedAt: new Date().toISOString(),
        source: 'mock',
        priorities: [
            {
                rank: 1,
                athlete: 'Carlos R.',
                reason:
                    'Lleva 14 semanas sin cambios en peso ni perímetros pese a déficit declarado: patrón compatible con estancamiento y riesgo de abandono.',
                action:
                    'Agendar revisión de adherencia real (fotos de comidas 3 días) y reprogramar déficit o banco de calorías de forma conservadora.',
                severity: 'high',
            },
            {
                rank: 2,
                athlete: 'Raúl C.',
                reason:
                    'Check-in semanal pendiente: sin datos no podemos ajustar volumen ni recuperación.',
                action:
                    'Enviar recordatorio breve con enlace al formulario y fecha límite de 48 h.',
                severity: 'medium',
            },
            {
                rank: 3,
                athlete: 'Javi M.',
                reason:
                    'Progreso positivo (+2,5 kg); ventana para consolidar técnica antes de nueva fase de intensificación.',
                action:
                    'Refuerza feedback de vídeo en press y confirma RIR objetivo en básicos.',
                severity: 'low',
            },
        ],
        meta: {
            checkInsRatio: ctx.checkInsReceived + '/' + ctx.checkInsTotal,
        },
        disclaimer:
            'Recomendaciones asistidas por IA. El entrenador decide e implementa; no sustituyen criterio profesional.',
    };
}

export function analyzeAthleteMock(athleteData = {}) {
    const name = athleteData.name || 'Atleta';
    const seed = seedForAthlete(name);
    const risk =
        name === 'Carlos R.' ? 'alto' : name === 'Raúl C.' ? 'medio' : 'bajo';
    return {
        generatedAt: new Date().toISOString(),
        source: 'mock',
        athleteName: name,
        progressAnalysis:
            name === 'Carlos R.'
                ? 'El peso y la cintura no se mueven desde hace varias semanas en fase de definición. Eso suele indicar adherencia inconsistente, subestimación de ingesta o necesidad de periodizar el déficit.'
                : name === 'Raúl C.'
                  ? 'Falta el check-in de la semana; sin métricas subjetivas (hambre, sueño, pasos) el ajuste del plan es especulativo.'
                  : 'La tendencia de ' +
                    seed.weightTrend +
                    ' es coherente con la fase ' +
                    seed.phase +
                    '. Continúa monitorizando hambre y rendimiento en básicos.',
        riskLevel: risk,
        whyRisk:
            risk === 'alto'
                ? 'Combinación de estancamiento prolongado + alerta operativa de abandono en el panel.'
                : risk === 'medio'
                  ? 'Ausencia temporal de datos recientes (check-in).'
                  : 'Sin señales críticas en los datos demo disponibles.',
        suggestions: [
            {
                title: 'Priorizar adherencia medible',
                detail:
                    '3 días de registro visual o diario corto antes de bajar más calorías.',
                kind: 'recommendation',
            },
            {
                title: 'Ajuste de entreno',
                detail:
                    'Mantener volumen en básicos y revisar accesorios si el sueño empeora (posible fatiga acumulada).',
                kind: 'recommendation',
            },
            {
                title: 'Comunicación con el cliente',
                detail:
                    'Mensaje empático que normalice el estancamiento y proponga un siguiente paso concreto (llada 15 min).',
                kind: 'recommendation',
            },
        ],
        disclaimer:
            'Análisis orientativo. No es diagnóstico médico ni prescripción.',
    };
}

export function generateClientMessageMock(context = {}) {
    const name = context.name || 'cliente';
    const tone = context.tone || 'profesional y cercano';
    return {
        generatedAt: new Date().toISOString(),
        source: 'mock',
        subject: 'Seguimiento de tu plan — próximos pasos',
        body:
            'Hola ' +
            name +
            ',\n\n' +
            'He revisado tu última semana. Quiero afinar el plan contigo para que sigamos avanzando sin fricción.\n\n' +
            'Te propongo [DETALLE A COMPLETAR POR EL COACH]. Si te encaja, respondeme con tu disponibilidad para una llamada corta.\n\n' +
            'Gracias por la confianza,\n[Tu nombre]',
        toneNote: 'Tono objetivo: ' + tone + '. Edita el texto antes de enviar.',
        disclaimer:
            'Borrador generado. Revísalo siempre antes de enviarlo al cliente.',
    };
}

export function suggestPlanAdjustmentsMock(data = {}) {
    const focus = data.focus || 'dieta y recuperación';
    return {
        generatedAt: new Date().toISOString(),
        source: 'mock',
        focus,
        items: [
            {
                area: 'Nutrición',
                suggestion:
                    'Mantener proteína y repartir carbohidratos alrededor del entreno; evitar nuevos recortes hasta confirmar adherencia 3 días.',
                rationale:
                    'Reduce riesgo de mayor fatiga y pérdida de adherencia en definición.',
            },
            {
                area: 'Entrenamiento',
                suggestion:
                    'Un top set controlado + back-off en básicos en lugar de más series si el rendimiento cae.',
                rationale:
                    'Preserva estímulo con menos fatiga sistémica cuando el déficit es exigente.',
            },
            {
                area: 'Seguimiento',
                suggestion:
                    'Pedir foto de plato o checklist de 48 h antes del siguiente ajuste de macros.',
                rationale:
                    'Datos objetivos para decidir si el estancamiento es por ingesta o adaptación.',
            },
        ],
        disclaimer:
            'Sugerencias no ejecutadas automáticamente: el coach las aplica manualmente si las valida.',
    };
}

/* ---------- API async: mock + Ollama opcional ---------- */

function buildDailyPrompt(data) {
    const ctx = { ...DASHBOARD_CONTEXT_DEFAULT, ...data };
    return (
        'Eres copiloto para entrenadores. Responde SOLO JSON válido con keys: priorities (array max 3 de {athlete, reason, action, severity: high|medium|low}). ' +
        'Contexto: check-ins ' +
        ctx.checkInsReceived +
        '/' +
        ctx.checkInsTotal +
        ', atleta estancado Carlos R. 14 semanas. Sin texto fuera del JSON.'
    );
}

function tryParseJsonObject(text) {
    if (!text || typeof text !== 'string') return null;
    const trimmed = text.trim();
    const start = trimmed.indexOf('{');
    const end = trimmed.lastIndexOf('}');
    if (start === -1 || end === -1) return null;
    try {
        return JSON.parse(trimmed.slice(start, end + 1));
    } catch {
        return null;
    }
}

export async function getDailySummary(data) {
    const mock = getDailySummaryMock(data);
    const raw = await callAI(buildDailyPrompt(data));
    if (!raw) {
        logAIEvent({ type: 'daily_summary', source: 'mock' });
        return mock;
    }
    const parsed = tryParseJsonObject(raw);
    if (parsed && Array.isArray(parsed.priorities) && parsed.priorities.length) {
        const merged = {
            ...mock,
            source: 'ollama',
            priorities: parsed.priorities.slice(0, 3).map((p, i) => ({
                rank: i + 1,
                athlete: p.athlete || '—',
                reason: p.reason || '',
                action: p.action || '',
                severity: p.severity || 'medium',
            })),
        };
        logAIEvent({ type: 'daily_summary', source: 'ollama' });
        return merged;
    }
    logAIEvent({ type: 'daily_summary', source: 'mock_fallback_parse' });
    return { ...mock, llmNarrative: raw.trim(), source: 'hybrid' };
}

export async function analyzeAthlete(athleteData) {
    const mock = analyzeAthleteMock(athleteData);
    const prompt =
        'Eres copiloto de entrenador. Responde SOLO JSON con keys: progressAnalysis (string), riskLevel (alto|medio|bajo), whyRisk (string), suggestions (array de {title, detail}). ' +
        'Atleta: ' +
        JSON.stringify(athleteData).slice(0, 500);
    const raw = await callAI(prompt);
    if (!raw) {
        logAIEvent({ type: 'analyze_athlete', source: 'mock', athlete: athleteData.name });
        return mock;
    }
    const parsed = tryParseJsonObject(raw);
    if (parsed && parsed.progressAnalysis) {
        logAIEvent({ type: 'analyze_athlete', source: 'ollama', athlete: athleteData.name });
        return {
            ...mock,
            source: 'ollama',
            progressAnalysis: parsed.progressAnalysis,
            riskLevel: parsed.riskLevel || mock.riskLevel,
            whyRisk: parsed.whyRisk || mock.whyRisk,
            suggestions: Array.isArray(parsed.suggestions)
                ? parsed.suggestions.map((s) => ({
                      title: s.title || 'Sugerencia',
                      detail: s.detail || '',
                      kind: 'recommendation',
                  }))
                : mock.suggestions,
        };
    }
    logAIEvent({ type: 'analyze_athlete', source: 'mock_fallback_parse', athlete: athleteData.name });
    return { ...mock, llmNarrative: raw.trim(), source: 'hybrid' };
}

export async function generateClientMessage(context) {
    const mock = generateClientMessageMock(context);
    const prompt =
        'Redacta un borrador breve de mensaje para un cliente de entrenador. Tono profesional y cercano. ' +
        'Incluye asunto en primera línea "ASUNTO: ..." y cuerpo después. Cliente: ' +
        (context.name || '') +
        '. Contexto: ' +
        (context.goal || 'seguimiento de plan');
    const raw = await callAI(prompt);
    if (!raw) {
        logAIEvent({ type: 'client_message', source: 'mock', client: context.name });
        return mock;
    }
    const lines = raw.trim().split('\n');
    let subject = mock.subject;
    let body = raw.trim();
    const first = lines[0];
    if (/^ASUNTO:/i.test(first)) {
        subject = first.replace(/^ASUNTO:\s*/i, '').trim();
        body = lines.slice(1).join('\n').trim();
    }
    logAIEvent({ type: 'client_message', source: 'ollama', client: context.name });
    return {
        ...mock,
        source: 'ollama',
        subject,
        body: body || mock.body,
    };
}

export async function suggestPlanAdjustments(data) {
    const mock = suggestPlanAdjustmentsMock(data);
    const prompt =
        'Eres copiloto. Responde SOLO JSON { items: [{ area, suggestion, rationale }] } con 2-4 ítems de ajuste de plan (nutrición/entreno/seguimiento). Contexto: ' +
        JSON.stringify(data).slice(0, 400);
    const raw = await callAI(prompt);
    if (!raw) {
        logAIEvent({ type: 'plan_adjust', source: 'mock' });
        return mock;
    }
    const parsed = tryParseJsonObject(raw);
    if (parsed && Array.isArray(parsed.items) && parsed.items.length) {
        logAIEvent({ type: 'plan_adjust', source: 'ollama' });
        return {
            ...mock,
            source: 'ollama',
            items: parsed.items.map((it) => ({
                area: it.area || 'General',
                suggestion: it.suggestion || '',
                rationale: it.rationale || '',
            })),
        };
    }
    logAIEvent({ type: 'plan_adjust', source: 'mock_fallback_parse' });
    return { ...mock, llmNarrative: raw.trim(), source: 'hybrid' };
}
