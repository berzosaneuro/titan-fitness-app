import { prisma } from "@/lib/prisma";

export type AnalyticsType =
  | "topup"
  | "debit_chat"
  | "debit_priority"
  | "unlock_message"
  | "unlock_content"
  | "special_interaction"
  | "referral_reward"
  | "funnel_register"
  | "funnel_checkout_started"
  | "funnel_insufficient_funds"
  | "funnel_free_exhausted"
  | "funnel_first_spend";

export async function logAnalyticsEvent(input: {
  userId?: string | null;
  type: AnalyticsType;
  revenueCents: number;
  meta?: Record<string, unknown>;
}) {
  try {
    await prisma.analyticsEvent.create({
      data: {
        userId: input.userId ?? undefined,
        type: input.type,
        revenueCents: input.revenueCents,
        meta: input.meta ? (input.meta as object) : undefined,
      },
    });
  } catch (e) {
    console.error("analytics", e);
  }
}
