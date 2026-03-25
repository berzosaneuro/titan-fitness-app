import type { Server as HttpServer } from "http";
import { Server, type Socket } from "socket.io";
import { prisma } from "@/lib/prisma";
import { getCreatorUserId } from "@/lib/creator";
import { verifySocketToken } from "@/lib/socket-token";
import { payloadFromMessage } from "@/lib/message-wire";
import { convRoom } from "@/lib/conv";
import { debitWallet, InsufficientFundsError } from "@/lib/wallet";
import { getEffectivePricing } from "@/lib/effective-pricing";
import { logAnalyticsEvent } from "@/lib/analytics";
import { levelFromTotalSpent } from "@/lib/pricing";
import { applyPriceMultiplier, getUserMonetizationProfile } from "@/lib/decision-engine";
import { syncUserProgressMeta } from "@/lib/user-progress-sync";

function simulatedCreatorDelayMs(opts: { level: number; memberUsedPriority: boolean }) {
  const min = Number(process.env.SIMULATED_REPLY_MS_MIN ?? 2000);
  const max = Number(process.env.SIMULATED_REPLY_MS_MAX ?? 5500);
  const span = Math.max(400, max - min);
  let scale = Math.max(0.32, 1 - (opts.level - 1) * 0.11);
  if (opts.memberUsedPriority) scale *= 0.7;
  const base = min + Math.floor(Math.random() * span);
  return Math.max(800, Math.round(base * scale));
}

const online = new Map<string, Set<string>>();
const typingTimers = new Map<string, ReturnType<typeof setTimeout>>();

function markOnline(userId: string, socketId: string) {
  if (!online.has(userId)) online.set(userId, new Set());
  online.get(userId)!.add(socketId);
}

function markOffline(userId: string, socketId: string) {
  const s = online.get(userId);
  if (!s) return;
  s.delete(socketId);
  if (s.size === 0) online.delete(userId);
}

function isUserOnline(userId: string) {
  return (online.get(userId)?.size ?? 0) > 0;
}

function emitPresence(io: Server, room: string, creatorId: string) {
  io.to(room).emit("presence:update", {
    creatorOnline: isUserOnline(creatorId),
  });
}

