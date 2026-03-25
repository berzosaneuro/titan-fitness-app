import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { logAnalyticsEvent } from "@/lib/analytics";
import { syncUserProgressMeta } from "@/lib/user-progress-sync";

export class InsufficientFundsError extends Error {
  constructor() {
    super("INSUFFICIENT_FUNDS");
    this.name = "InsufficientFundsError";
  }
}

async function logSpendAnalytics(userId: string, amountCents: number, reason: string) {
  if (amountCents <= 0) return;
  if (reason === "chat_message_paid") {
    await logAnalyticsEvent({
      userId,
      type: "debit_chat",
      revenueCents: amountCents,
      meta: { reason },
    });
  } else if (reason === "chat_message_priority" || reason === "priority_reply") {
    await logAnalyticsEvent({
      userId,
      type: "debit_priority",
      revenueCents: amountCents,
      meta: { reason },
    });
  }
}

export async function debitWallet(
  userId: string,
  amountCents: number,
  reason: string,
  tx?: Prisma.TransactionClient,
  opts?: { skipAnalytics?: boolean }
) {
  const run = async (db: Prisma.TransactionClient) => {
    const u = await db.user.findUniqueOrThrow({ where: { id: userId } });
    if (u.walletBalanceCents < amountCents) throw new InsufficientFundsError();
    const nextBal = u.walletBalanceCents - amountCents;
    const nextSpent = u.totalSpentCents + amountCents;
    await db.user.update({
      where: { id: userId },
      data: { walletBalanceCents: nextBal, totalSpentCents: nextSpent },
    });
    await db.walletTransaction.create({
      data: {
        userId,
        type: "DEBIT",
        amountCents,
        balanceAfterCents: nextBal,
        reason,
      },
    });
    return { balanceAfterCents: nextBal, totalSpentCents: nextSpent };
  };
  const out = tx ? await run(tx) : await prisma.$transaction(run);
  const skipLog = opts?.skipAnalytics ?? Boolean(tx);
  if (!skipLog && amountCents > 0) {
    await logSpendAnalytics(userId, amountCents, reason);
  }
  if (!tx) void syncUserProgressMeta(userId);
  return out;
}

export async function creditAdjustment(
  userId: string,
  amountCents: number,
  reason: string,
  tx?: Prisma.TransactionClient
) {
  const run = async (db: Prisma.TransactionClient) => {
    const u = await db.user.findUniqueOrThrow({ where: { id: userId } });
    const nextBal = u.walletBalanceCents + amountCents;
    await db.user.update({
      where: { id: userId },
      data: { walletBalanceCents: nextBal },
    });
    await db.walletTransaction.create({
      data: {
        userId,
        type: "ADJUSTMENT",
        amountCents,
        balanceAfterCents: nextBal,
        reason,
      },
    });
    return nextBal;
  };
  if (tx) return run(tx);
  return prisma.$transaction(run);
}

/** Acredita saldo total (pago + bono). Idempotente por sesión Stripe. */
export async function creditTopUpIdempotent(
  userId: string,
  creditCents: number,
  stripeCheckoutSessionId: string,
  meta?: { paidCents?: number; bonusCents?: number }
) {
  const existing = await prisma.walletTransaction.findUnique({
    where: { stripeCheckoutSessionId },
  });
  if (existing) return { already: true as const, balanceAfterCents: existing.balanceAfterCents };

  const result = await prisma.$transaction(async (db) => {
    const u = await db.user.findUniqueOrThrow({ where: { id: userId } });
    const nextBal = u.walletBalanceCents + creditCents;
    await db.user.update({
      where: { id: userId },
      data: { walletBalanceCents: nextBal },
    });
    const row = await db.walletTransaction.create({
      data: {
        userId,
        type: "TOPUP",
        amountCents: creditCents,
        balanceAfterCents: nextBal,
        stripeCheckoutSessionId,
        reason: "wallet_topup",
      },
    });
    return row;
  });

  const paid = meta?.paidCents ?? creditCents;
  await logAnalyticsEvent({
    userId,
    type: "topup",
    revenueCents: paid,
    meta: {
      creditCents,
      bonusCents: meta?.bonusCents ?? 0,
      sessionId: stripeCheckoutSessionId,
    },
  });

  void syncUserProgressMeta(userId);

  return { already: false as const, balanceAfterCents: result.balanceAfterCents };
}
