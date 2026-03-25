import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { getCreatorUserId } from "@/lib/creator";
import { payloadFromMessage } from "@/lib/message-wire";
import { getUserMonetizationProfile } from "@/lib/decision-engine";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const creatorId = await getCreatorUserId();
  if (!creatorId) {
    return NextResponse.json({ error: "Creador no configurado" }, { status: 503 });
  }
  const uid = session.user.id;
  if (uid === creatorId) {
    return NextResponse.json([]);
  }
  const messages = await prisma.message.findMany({
    where: {
      OR: [
        { senderId: uid, receiverId: creatorId },
        { senderId: creatorId, receiverId: uid },
      ],
    },
    orderBy: { createdAt: "asc" },
    take: 200,
  });
  const unlockRows = await prisma.messageUnlock.findMany({
    where: { userId: uid },
    select: { messageId: true },
  });
  const unlocked = new Set(unlockRows.map((x) => x.messageId));
  const profile = await getUserMonetizationProfile(uid);
  return NextResponse.json(
    messages.map((m) =>
      payloadFromMessage(m, uid, unlocked, {
        priceMultiplierPercent: profile.priceMultiplierPercent,
      })
    )
  );
}

/** Los miembros envían vía Socket.io (tiempo real + cobro). */
export async function POST() {
  return NextResponse.json(
    { error: "Usa el chat en tiempo real para enviar mensajes." },
    { status: 410 }
  );
}
