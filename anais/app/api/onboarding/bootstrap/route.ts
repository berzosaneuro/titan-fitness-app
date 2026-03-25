import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { bootstrapFirstSessionMessages } from "@/lib/first-session";

export const dynamic = "force-dynamic";

/** Primera sesión: mensajes sembrados + ancla a monetización temprana (idempotente). */
export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || session.user.role === "ADMIN") {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  const seeded = await bootstrapFirstSessionMessages(session.user.id);
  return NextResponse.json({ ok: true, seeded });
}
