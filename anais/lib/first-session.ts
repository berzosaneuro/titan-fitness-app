import { prisma } from "@/lib/prisma";
import { getCreatorUserId } from "@/lib/creator";
import { getEffectivePricing } from "@/lib/effective-pricing";

/**
 * Primera sesión: 1 mensaje visible + 1 candado + anclaje a pago temprano.
 * Idempotente por `firstSessionSeededAt`.
 */
export async function bootstrapFirstSessionMessages(userId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { firstSessionSeededAt: true, role: true },
  });
  if (!user || user.role !== "USER" || user.firstSessionSeededAt) return false;

  const creatorId = await getCreatorUserId();
  if (!creatorId || creatorId === userId) return false;

  const pricing = await getEffectivePricing();
  const unlockCents = pricing.defaultUnlockMessageCents;

  await prisma.$transaction(async (tx) => {
    await tx.message.create({
      data: {
        senderId: creatorId,
        receiverId: userId,
        body: "Bienvenida al espacio reservado. Este mensaje es de cortesía — el siguiente lleva candado para mantener el canal selectivo.",
        isLocked: false,
      },
    });
    await tx.message.create({
      data: {
        senderId: creatorId,
        receiverId: userId,
        body: "Contenido reservado para quienes continúan. Desbloqueo discreto desde tu saldo.",
        isLocked: true,
        previewText: "Hay una nota privada esperando…",
        unlockPriceCents: unlockCents,
      },
    });
    await tx.user.update({
      where: { id: userId },
      data: { firstSessionSeededAt: new Date() },
    });
  });

  await prisma.userNotification.create({
    data: {
      userId,
      kind: "first_session_nudge",
      title: "Actualización en tu espacio",
      body: "Revisa Mensajes (cortesía + candado) y Contenido para la vista previa en vídeo. Recarga mínima en Perfil para desbloquear.",
    },
  });

  return true;
}
