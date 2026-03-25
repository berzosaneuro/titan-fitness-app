/** Precios base (céntimos EUR). Admin puede sobreescribir vía PlatformConfig + getEffectivePricing(). */

/** Recargas sugeridas: 25 € resaltada en UI; 50 € con bono en saldo. */
export const TOPUP_EUR_OPTIONS = [10, 25, 50] as const;
export type TopupEur = (typeof TOPUP_EUR_OPTIONS)[number];

export const RECOMMENDED_TOPUP_EUR: TopupEur = 25;

export function eurToCents(eur: number) {
  return Math.round(eur * 100);
}

/** Primer mensaje gratis; el resto monetiza (continuar / candados). */
export const FREE_FIRST_MESSAGES = 1;

/** Continuar chat tras hook gratuito (rango orientativo 1–3 €). */
export const CHAT_MESSAGE_COST_CENTS = 150;

/** Prioridad percibida (rango 1–3 €). */
export const PRIORITY_REPLY_CENTS = 200;

/** Interacción especial (rango 5–15 €). */
export const SPECIAL_INTERACTION_CENTS = 1000;

/** Desbloqueo mensaje por defecto (rango 2–5 €). */
export const DEFAULT_UNLOCK_MESSAGE_CENTS = 350;

/** Contenido por defecto (rango 3–10 €). */
export const DEFAULT_CONTENT_UNLOCK_CENTS = 650;

/** Umbrales de gasto acumulado (céntimos) → nivel. */
export const LEVEL_THRESHOLDS_CENTS = [0, 5_000, 15_000, 40_000, 100_000] as const;

export function levelFromTotalSpent(
  totalSpentCents: number,
  thresholds: readonly number[] = LEVEL_THRESHOLDS_CENTS
): number {
  let lv = 1;
  for (let i = thresholds.length - 1; i >= 0; i--) {
    if (totalSpentCents >= thresholds[i]) {
      lv = i + 1;
      break;
    }
  }
  return lv;
}

export function nextLevelThresholdCents(
  level: number,
  thresholds: readonly number[] = LEVEL_THRESHOLDS_CENTS
): number | null {
  if (level >= thresholds.length) return null;
  return thresholds[level] ?? null;
}

export function progressToNextLevel(
  totalSpentCents: number,
  thresholds: readonly number[] = LEVEL_THRESHOLDS_CENTS
): {
  level: number;
  nextAt: number | null;
  progress01: number;
} {
  const level = levelFromTotalSpent(totalSpentCents, thresholds);
  const nextAt = nextLevelThresholdCents(level, thresholds);
  if (nextAt === null) {
    return { level, nextAt: null, progress01: 1 };
  }
  const prev = thresholds[level - 1] ?? 0;
  const span = nextAt - prev;
  const p = span <= 0 ? 1 : Math.min(1, Math.max(0, (totalSpentCents - prev) / span));
  return { level, nextAt, progress01: p };
}
