import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { invalidatePricingCache } from "@/lib/effective-pricing";
import { z } from "zod";

const patchSchema = z
  .object({
    freeFirstMessages: z.number().int().min(0).max(20).optional(),
    chatMessageCostCents: z.number().int().min(10).max(1000).optional(),
    priorityReplyCents: z.number().int().min(10).max(500).optional(),
    specialInteractionCents: z.number().int().min(50).max(5000).optional(),
    defaultUnlockMessageCents: z.number().int().min(50).max(1000).optional(),
    defaultContentUnlockCents: z.number().int().min(50).max(2000).optional(),
    levelThresholdsCents: z.array(z.number().int().min(0)).min(2).max(12).optional(),
    topupBonusPercentByEur: z.record(z.string(), z.number().min(0).max(50)).optional(),
    referrerFirstTopupRewardCents: z.number().int().min(0).max(5000).optional(),
  })
  .strict();

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }
  const row = await prisma.platformConfig.upsert({
    where: { id: 1 },
    create: { id: 1, pricing: {} },
    update: {},
  });
  return NextResponse.json(row.pricing);
}

export async function PUT(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }
  const json = await req.json().catch(() => null);
  const parsed = patchSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  }
  const current = await prisma.platformConfig.upsert({
    where: { id: 1 },
    create: { id: 1, pricing: {} },
    update: {},
  });
  const prev = (current.pricing && typeof current.pricing === "object"
    ? (current.pricing as Record<string, unknown>)
    : {}) as Record<string, unknown>;
  const next = { ...prev, ...parsed.data };
  await prisma.platformConfig.update({
    where: { id: 1 },
    data: { pricing: next },
  });
  invalidatePricingCache();
  return NextResponse.json(next);
}
