import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { nanoid } from "nanoid";
import { z } from "zod";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }
  const list = await prisma.invite.findMany({ orderBy: { createdAt: "desc" }, take: 100 });
  return NextResponse.json(list);
}

const postSchema = z.object({
  maxUses: z.number().int().min(1).max(100_000).optional(),
  expiresInDays: z.number().int().min(1).max(365).optional(),
  note: z.string().max(200).optional(),
});

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }
  const json = await req.json().catch(() => ({}));
  const parsed = postSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  }
  const code = nanoid(10).toLowerCase();
  const expiresAt =
    parsed.data.expiresInDays != null
      ? new Date(Date.now() + parsed.data.expiresInDays * 86400000)
      : null;
  const row = await prisma.invite.create({
    data: {
      code,
      maxUses: parsed.data.maxUses ?? 50,
      note: parsed.data.note?.trim() || null,
      expiresAt,
      createdByUserId: session.user.id,
    },
  });
  return NextResponse.json(row);
}
