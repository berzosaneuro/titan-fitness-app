import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { signSocketToken } from "@/lib/socket-token";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const token = signSocketToken({
    sub: session.user.id,
    role: session.user.role,
  });
  return NextResponse.json({ token });
}
