import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { getCreatorUserId } from "@/lib/creator";
import { debitWallet, InsufficientFundsError } from "@/lib/wallet";
import { getEffectivePricing } from "@/lib/effective-pricing";
import { logAnalyticsEvent } from "@/lib/analytics";
import { applyPriceMultiplier, getUserMonetizationProfile } from "@/lib/decision-engine";
import { logPurchase } from "@/lib/purchase-log";
import { syncUserProgressMeta } from "@/lib/user-progress-sync";

/** Microtransacción de “gesto especial” (percepción VIP, sin contenido explícito). */
export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const creatorId = await getCreatorUserId();
  if (!creatorId) {
    return NextResponse.json({ error: "Creador no configurado" }, { status: 503 });
  }
  if (session.user.id === creatorId) {
    return NextResponse.json({ error: "No aplica" }, { status: 400 });
  }

  const pricing = await getEffectivePricing();
  const profile = await getUserMonetizationProfile(session.user.id);
  const amount = applyPriceMultiplier(
    pricing.specialInteractionCents,
    profile.priceMultiplierPercent
  );

  try {
    await prisma.$transaction(async (tx) => {
      await debitWallet(session.user.id, amount, "special_interaction", tx);
      await tx.message.create({
        data: {
          senderId: session.user.id,
          receiverId: creatorId,
          body: "[Solicitud de interacción prioritaria — discreta]",
          priorityBoost: true,
        },
      });
    });
    await logAnalyticsEvent({
      userId: session.user.id,
      type: "special_interaction",
      revenueCents: amount,
    });
    await logPurchase({
      userId: session.user.id,
      amountCents: amount,
      kind: "special_interaction",
    });
    void syncUserProgressMeta(session.user.id);
  } catch (e) {
    if (e instanceof InsufficientFundsError) {
      return NextResponse.json({ error: "Saldo insuficiente" }, { status: 402 });
    }
    throw e;
  }

  const wallet = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { walletBalanceCents: true },
  });

  return NextResponse.json({
    ok: true,
    walletBalanceCents: wallet?.walletBalanceCents ?? 0,
  });
}
