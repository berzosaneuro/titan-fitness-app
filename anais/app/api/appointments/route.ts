import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const createSchema = z.object({
  startAt: z.string().datetime(),
  slotMinutes: z.number().min(15).max(120).default(30),
  notes: z.string().max(500).optional(),
});

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const list = await prisma.appointment.findMany({
    where: { userId: session.user.id },
    orderBy: { startAt: "asc" },
  });
  return NextResponse.json(list);
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const json = await req.json().catch(() => null);
  const parsed = createSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  }
  const start = new Date(parsed.data.startAt);
  const end = new Date(start.getTime() + parsed.data.slotMinutes * 60 * 1000);
  const appt = await prisma.appointment.create({
    data: {
      userId: session.user.id,
      startAt: start,
      endAt: end,
      status: "CONFIRMED",
      notes: parsed.data.notes?.trim() || null,
    },
  });
  return NextResponse.json(appt);
}
