import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const u = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { referralCode: true },
  });
  if (!u?.referralCode) {
    return NextResponse.json({ error: "Sin código" }, { status: 404 });
  }
  const base = process.env.NEXTAUTH_URL ?? new URL(req.url).origin;
  const link = `${base}/r/${u.referralCode}`;
  const count = await prisma.user.count({ where: { referredByUserId: session.user.id } });
  return NextResponse.json({ referralCode: u.referralCode, link, invitedCount: count });
}
