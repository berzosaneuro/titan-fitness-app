import { prisma } from "@/lib/prisma";
import { levelFromTotalSpent } from "@/lib/pricing";
import { getEffectivePricing } from "@/lib/effective-pricing";

/**
 * Persiste vipLevel y journeyPhase para segmentación admin y UX (embudo).
 * Fases: 1 sin recarga · 2 con recarga · 3 microtransacciones habituales · 4 nivel alto · 5 LTV fuerte.
 */
export async function syncUserProgressMeta(userId: string): Promise<void> {
  try {
    const u = await prisma.user.findUnique({
      where: { id: userId },
      select: { totalSpentCents: true, createdAt: true },
    });
    if (!u) return;

    const pricing = await getEffectivePricing();
    const vipLevel = levelFromTotalSpent(u.totalSpentCents, pricing.levelThresholdsCents);

    const [topups, debits] = await Promise.all([
      prisma.walletTransaction.count({ where: { userId, type: "TOPUP" } }),
      prisma.walletTransaction.count({ where: { userId, type: "DEBIT" } }),
    ]);

    let journeyPhase = 1;
    if (topups >= 1) journeyPhase = 2;
    if (topups >= 1 && debits >= 3) journeyPhase = 3;
    if (vipLevel >= 4) journeyPhase = Math.max(journeyPhase, 4);
    if (u.totalSpentCents >= 50_000) journeyPhase = 5;
    else if (
      journeyPhase < 5 &&
      topups >= 2 &&
      Date.now() - u.createdAt.getTime() > 14 * 86400000 &&
      u.totalSpentCents >= 15_000
    ) {
      journeyPhase = Math.max(journeyPhase, 5);
    }

    await prisma.user.update({
      where: { id: userId },
      data: { vipLevel, journeyPhase },
    });
  } catch (e) {
    console.error("syncUserProgressMeta", e);
  }
}
