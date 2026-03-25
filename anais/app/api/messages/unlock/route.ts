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
import { z } from "zod";

const bodySchema = z.object({ messageId: z.string().min(1) });

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const creatorId = await getCreatorUserId();
  if (!creatorId) {
    return NextResponse.json({ error: "Creador no configurado" }, { status: 503 });
  }
  const json = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  }

  const msg = await prisma.message.findFirst({
    where: {
      id: parsed.data.messageId,
      receiverId: session.user.id,
      senderId: creatorId,
      isLocked: true,
    },
  });
  if (!msg) {
    return NextResponse.json({ error: "No desbloqueable" }, { status: 404 });
  }

  const existing = await prisma.messageUnlock.findUnique({
    where: {
      userId_messageId: { userId: session.user.id, messageId: msg.id },
    },
  });
  if (existing) {
    return NextResponse.json({ ok: true, already: true });
  }

  const pricing = await getEffectivePricing();
  const profile = await getUserMonetizationProfile(session.user.id);
  const base = msg.unlockPriceCents ?? pricing.defaultUnlockMessageCents;
  const price = applyPriceMultiplier(base, profile.priceMultiplierPercent);
  try {
    await prisma.$transaction(async (tx) => {
      await debitWallet(session.user.id, price, "unlock_message", tx);
      await tx.messageUnlock.create({
        data: { userId: session.user.id, messageId: msg.id },
      });
    });
    await logAnalyticsEvent({
      userId: session.user.id,
      type: "unlock_message",
      revenueCents: price,
      meta: { messageId: msg.id },
    });
    await logPurchase({
      userId: session.user.id,
      amountCents: price,
      kind: "unlock_message",
      refId: msg.id,
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
    message: {
      id: msg.id,
      body: msg.body,
      isLocked: false,
      unlockPriceCents: null,
      previewText: null,
    },
    walletBalanceCents: wallet?.walletBalanceCents ?? 0,
  });
}
