import type { Message } from "@prisma/client";
import { DEFAULT_UNLOCK_MESSAGE_CENTS } from "@/lib/pricing";
import { applyPriceMultiplier } from "@/lib/decision-engine";

export function payloadFromMessage(
  m: Message,
  viewerId: string,
  unlocked: Set<string>,
  opts?: { priceMultiplierPercent?: number }
) {
  const mult = opts?.priceMultiplierPercent ?? 100;
  const incoming = m.receiverId === viewerId;
  if (m.isLocked && incoming && !unlocked.has(m.id)) {
    const base = m.unlockPriceCents ?? DEFAULT_UNLOCK_MESSAGE_CENTS;
    return {
      id: m.id,
      senderId: m.senderId,
      receiverId: m.receiverId,
      createdAt: m.createdAt.toISOString(),
      isLocked: true as const,
      previewText: m.previewText ?? "Mensaje reservado.",
      unlockPriceCents: applyPriceMultiplier(base, mult),
      body: null as string | null,
      seenAt: m.seenAt?.toISOString() ?? null,
      priorityBoost: m.priorityBoost,
    };
  }
  return {
    id: m.id,
    senderId: m.senderId,
    receiverId: m.receiverId,
    createdAt: m.createdAt.toISOString(),
    isLocked: false as const,
    previewText: null as string | null,
    unlockPriceCents: null as number | null,
    body: m.body,
    seenAt: m.seenAt?.toISOString() ?? null,
    priorityBoost: m.priorityBoost,
  };
}
