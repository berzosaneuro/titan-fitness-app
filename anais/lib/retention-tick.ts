import { prisma } from "@/lib/prisma";
import { getCreatorUserId } from "@/lib/creator";
import { getIo } from "@/socket/singleton";

/** Reenganche automático: notificaciones in-app + emisión socket (títulos neutros). */
export async function runRetentionTick() {
  const creatorId = await getCreatorUserId();
  if (!creatorId) return;

  const cutoff = new Date(Date.now() - 60 * 60 * 1000);
  const unread = await prisma.message.findMany({
    where: {
      senderId: creatorId,
      read: false,
      createdAt: { lt: cutoff },
    },
    distinct: ["receiverId"],
    select: { receiverId: true },
    take: 100,
  });

  const io = getIo();

  for (const row of unread) {
    const dup = await prisma.userNotification.findFirst({
      where: {
        userId: row.receiverId,
        kind: "new_thread_item",
        createdAt: { gt: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      },
    });
    if (dup) continue;

    await prisma.userNotification.create({
      data: {
        userId: row.receiverId,
        kind: "new_thread_item",
        title: "Actualización en tu bandeja",
        body: "Hay algo nuevo en tu conversación reservada.",
      },
    });

    io?.to(`user:${row.receiverId}`).emit("notification", {
      kind: "new_thread_item",
      title: "Anaïs",
    });
  }

  const balanceUsers = await prisma.user.findMany({
    where: {
      role: "USER",
      walletBalanceCents: { gte: 1000 },
    },
    select: { id: true, updatedAt: true },
    take: 120,
  });

  const stale = balanceUsers.filter(
    (u) => Date.now() - u.updatedAt.getTime() > 3 * 24 * 60 * 60 * 1000
  );

  for (const u of stale) {
    const dup = await prisma.userNotification.findFirst({
      where: {
        userId: u.id,
        kind: "balance_nudge",
        createdAt: { gt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000) },
      },
    });
    if (dup) continue;

    await prisma.userNotification.create({
      data: {
        userId: u.id,
        kind: "balance_nudge",
        title: "Tu saldo sigue disponible",
        body: "Puedes retomar el hilo cuando quieras — entorno discreto.",
      },
    });
    io?.to(`user:${u.id}`).emit("notification", { kind: "balance_nudge" });
  }
}
