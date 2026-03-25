import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;
  const normalized = code.trim().toLowerCase();
  const invite = await prisma.invite.findUnique({ where: { code: normalized } });
  const now = new Date();
  if (
    !invite ||
    invite.usedCount >= invite.maxUses ||
    (invite.expiresAt && invite.expiresAt < now)
  ) {
    return NextResponse.redirect(new URL("/?invite=invalid", req.url));
  }

  const res = NextResponse.redirect(new URL("/register", req.url));
  res.cookies.set("anais_invite_code", normalized, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 7,
    path: "/",
  });
  return res;
}
