import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getEffectivePricing } from "@/lib/effective-pricing";
import { logAnalyticsEvent } from "@/lib/analytics";
import { bootstrapFirstSessionMessages } from "@/lib/first-session";

const bodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
  name: z.string().min(1).max(80).optional(),
});

export async function POST(req: Request) {
  try {
    const allowOpen = process.env.ALLOW_OPEN_REGISTER === "true";
    const cookieStore = cookies();
    const cookieCode = cookieStore.get("anais_invite_code")?.value?.toLowerCase().trim();
    const refCode = cookieStore.get("anais_ref")?.value?.trim();

    const pricing = await getEffectivePricing();
    const freeLeft = pricing.freeFirstMessages;

    let referredByUserId: string | undefined;
    if (refCode) {
      const refUser = await prisma.user.findFirst({
        where: { referralCode: refCode },
        select: { id: true },
      });
      if (refUser) referredByUserId = refUser.id;
    }

    const json = await req.json();
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
    }

    if (!allowOpen && !cookieCode) {
      return NextResponse.json({ error: "Se requiere invitación válida." }, { status: 403 });
    }

    const { email, password, name } = parsed.data;
    const normalized = email.trim().toLowerCase();
    const exists = await prisma.user.findUnique({ where: { email: normalized } });
    if (exists) {
      return NextResponse.json({ error: "Este correo ya está registrado" }, { status: 409 });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    if (allowOpen) {
      const user = await prisma.user.create({
        data: {
          email: normalized,
          passwordHash,
          name: name?.trim() || null,
          referredByUserId,
          chatEntitlement: { create: { freeMessagesLeft: freeLeft } },
        },
      });
      await logAnalyticsEvent({
        userId: user.id,
        type: "funnel_register",
        revenueCents: 0,
        meta: { referred: Boolean(referredByUserId) },
      });
      void bootstrapFirstSessionMessages(user.id).catch(() => {});
      return NextResponse.json({ ok: true });
    }

    let registeredId: string | null = null;
    await prisma.$transaction(async (tx) => {
      const invite = await tx.invite.findUnique({ where: { code: cookieCode! } });
      const now = new Date();
      if (
        !invite ||
        invite.usedCount >= invite.maxUses ||
        (invite.expiresAt && invite.expiresAt < now)
      ) {
        throw new Error("INVITE_INVALID");
      }
      await tx.invite.update({
        where: { id: invite.id },
        data: { usedCount: { increment: 1 } },
      });
      const user = await tx.user.create({
        data: {
          email: normalized,
          passwordHash,
          name: name?.trim() || null,
          inviteId: invite.id,
          referredByUserId,
          chatEntitlement: { create: { freeMessagesLeft: freeLeft } },
        },
      });
      registeredId = user.id;
    });

    if (registeredId) {
      await logAnalyticsEvent({
        userId: registeredId,
        type: "funnel_register",
        revenueCents: 0,
        meta: { referred: Boolean(referredByUserId) },
      });
      void bootstrapFirstSessionMessages(registeredId).catch(() => {});
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof Error && e.message === "INVITE_INVALID") {
      return NextResponse.json({ error: "Invitación no válida o agotada." }, { status: 403 });
    }
    return NextResponse.json({ error: "Error al registrar" }, { status: 500 });
  }
}
