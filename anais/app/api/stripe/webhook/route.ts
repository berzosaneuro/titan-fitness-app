import { NextResponse } from "next/server";
import { headers } from "next/headers";
import Stripe from "stripe";
import { getStripe } from "@/lib/stripe";
import { prisma } from "@/lib/prisma";
import { creditTopUpIdempotent, creditAdjustment } from "@/lib/wallet";
import { getEffectivePricing } from "@/lib/effective-pricing";
import { logAnalyticsEvent } from "@/lib/analytics";

export async function POST(req: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "Webhook no configurado" }, { status: 503 });
  }

  const body = await req.text();
  const sig = (await headers()).get("stripe-signature");
  if (!sig) return NextResponse.json({ error: "Firma ausente" }, { status: 400 });

  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(body, sig, secret);
  } catch {
    return NextResponse.json({ error: "Firma inválida" }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const kind = session.metadata?.kind;
        if (kind === "wallet_topup") {
          const userId = session.metadata?.userId;
          const creditCents = parseInt(session.metadata?.creditCents ?? "0", 10);
          const paidCents = parseInt(session.metadata?.paidCents ?? "0", 10);
          const bonusCents = parseInt(session.metadata?.bonusCents ?? "0", 10);
          const effectiveCredit =
            creditCents > 0 ? creditCents : parseInt(session.metadata?.topupCents ?? "0", 10);
          if (userId && effectiveCredit > 0 && session.id) {
            await creditTopUpIdempotent(userId, effectiveCredit, session.id, {
              paidCents: paidCents || effectiveCredit,
              bonusCents,
            });

            const topupCount = await prisma.walletTransaction.count({
              where: { userId, type: "TOPUP" },
            });
            if (topupCount === 1) {
              const u = await prisma.user.findUnique({
                where: { id: userId },
                select: { referredByUserId: true },
              });
              if (u?.referredByUserId) {
                const pricing = await getEffectivePricing();
                const reward = pricing.referrerFirstTopupRewardCents;
                if (reward > 0) {
                  await creditAdjustment(u.referredByUserId, reward, "referral_first_topup");
                  await logAnalyticsEvent({
                    userId: u.referredByUserId,
                    type: "referral_reward",
                    revenueCents: 0,
                    meta: { refereeId: userId, rewardCents: reward },
                  });
                }
              }
            }
          }
          break;
        }
        const userId = session.metadata?.userId;
        const subId =
          typeof session.subscription === "string"
            ? session.subscription
            : session.subscription?.id;
        const customerId =
          typeof session.customer === "string" ? session.customer : session.customer?.id;
        if (userId && subId) {
          const stripeSub = await getStripe().subscriptions.retrieve(subId);
          const end = stripeSub.current_period_end
            ? new Date(stripeSub.current_period_end * 1000)
            : null;
          await prisma.subscription.upsert({
            where: { userId },
            create: {
              userId,
              stripeCustomerId: customerId ?? undefined,
              stripeSubscriptionId: subId,
              status: "ACTIVE",
              currentPeriodEnd: end,
            },
            update: {
              stripeCustomerId: customerId ?? undefined,
              stripeSubscriptionId: subId,
              status: "ACTIVE",
              currentPeriodEnd: end,
            },
          });
        }
        break;
      }
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        const record = await prisma.subscription.findFirst({
          where: { stripeSubscriptionId: sub.id },
        });
        if (record) {
          const active = sub.status === "active" || sub.status === "trialing";
          await prisma.subscription.update({
            where: { id: record.id },
            data: {
              status: active ? "ACTIVE" : sub.status === "past_due" ? "PAST_DUE" : "CANCELED",
              currentPeriodEnd: sub.current_period_end
                ? new Date(sub.current_period_end * 1000)
                : null,
            },
          });
        }
        break;
      }
      default:
        break;
    }
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Error procesando evento" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