export function attachSocket(io: Server, _httpServer: HttpServer) {
  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth?.token as string | undefined;
      if (!token) return next(new Error("auth"));
      const { sub, role } = verifySocketToken(token);
      socket.data.userId = sub;
      socket.data.role = role;
      return next();
    } catch {
      return next(new Error("auth"));
    }
  });

  io.on("connection", (socket: Socket) => {
    const userId = socket.data.userId as string;
    const role = socket.data.role as string;
    markOnline(userId, socket.id);

    void (async () => {
      const creatorId = await getCreatorUserId();
      if (!creatorId) return;
      const room = convRoom(userId, creatorId);
      await socket.join(room);
      await socket.join(`user:${userId}`);
      emitPresence(io, room, creatorId);

      if (userId !== creatorId) {
        const last = await prisma.message.findFirst({
          where: {
            OR: [
              { senderId: userId, receiverId: creatorId },
              { senderId: creatorId, receiverId: userId },
            ],
          },
          orderBy: { createdAt: "desc" },
        });
        const idleMs = Number(process.env.REENGAGE_AFTER_MS ?? 300_000);
        if (last && Date.now() - last.createdAt.getTime() > idleMs) {
          socket.emit("loop:hint", {
            kind: "reengage",
            message:
              "Tu conversación está en pausa. Un saldo discreto mantiene prioridad en el hilo.",
          });
        }
      }
    })();

    socket.on("disconnect", () => {
      markOffline(userId, socket.id);
      void (async () => {
        const creatorId = await getCreatorUserId();
        if (!creatorId) return;
        const room = convRoom(userId, creatorId);
        emitPresence(io, room, creatorId);
      })();
    });

    socket.on("typing:start", async () => {
      const creatorId = await getCreatorUserId();
      if (!creatorId) return;
      const room = convRoom(userId, creatorId);
      socket.to(room).emit("typing", { userId });
    });

    socket.on("typing:stop", async () => {
      const creatorId = await getCreatorUserId();
      if (!creatorId) return;
      const room = convRoom(userId, creatorId);
      socket.to(room).emit("stop_typing", { userId });
    });

    socket.on(
      "messages:seen",
      async (payload: { ids: string[] }, ack?: (r: unknown) => void) => {
        try {
          if (!Array.isArray(payload?.ids) || payload.ids.length === 0) return ack?.({ ok: true });
          await prisma.message.updateMany({
            where: {
              id: { in: payload.ids },
              receiverId: userId,
              seenAt: null,
            },
            data: { read: true, seenAt: new Date() },
          });
          const creatorId = await getCreatorUserId();
          if (creatorId) {
            const room = convRoom(userId, creatorId);
            io.to(room).emit("messages:seen_broadcast", { ids: payload.ids, viewerId: userId });
          }
          ack?.({ ok: true });
        } catch {
          ack?.({ ok: false });
        }
      }
    );

    socket.on(
      "message:send",
      async (
        raw: { body?: string; clientId?: string; priorityBoost?: boolean },
        ack?: (r: unknown) => void
      ) => {
        const body = typeof raw?.body === "string" ? raw.body.trim() : "";
        if (!body || body.length > 4000) {
          ack?.({ ok: false, error: "invalid" });
          return;
        }

        const creatorId = await getCreatorUserId();
        if (!creatorId) {
          ack?.({ ok: false, error: "creator" });
          return;
        }

        const priorityBoost = Boolean(raw?.priorityBoost);

        try {
          const pricing = await getEffectivePricing();
          const priorityExtra = priorityBoost ? pricing.priorityReplyCents : 0;
          const memberProfile = await getUserMonetizationProfile(userId);
          const freeAllowance =
            pricing.freeFirstMessages + (memberProfile.bonusFreeMessages ?? 0);

          if (userId === creatorId || role === "ADMIN") {
            const lastPeer = await prisma.message.findFirst({
              where: {
                OR: [{ senderId: creatorId }, { receiverId: creatorId }],
              },
              orderBy: { createdAt: "desc" },
            });
            let peerId = lastPeer
              ? lastPeer.senderId === creatorId
                ? lastPeer.receiverId
                : lastPeer.senderId
              : null;
            if (!peerId || peerId === creatorId) {
              const u = await prisma.user.findFirst({
                where: { role: "USER" },
                orderBy: { createdAt: "desc" },
              });
              peerId = u?.id ?? null;
            }
            if (!peerId || peerId === creatorId) {
              ack?.({ ok: false, error: "peer" });
              return;
            }
            const m = await prisma.message.create({
              data: {
                senderId: creatorId,
                receiverId: peerId,
                body,
                priorityBoost,
              },
            });
            const room = convRoom(peerId, creatorId);
            const peerProf = await getUserMonetizationProfile(peerId);
            const wire = payloadFromMessage(m, peerId, new Set(), {
              priceMultiplierPercent: peerProf.priceMultiplierPercent,
            });
            io.to(room).emit("message:new", { message: wire, clientId: raw?.clientId });
            ack?.({ ok: true, message: wire });
            return;
          }

          let cost = 0;
          let spendTag: "priority_reply" | "chat_message_paid" | "chat_message_priority" | "" =
            "";
          let freeJustExhausted = false;
          const result = await prisma.$transaction(async (tx) => {
            let ent = await tx.chatEntitlement.findUnique({ where: { userId } });
            if (!ent) {
              ent = await tx.chatEntitlement.create({
                data: { userId, freeMessagesLeft: freeAllowance },
              });
            }
            if (ent.freeMessagesLeft > 0) {
              if (ent.freeMessagesLeft === 1) freeJustExhausted = true;
              await tx.chatEntitlement.update({
                where: { userId },
                data: {
                  freeMessagesLeft: ent.freeMessagesLeft - 1,
                  lastMemberMessageAt: new Date(),
                },
              });
              if (priorityExtra > 0) {
                const p = applyPriceMultiplier(
                  priorityExtra,
                  memberProfile.priceMultiplierPercent
                );
                await debitWallet(userId, p, "priority_reply", tx);
                cost = p;
                spendTag = "priority_reply";
              }
            } else {
              cost = applyPriceMultiplier(
                pricing.chatMessageCostCents + priorityExtra,
                memberProfile.priceMultiplierPercent
              );
              const reason =
                priorityExtra > 0 ? "chat_message_priority" : "chat_message_paid";
              await debitWallet(userId, cost, reason, tx);
              spendTag = reason;
              await tx.chatEntitlement.update({
                where: { userId },
                data: { lastMemberMessageAt: new Date() },
              });
            }
            return tx.message.create({
              data: {
                senderId: userId,
                receiverId: creatorId,
                body,
                priorityBoost,
              },
            });
          });

          void syncUserProgressMeta(userId);

          const wallet = await prisma.user.findUnique({
            where: { id: userId },
            select: { walletBalanceCents: true, totalSpentCents: true },
          });

          if (freeJustExhausted) {
            await logAnalyticsEvent({
              userId,
              type: "funnel_free_exhausted",
              revenueCents: 0,
            });
          }

          if (cost > 0 && spendTag) {
            const priorSpend = await prisma.analyticsEvent.count({
              where: {
                userId,
                type: { in: ["debit_chat", "debit_priority"] },
              },
            });
            if (priorSpend === 0) {
              await logAnalyticsEvent({
                userId,
                type: "funnel_first_spend",
                revenueCents: cost,
                meta: { tag: spendTag },
              });
            }
            const ev =
              spendTag === "priority_reply" || spendTag === "chat_message_priority"
                ? "debit_priority"
                : "debit_chat";
            await logAnalyticsEvent({
              userId,
              type: ev,
              revenueCents: cost,
              meta: { tag: spendTag },
            });
          }

          const room = convRoom(userId, creatorId);
          const unlockRows = await prisma.messageUnlock.findMany({
            where: { userId },
            select: { messageId: true },
          });
          const unlocked = new Set(unlockRows.map((x) => x.messageId));
          const wire = payloadFromMessage(result, userId, unlocked, {
            priceMultiplierPercent: memberProfile.priceMultiplierPercent,
          });
          io.to(room).emit("message:new", { message: wire, clientId: raw?.clientId });
          socket.emit("wallet:update", {
            walletBalanceCents: wallet?.walletBalanceCents ?? 0,
            totalSpentCents: wallet?.totalSpentCents ?? 0,
            costCents: cost,
            freeMessagesLeft:
              (
                await prisma.chatEntitlement.findUnique({
                  where: { userId },
                  select: { freeMessagesLeft: true },
                })
              )?.freeMessagesLeft ?? freeAllowance,
          });
          ack?.({ ok: true, message: wire, costCents: cost });

          if (process.env.SIMULATED_CREATOR_REPLIES === "true") {
            const memberLevel = levelFromTotalSpent(
              wallet?.totalSpentCents ?? 0,
              pricing.levelThresholdsCents
            );
            const delay = simulatedCreatorDelayMs({
              level: memberLevel,
              memberUsedPriority: priorityBoost,
            });
            io.to(room).emit("typing", { userId: creatorId });
            const tKey = `${room}:sim`;
            clearTimeout(typingTimers.get(tKey));
            const simPricing = pricing;
            typingTimers.set(
              tKey,
              setTimeout(async () => {
                io.to(room).emit("stop_typing", { userId: creatorId });
                const reply = await prisma.message.create({
                  data: {
                    senderId: creatorId,
                    receiverId: userId,
                    body: "Gracias por tu mensaje. Lo reviso con calma; el canal permanece reservado para ti.",
                    isLocked: Math.random() > 0.65,
                    previewText: "Hay una nota reservada…",
                    unlockPriceCents: simPricing.defaultUnlockMessageCents,
                  },
                });
                const u2 = new Set(
                  (
                    await prisma.messageUnlock.findMany({
                      where: { userId },
                      select: { messageId: true },
                    })
                  ).map((x) => x.messageId)
                );
                const simProf = await getUserMonetizationProfile(userId);
                const w2 = payloadFromMessage(reply, userId, u2, {
                  priceMultiplierPercent: simProf.priceMultiplierPercent,
                });
                io.to(room).emit("message:new", { message: w2 });
                typingTimers.delete(tKey);
              }, delay)
            );
          }
        } catch (e) {
          if (e instanceof InsufficientFundsError) {
            void logAnalyticsEvent({
              userId,
              type: "funnel_insufficient_funds",
              revenueCents: 0,
              meta: { context: "message_send" },
            });
            ack?.({ ok: false, error: "funds", needTopUp: true });
            socket.emit("loop:hint", {
              kind: "topup",
              message: "Saldo insuficiente. Recarga para continuar el hilo.",
            });
            return;
          }
          console.error(e);
          ack?.({ ok: false, error: "server" });
        }
      }
    );
  });
}
