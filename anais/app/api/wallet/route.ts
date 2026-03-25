import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { FREE_FIRST_MESSAGES, progressToNextLevel } from "@/lib/pricing";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const u = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      walletBalanceCents: true,
      totalSpentCents: true,
      chatEntitlement: { select: { freeMessagesLeft: true } },
    },
  });
  if (!u) return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
  const gam = progressToNextLevel(u.totalSpentCents);
  return NextResponse.json({
    walletBalanceCents: u.walletBalanceCents,
    totalSpentCents: u.totalSpentCents,
    freeMessagesLeft: u.chatEntitlement?.freeMessagesLeft ?? FREE_FIRST_MESSAGES,
    level: gam.level,
    nextLevelAtCents: gam.nextAt,
    levelProgress01: gam.progress01,
  });
}
