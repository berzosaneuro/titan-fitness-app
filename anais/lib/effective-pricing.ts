import { prisma } from "@/lib/prisma";
import {
  DEFAULT_CONTENT_UNLOCK_CENTS,
  DEFAULT_UNLOCK_MESSAGE_CENTS,
  FREE_FIRST_MESSAGES,
  LEVEL_THRESHOLDS_CENTS,
  SPECIAL_INTERACTION_CENTS,
  CHAT_MESSAGE_COST_CENTS,
  PRIORITY_REPLY_CENTS,
  TOPUP_EUR_OPTIONS,
  type TopupEur,
} from "@/lib/pricing";

export type TopupTier = { eur: TopupEur; bonusPercent: number };

export type EffectivePricing = {
  freeFirstMessages: number;
  chatMessageCostCents: number;
  priorityReplyCents: number;
  specialInteractionCents: number;
  defaultUnlockMessageCents: number;
  defaultContentUnlockCents: number;
  levelThresholdsCents: readonly number[];
  topupTiers: TopupTier[];
  /** Crédito al referidor en la primera recarga del referido. */
  referrerFirstTopupRewardCents: number;
};

const DEFAULT_TOPUP_BONUS: Record<number, number> = {
  10: 0,
  25: 0,
  50: 8,
};

const DEFAULT_EFFECTIVE: EffectivePricing = {
  freeFirstMessages: FREE_FIRST_MESSAGES,
  chatMessageCostCents: CHAT_MESSAGE_COST_CENTS,
  priorityReplyCents: PRIORITY_REPLY_CENTS,
  specialInteractionCents: SPECIAL_INTERACTION_CENTS,
  defaultUnlockMessageCents: DEFAULT_UNLOCK_MESSAGE_CENTS,
  defaultContentUnlockCents: DEFAULT_CONTENT_UNLOCK_CENTS,
  levelThresholdsCents: LEVEL_THRESHOLDS_CENTS,
  topupTiers: TOPUP_EUR_OPTIONS.map((eur) => ({
    eur,
    bonusPercent: DEFAULT_TOPUP_BONUS[eur] ?? 0,
  })),
  referrerFirstTopupRewardCents: 500,
};

let cache: { at: number; value: EffectivePricing } | null = null;
const TTL_MS = 60_000;

function mergeOverrides(base: EffectivePricing, raw: unknown): EffectivePricing {
  if (!raw || typeof raw !== "object") return base;
  const o = raw as Record<string, unknown>;
  const topupBonus = o.topupBonusPercentByEur as Record<string, number> | undefined;
  const tiers = base.topupTiers.map((t) => ({
    ...t,
    bonusPercent:
      topupBonus && typeof topupBonus[String(t.eur)] === "number"
        ? topupBonus[String(t.eur)]!
        : t.bonusPercent,
  }));
  return {
    freeFirstMessages:
      typeof o.freeFirstMessages === "number" ? o.freeFirstMessages : base.freeFirstMessages,
    chatMessageCostCents:
      typeof o.chatMessageCostCents === "number"
        ? o.chatMessageCostCents
        : base.chatMessageCostCents,
    priorityReplyCents:
      typeof o.priorityReplyCents === "number" ? o.priorityReplyCents : base.priorityReplyCents,
    specialInteractionCents:
      typeof o.specialInteractionCents === "number"
        ? o.specialInteractionCents
        : base.specialInteractionCents,
    defaultUnlockMessageCents:
      typeof o.defaultUnlockMessageCents === "number"
        ? o.defaultUnlockMessageCents
        : base.defaultUnlockMessageCents,
    defaultContentUnlockCents:
      typeof o.defaultContentUnlockCents === "number"
        ? o.defaultContentUnlockCents
        : base.defaultContentUnlockCents,
    levelThresholdsCents: Array.isArray(o.levelThresholdsCents)
      ? (o.levelThresholdsCents as number[])
      : [...base.levelThresholdsCents],
    topupTiers: tiers,
    referrerFirstTopupRewardCents:
      typeof o.referrerFirstTopupRewardCents === "number"
        ? o.referrerFirstTopupRewardCents
        : base.referrerFirstTopupRewardCents,
  };
}

export async function getEffectivePricing(): Promise<EffectivePricing> {
  const now = Date.now();
  if (cache && now - cache.at < TTL_MS) return cache.value;

  const row = await prisma.platformConfig.findUnique({ where: { id: 1 } });
  const merged = mergeOverrides(DEFAULT_EFFECTIVE, row?.pricing ?? {});
  cache = { at: now, value: merged };
  return merged;
}

export function invalidatePricingCache() {
  cache = null;
}

export function computeTopupCreditCents(
  eur: number,
  pricing: EffectivePricing
): { paidCents: number; bonusCents: number; creditCents: number; bonusPercent: number } {
  const paidCents = Math.round(eur * 100);
  const tier = pricing.topupTiers.find((t) => t.eur === eur);
  const bonusPercent = tier?.bonusPercent ?? 0;
  const bonusCents = Math.round((paidCents * bonusPercent) / 100);
  return { paidCents, bonusCents, creditCents: paidCents + bonusCents, bonusPercent };
}
