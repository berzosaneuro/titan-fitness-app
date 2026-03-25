import { prisma } from "@/lib/prisma";
import { levelFromTotalSpent } from "@/lib/pricing";
import { getEffectivePricing } from "@/lib/effective-pricing";

export type UserMonetizationProfile = {
  priceMultiplierPercent: number;
  bonusFreeMessages: number;
  level: number;
};

/**
 * Reglas locales (sin ML): ajusta fricción según gasto y nivel.
 * Admin puede forzar multiplicador editando User en DB o ampliar reglas aquí.
 */
export async function getUserMonetizationProfile(userId: string): Promise<UserMonetizationProfile> {
  const u = await prisma.user.findUnique({
    where: { id: userId },
    select: { totalSpentCents: true, priceMultiplierPercent: true, bonusFreeMessages: true },
  });
  const pricing = await getEffectivePricing();
  const baseLevel = levelFromTotalSpent(
    u?.totalSpentCents ?? 0,
    pricing.levelThresholdsCents
  );
  let mult = u?.priceMultiplierPercent ?? 100;
  const spent = u?.totalSpentCents ?? 0;
  if (spent < 2_000 && baseLevel <= 1) mult = Math.min(mult, 95);
  if (spent > 80_000) mult = Math.max(mult, 102);
  return {
    priceMultiplierPercent: Math.min(150, Math.max(70, mult)),
    bonusFreeMessages: u?.bonusFreeMessages ?? 0,
    level: baseLevel,
  };
}

export function applyPriceMultiplier(cents: number, multiplierPercent: number): number {
  return Math.max(50, Math.round((cents * multiplierPercent) / 100));
}
