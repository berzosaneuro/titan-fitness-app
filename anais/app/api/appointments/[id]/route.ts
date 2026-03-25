import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const patchSchema = z.object({
  startAt: z.string().datetime().optional(),
  slotMinutes: z.number().min(15).max(120).optional(),
  status: z.enum(["CANCELED", "CONFIRMED", "PENDING"]).optional(),
});

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const { id } = await params;
  const existing = await prisma.appointment.findFirst({
    where: { id, userId: session.user.id },
  });
  if (!existing) {
    return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  }
  const json = await req.json().catch(() => null);
  const parsed = patchSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  }
  const { startAt, slotMinutes, status } = parsed.data;
  let start = existing.startAt;
  let end = existing.endAt;
  if (startAt) {
    start = new Date(startAt);
    const mins = slotMinutes ?? (existing.endAt.getTime() - existing.startAt.getTime()) / 60000;
    end = new Date(start.getTime() + mins * 60 * 1000);
  } else if (slotMinutes) {
    end = new Date(existing.startAt.getTime() + slotMinutes * 60 * 1000);
  }
  const updated = await prisma.appointment.update({
    where: { id },
    data: {
      startAt: start,
      endAt: end,
      ...(status ? { status } : {}),
    },
  });
  return NextResponse.json(updated);
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const { id } = await params;
  const existing = await prisma.appointment.findFirst({
    where: { id, userId: session.user.id },
  });
  if (!existing) {
    return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  }
  await prisma.appointment.update({
    where: { id },
    data: { status: "CANCELED" },
  });
  return NextResponse.json({ ok: true });
}
