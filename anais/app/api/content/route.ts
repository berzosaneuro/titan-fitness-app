import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const items = await prisma.content.findMany({
    orderBy: { sortOrder: "asc" },
    select: {
      id: true,
      title: true,
      description: true,
      previewUrl: true,
      fullUrl: true,
      isPremium: true,
      unlockPriceCents: true,
      sortOrder: true,
      mediaKind: true,
      videoTeaserUrl: true,
      videoFullUrl: true,
      videoPosterUrl: true,
      teaserSeconds: true,
    },
  });
  const unlocks = await prisma.contentUnlock.findMany({
    where: { userId: session.user.id },
    select: { contentId: true },
  });
  const unlocked = new Set(unlocks.map((u) => u.contentId));

  const safe = items.map((c) => ({
    ...c,
    fullUrl: !c.isPremium || unlocked.has(c.id) ? c.fullUrl : null,
    locked: c.isPremium && !unlocked.has(c.id),
  }));
  return NextResponse.json(safe);
}
