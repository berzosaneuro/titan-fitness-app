import { NextResponse } from "next/server";
import { getEffectivePricing } from "@/lib/effective-pricing";
import { RECOMMENDED_TOPUP_EUR } from "@/lib/pricing";

export const dynamic = "force-dynamic";

/** Precios efectivos para UI (sin datos sensibles). */
export async function GET() {
  const p = await getEffectivePricing();
  return NextResponse.json({
    topupTiers: p.topupTiers,
    recommendedTopupEur: RECOMMENDED_TOPUP_EUR,
    freeFirstMessages: p.freeFirstMessages,
    chatMessageCostCents: p.chatMessageCostCents,
    priorityReplyCents: p.priorityReplyCents,
    specialInteractionCents: p.specialInteractionCents,
    defaultUnlockMessageCents: p.defaultUnlockMessageCents,
    defaultContentUnlockCents: p.defaultContentUnlockCents,
    levelThresholdsCents: p.levelThresholdsCents,
  });
}
