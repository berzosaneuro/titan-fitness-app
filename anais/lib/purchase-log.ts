import { prisma } from "@/lib/prisma";

export async function logPurchase(input: {
  userId: string;
  amountCents: number;
  kind: string;
  refId?: string | null;
}) {
  try {
    await prisma.purchase.create({
      data: {
        userId: input.userId,
        amountCents: input.amountCents,
        kind: input.kind,
        refId: input.refId ?? null,
      },
    });
  } catch (e) {
    console.error("purchase log", e);
  }
}
