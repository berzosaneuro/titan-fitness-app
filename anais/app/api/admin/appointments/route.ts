import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }
  const list = await prisma.appointment.findMany({
    orderBy: { startAt: "desc" },
    include: {
      user: { select: { id: true, email: true, name: true } },
    },
    take: 300,
  });
  return NextResponse.json(list);
}
