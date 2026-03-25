import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { debitWallet, InsufficientFundsError } from "@/lib/wallet";
import { logAnalyticsEvent } from "@/lib/analytics";
import { applyPriceMultiplier, getUserMonetizationProfile } from "@/lib/decision-engine";
import { logPurchase } from "@/lib/purchase-log";
import { syncUserProgressMeta } from "@/lib/user-progress-sync";
import { z } from "zod";

const bodySchema = z.object({ contentId: z.string().min(1) });

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const json = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  }

  const content = await prisma.content.findUnique({ where: { id: parsed.data.contentId } });
  if (!content) {
    return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  }

  const existing = await prisma.contentUnlock.findUnique({
    where: {
      userId_contentId: { userId: session.user.id, contentId: content.id },
    },
  });
  if (existing) {
    return NextResponse.json({
      ok: true,
      already: true,
      fullUrl: content.videoFullUrl || content.fullUrl,
    });
  }

  if (!content.isPremium) {
    const w = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { walletBalanceCents: true },
    });
    return NextResponse.json({
      ok: true,
      fullUrl: content.fullUrl,
      walletBalanceCents: w?.walletBalanceCents ?? 0,
    });
  }
  const profile = await getUserMonetizationProfile(session.user.id);
  const price = applyPriceMultiplier(content.unlockPriceCents, profile.priceMultiplierPercent);
  try {
    await prisma.$transaction(async (tx) => {
      await debitWallet(session.user.id, price, "unlock_content", tx);
      await tx.contentUnlock.create({
        data: { userId: session.user.id, contentId: content.id },
      });
    });
    await logAnalyticsEvent({
      userId: session.user.id,
      type: "unlock_content",
      revenueCents: price,
      meta: { contentId: content.id },
    });
    await logPurchase({
      userId: session.user.id,
      amountCents: price,
      kind: "unlock_content",
      refId: content.id,
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

  const playUrl = content.videoFullUrl || content.fullUrl;
  return NextResponse.json({
    ok: true,
    fullUrl: playUrl,
    walletBalanceCents: wallet?.walletBalanceCents ?? 0,
  });
}
