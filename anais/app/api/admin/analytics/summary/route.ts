import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }
  const { searchParams } = new URL(req.url);
  const days = Math.min(90, Math.max(1, parseInt(searchParams.get("days") ?? "30", 10)));
  const since = new Date(Date.now() - days * 86400000);

  const [byType, topSpenders, totals, userBuckets, journeyBuckets] = await Promise.all([
    prisma.analyticsEvent.groupBy({
      by: ["type"],
      where: { createdAt: { gte: since } },
      _sum: { revenueCents: true },
      _count: { _all: true },
    }),
    prisma.user.findMany({
      where: { role: "USER" },
      orderBy: { totalSpentCents: "desc" },
      take: 25,
      select: {
        id: true,
        email: true,
        totalSpentCents: true,
        walletBalanceCents: true,
        createdAt: true,
        referredByUserId: true,
        journeyPhase: true,
        vipLevel: true,
      },
    }),
    prisma.analyticsEvent.aggregate({
      where: { createdAt: { gte: since } },
      _sum: { revenueCents: true },
    }),
    prisma.user.groupBy({
      by: ["role"],
      _count: { _all: true },
    }),
    prisma.user.groupBy({
      by: ["journeyPhase"],
      where: { role: "USER" },
      _count: { _all: true },
    }),
  ]);

  const walletTopups = await prisma.walletTransaction.aggregate({
    where: { type: "TOPUP", createdAt: { gte: since } },
    _sum: { amountCents: true },
    _count: { _all: true },
  });

  return NextResponse.json({
    days,
    since: since.toISOString(),
    analyticsRevenueCents: totals._sum.revenueCents ?? 0,
    topupsVolumeCents: walletTopups._sum.amountCents ?? 0,
    topupsCount: walletTopups._count._all,
    byType,
    topSpenders,
    userCounts: userBuckets,
    journeyBuckets,
  });
}
