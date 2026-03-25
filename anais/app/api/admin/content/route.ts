import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { ContentMediaKind, ContentVideoTier } from "@prisma/client";
import { z } from "zod";

const emptyToUndef = (v: unknown) =>
  typeof v === "string" && v.trim() === "" ? undefined : v;

const createSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.preprocess(emptyToUndef, z.string().max(2000).optional()),
  previewUrl: z.preprocess(emptyToUndef, z.string().url().optional().nullable()),
  fullUrl: z.preprocess(emptyToUndef, z.string().url().optional().nullable()),
  isPremium: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
  unlockPriceCents: z.number().int().min(0).max(500_000).optional(),
  isSeed: z.boolean().optional(),
  mediaKind: z.nativeEnum(ContentMediaKind).optional(),
  videoTeaserUrl: z.preprocess(emptyToUndef, z.string().url().optional().nullable()),
  videoFullUrl: z.preprocess(emptyToUndef, z.string().url().optional().nullable()),
  videoPosterUrl: z.preprocess(emptyToUndef, z.string().url().optional().nullable()),
  teaserSeconds: z.number().int().min(3).max(120).optional(),
  videoTier: z.nativeEnum(ContentVideoTier).optional().nullable(),
});

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }
  const items = await prisma.content.findMany({ orderBy: { sortOrder: "asc" } });
  return NextResponse.json(items);
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }
  const json = await req.json().catch(() => null);
  const parsed = createSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  }
  const row = await prisma.content.create({ data: parsed.data });
  return NextResponse.json(row);
}
