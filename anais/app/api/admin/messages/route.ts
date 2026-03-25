import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { getCreatorUserId } from "@/lib/creator";
import { convRoom } from "@/lib/conv";
import { payloadFromMessage } from "@/lib/message-wire";
import { getUserMonetizationProfile } from "@/lib/decision-engine";
import { getIo } from "@/socket/singleton";
import { z } from "zod";

const schema = z.object({
  userId: z.string().min(1),
  body: z.string().min(1).max(4000),
  isLocked: z.boolean().optional(),
  previewText: z.string().max(500).optional(),
  unlockPriceCents: z.number().int().min(50).max(50000).optional(),
  priorityBoost: z.boolean().optional(),
});

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }
  const creatorId = await getCreatorUserId();
  if (!creatorId) {
    return NextResponse.json({ error: "Creador no configurado" }, { status: 503 });
  }
  const { searchParams } = new URL(req.url);
  const userId = searchParams.get("userId");
  if (!userId) {
    return NextResponse.json({ error: "userId requerido" }, { status: 400 });
  }
  const messages = await prisma.message.findMany({
    where: {
      OR: [
        { senderId: userId, receiverId: creatorId },
        { senderId: creatorId, receiverId: userId },
      ],
    },
    orderBy: { createdAt: "asc" },
    take: 300,
  });
  return NextResponse.json(messages);
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }
  const creatorId = await getCreatorUserId();
  if (!creatorId) {
    return NextResponse.json({ error: "Creador no configurado" }, { status: 503 });
  }
  const json = await req.json().catch(() => null);
  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  }
  const msg = await prisma.message.create({
    data: {
      senderId: creatorId,
      receiverId: parsed.data.userId,
      body: parsed.data.body.trim(),
      isLocked: parsed.data.isLocked ?? false,
      previewText: parsed.data.previewText?.trim() || null,
      unlockPriceCents: parsed.data.unlockPriceCents ?? null,
      priorityBoost: parsed.data.priorityBoost ?? false,
    },
  });

  const io = getIo();
  if (io) {
    const room = convRoom(parsed.data.userId, creatorId);
    const prof = await getUserMonetizationProfile(parsed.data.userId);
    const wire = payloadFromMessage(msg, parsed.data.userId, new Set(), {
      priceMultiplierPercent: prof.priceMultiplierPercent,
    });
    io.to(room).emit("message:new", { message: wire });
  }

  return NextResponse.json(msg);
}
