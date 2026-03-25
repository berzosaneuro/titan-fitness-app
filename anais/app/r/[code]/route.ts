import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;
  const normalized = code.trim();
  if (!normalized) {
    return NextResponse.redirect(new URL("/", req.url));
  }

  const referrer = await prisma.user.findFirst({
    where: { referralCode: normalized },
    select: { id: true },
  });
  if (!referrer) {
    return NextResponse.redirect(new URL("/?ref=invalid", req.url));
  }

  const res = NextResponse.redirect(new URL("/", req.url));
  res.cookies.set("anais_ref", normalized, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 30,
    path: "/",
  });
  return res;
}
