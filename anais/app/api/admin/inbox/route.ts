import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { getCreatorUserId } from "@/lib/creator";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }
  const creatorId = await getCreatorUserId();
  if (!creatorId) {
    return NextResponse.json([]);
  }
  const recent = await prisma.message.findMany({
    where: { receiverId: creatorId },
    orderBy: { createdAt: "desc" },
    take: 500,
    include: {
      sender: { select: { id: true, email: true, name: true } },
    },
  });
  const byUser = new Map<
    string,
    { user: { id: string; email: string; name: string | null }; lastAt: string; preview: string }
  >();
  for (const m of recent) {
    if (!byUser.has(m.senderId)) {
      byUser.set(m.senderId, {
        user: m.sender,
        lastAt: m.createdAt.toISOString(),
        preview: m.body.slice(0, 120),
      });
    }
  }
  return NextResponse.json(Array.from(byUser.values()));
}
