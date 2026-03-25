import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { getStripe } from "@/lib/stripe";
import { computeTopupCreditCents, getEffectivePricing } from "@/lib/effective-pricing";
import { logAnalyticsEvent } from "@/lib/analytics";
import { TOPUP_EUR_OPTIONS, type TopupEur } from "@/lib/pricing";
import { z } from "zod";

const bodySchema = z.object({
  eur: z.union([z.literal(10), z.literal(25), z.literal(50)]),
});

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || !session.user.email) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const json = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Importe inválido", allowed: TOPUP_EUR_OPTIONS },
      { status: 400 }
    );
  }

  const eur = parsed.data.eur as TopupEur;
  const pricing = await getEffectivePricing();
  const { paidCents, bonusCents, creditCents, bonusPercent } = computeTopupCreditCents(
    eur,
    pricing
  );

  const base = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
  const stripe = getStripe();

  const bonusLine =
    bonusPercent > 0 ? ` · +${bonusPercent}% extra en saldo` : "";

  const checkout = await stripe.checkout.sessions.create({
    mode: "payment",
    customer_email: session.user.email,
    line_items: [
      {
        price_data: {
          currency: "eur",
          unit_amount: paidCents,
          product_data: {
            name: "Anaïs — recarga de saldo",
            description: `Crédito discreto en plataforma${bonusLine}.`,
          },
        },
        quantity: 1,
      },
    ],
    success_url: `${base}/profile?wallet=ok`,
    cancel_url: `${base}/profile?wallet=cancel`,
    metadata: {
      kind: "wallet_topup",
      userId: session.user.id,
      paidCents: String(paidCents),
      bonusCents: String(bonusCents),
      creditCents: String(creditCents),
    },
    payment_intent_data: {
      metadata: {
        kind: "wallet_topup",
        userId: session.user.id,
        paidCents: String(paidCents),
        bonusCents: String(bonusCents),
        creditCents: String(creditCents),
      },
    },
  });

  await logAnalyticsEvent({
    userId: session.user.id,
    type: "funnel_checkout_started",
    revenueCents: 0,
    meta: { eur, paidCents, checkoutSessionId: checkout.id },
  });

  return NextResponse.json({ url: checkout.url });
}
