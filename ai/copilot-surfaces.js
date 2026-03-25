/**
 * Copiloto en superficies (dieta / entreno) — sugiere, no ejecuta.
 * En producción: mismos prompts vía /api/ai con tenant + athlete_id.
 */

/**
 * @param {{ kcal: number, p: number, c: number, f: number }} actual
 * @param {{ kcal: number, p: number, c: number, f: number }} target
 * @returns {{ headline: string, items: { suggestion: string, because: string }[] }}
 */
export function getDietCopilotSurface(actual, target) {
    const items = [];
    const gapP = target.p - actual.p;
    const ratioK = target.kcal > 0 ? actual.kcal / target.kcal : 1;

    if (gapP > 12) {
        items.push({
            suggestion: 'Subir proteína unos ' + Math.round(Math.min(gapP, 35)) + ' g (vía comida o batido).',
            because:
                'La ingesta proyectada queda por debajo del objetivo del plan; priorizar saciedad y retención de masa en déficit/volumen controlado.',
        });
    } else if (gapP < -25) {
        items.push({
            suggestion: 'Revisar reparto: posible exceso proteico vs objetivo; valora calidad y distribución.',
            because:
                'Superar mucho la proteína planificada puede restar margen a carbs/grasas sin beneficio adicional claro para este cliente.',
        });
    }

    if (ratioK < 0.9) {
        items.push({
            suggestion: 'Evaluar si el déficit es mayor al previsto o falta registro de alimentos.',
            because:
                'Las kcal totales están notablemente por debajo del target: riesgo de adherencia o subregistro antes de ajustar el plan.',
        });
    } else if (ratioK > 1.1) {
        items.push({
            suggestion: 'Confirmar adherencia real (fotos 48h) antes de subir cardio o bajar kcal.',
            because:
                'El balance supera el objetivo: conviene datos objetivos para distinguir exceso real vs error de medición.',
        });
    }

    if (items.length === 0) {
        items.push({
            suggestion: 'Mantener plan; documenta sensación y rendimiento en básicos esta semana.',
            because:
                'Los macros están alineados con el objetivo declarado; el siguiente paso es validar con check-in y vídeos de técnica.',
        });
    }

    return {
        headline: 'Recomendaciones (copiloto · no aplicadas)',
        items: items.slice(0, 3),
    };
}

/**
 * @param {{ name: string, fatigue: string, intensity: string, weight: number, prevWeight: number }[]} blocks
 */
export function getTrainingCopilotSurface(blocks) {
    const items = [];
    const highFatigue = blocks.filter((b) => b.fatigue === 'alta');
    if (highFatigue.length) {
        items.push({
            suggestion:
                'Considerar deload parcial o reducir series accesorias en ' +
                highFatigue.map((b) => b.name).join(', ') +
                '.',
            because:
                'Indicador de fatiga alta en bloques clave: menor tolerancia al volumen sin pérdida de estímulo en básicos.',
        });
    }
    const stagnant = blocks.filter((b) => b.weight <= b.prevWeight && b.intensity === 'alta');
    if (stagnant.length) {
        items.push({
            suggestion: 'Mantener carga pero bajar RIR objetivo 1 punto o mejorar técnica filmada.',
            because:
                'Carga plana con intensidad alta suele pedir mejor calidad de repetición antes de más kilos.',
        });
    }
    if (!items.length) {
        items.push({
            suggestion: 'Progresión coherente: conserva estructura y revisa sueño/hambre en el check-in.',
            because:
                'No hay señales críticas de sobreentrenamiento o estancamiento en los datos mostrados.',
        });
    }
    return {
        headline: 'Alertas y ajustes sugeridos (entreno)',
        items: items.slice(0, 3),
    };
}
