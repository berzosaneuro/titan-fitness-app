"use client";

import { useSession } from "next-auth/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";
import { GlassCard } from "@/components/GlassCard";
import { NeonButton } from "@/components/NeonButton";
import {
  CHAT_MESSAGE_COST_CENTS,
  FREE_FIRST_MESSAGES,
  PRIORITY_REPLY_CENTS,
  SPECIAL_INTERACTION_CENTS,
} from "@/lib/pricing";

type PublicPricing = {
  freeFirstMessages: number;
  chatMessageCostCents: number;
  priorityReplyCents: number;
  specialInteractionCents: number;
  defaultUnlockMessageCents: number;
};

type WireMessage = {
  id: string;
  senderId: string;
  receiverId: string;
  createdAt: string;
  isLocked: boolean;
  body: string | null;
  previewText?: string | null;
  unlockPriceCents?: number | null;
  seenAt?: string | null;
  priorityBoost?: boolean;
};

function formatEur(cents: number) {
  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: "EUR",
  }).format(cents / 100);
}

export function ChatClient() {
  const { data: session, status, update } = useSession();
  const [messages, setMessages] = useState<WireMessage[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [typingPeer, setTypingPeer] = useState(false);
  const [creatorOnline, setCreatorOnline] = useState(false);
  const [hint, setHint] = useState<string | null>(null);
  const [priorityBoost, setPriorityBoost] = useState(false);
  const [freeLeft, setFreeLeft] = useState<number | null>(null);
  const [priceUi, setPriceUi] = useState<PublicPricing>({
    freeFirstMessages: FREE_FIRST_MESSAGES,
    chatMessageCostCents: CHAT_MESSAGE_COST_CENTS,
    priorityReplyCents: PRIORITY_REPLY_CENTS,
    specialInteractionCents: SPECIAL_INTERACTION_CENTS,
    defaultUnlockMessageCents: 350,
  });
  const socketRef = useRef<Socket | null>(null);
  const bottom = useRef<HTMLDivElement>(null);
  const typingStop = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadRest = useCallback(async () => {
    const r = await fetch("/api/messages");
    if (r.ok) setMessages(await r.json());
    const w = await fetch("/api/wallet");
    if (w.ok) {
      const j = await w.json();
      setFreeLeft(j.freeMessagesLeft ?? priceUi.freeFirstMessages);
    }
  }, [priceUi.freeFirstMessages]);

  useEffect(() => {
    void fetch("/api/pricing/public")
      .then((r) => r.json())
      .then((j: PublicPricing) => {
        if (j && typeof j.freeFirstMessages === "number") setPriceUi(j);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, typingPeer]);

  useEffect(() => {
    if (status !== "authenticated" || session?.user?.role === "ADMIN") return;

    let cancelled = false;
    void loadRest();

    void (async () => {
      const tr = await fetch("/api/socket/token");
      if (!tr.ok || cancelled) return;
      const { token } = await tr.json();
      const origin =
        process.env.NEXT_PUBLIC_SOCKET_URL ||
        (typeof window !== "undefined" ? window.location.origin : "");
      const s = io(origin, {
        path: "/socket.io",
        auth: { token },
        transports: ["websocket", "polling"],
      });
      socketRef.current = s;

      s.on("message:new", (p: { message: WireMessage }) => {
        setMessages((prev) => {
          const exists = prev.some((x) => x.id === p.message.id);
          if (exists) return prev;
          return [...prev, p.message];
        });
      });
      s.on("typing", () => {
        setTypingPeer(true);
        if (typingStop.current) clearTimeout(typingStop.current);
        typingStop.current = setTimeout(() => setTypingPeer(false), 2800);
      });
      s.on("stop_typing", () => setTypingPeer(false));
      s.on("presence:update", (p: { creatorOnline: boolean }) => {
        setCreatorOnline(p.creatorOnline);
      });
      s.on(
        "messages:seen_broadcast",
        (p: { ids: string[] }) => {
          setMessages((prev) =>
            prev.map((m) =>
              p.ids.includes(m.id) ? { ...m, seenAt: new Date().toISOString() } : m
            )
          );
        }
      );
      s.on(
        "wallet:update",
        (p: { walletBalanceCents: number; totalSpentCents: number; freeMessagesLeft: number }) => {
          setFreeLeft(p.freeMessagesLeft);
          void update({
            walletBalanceCents: p.walletBalanceCents,
            totalSpentCents: p.totalSpentCents,
          });
        }
      );
      s.on("loop:hint", (p: { message?: string }) => {
        if (p.message) setHint(p.message);
      });
      s.on("notification", () => {
        window.dispatchEvent(new Event("anais-notify"));
      });
    })();

    return () => {
      cancelled = true;
      socketRef.current?.disconnect();
      socketRef.current = null;
    };
  }, [status, session?.user?.role, loadRest, update]);

  useEffect(() => {
    if (status !== "authenticated" || session?.user?.role === "ADMIN") return;
    const unseen = messages
      .filter((m) => m.receiverId === session.user?.id && !m.seenAt)
      .map((m) => m.id);
    if (unseen.length === 0) return;
    const t = setTimeout(() => {
      socketRef.current?.emit("messages:seen", { ids: unseen });
    }, 400);
    return () => clearTimeout(t);
  }, [messages, session?.user?.id, session?.user?.role, status]);

  function emitTyping() {
    const s = socketRef.current;
    if (!s) return;
    s.emit("typing:start");
    if (typingStop.current) clearTimeout(typingStop.current);
    typingStop.current = setTimeout(() => s.emit("typing:stop"), 2000);
  }

  async function unlockMessage(id: string) {
    const r = await fetch("/api/messages/unlock", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messageId: id }),
    });
    const data = await r.json().catch(() => ({}));
    if (r.ok && data.message) {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === id
            ? {
                ...m,
                isLocked: false,
                body: data.message.body,
                unlockPriceCents: null,
                previewText: null,
              }
            : m
        )
      );
      if (typeof data.walletBalanceCents === "number") {
        void update({ walletBalanceCents: data.walletBalanceCents });
      }
    }
  }

  async function specialInteraction() {
    const r = await fetch("/api/engagement/special", { method: "POST" });
    if (r.ok) {
      const data = await r.json();
      if (typeof data.walletBalanceCents === "number") {
        void update({ walletBalanceCents: data.walletBalanceCents });
      }
      void loadRest();
    }
  }

  function send(e: React.FormEvent) {
    e.preventDefault();
    const s = socketRef.current;
    if (!text.trim() || !s) return;
    setSending(true);
    const clientId = `c_${Date.now()}`;
    s.emit(
      "message:send",
      { body: text.trim(), clientId, priorityBoost },
      (ack: { ok?: boolean; error?: string; needTopUp?: boolean }) => {
        setSending(false);
        if (ack?.ok) {
          setText("");
          s.emit("typing:stop");
        }
        if (ack?.needTopUp) {
          setHint("Saldo insuficiente. Recarga en Perfil para seguir.");
        }
      }
    );
  }

  if (status === "loading") {
    return <p className="text-zinc-500">Cargando…</p>;
  }

  if (session?.user?.role === "ADMIN") {
    return (
      <GlassCard>
        <p className="text-zinc-300">
          Estás en la cuenta Anaïs. Usa el{" "}
          <a href="/admin" className="text-neon-blue hover:underline">
            panel Admin
          </a>{" "}
          para bandeja, invitaciones y mensajes con candado.
        </p>
      </GlassCard>
    );
  }

  const uid = session?.user?.id;
  const balance = session?.user?.walletBalanceCents ?? 0;

  return (
    <div className="flex min-h-[70vh] flex-col gap-4">
      {hint && (
        <div className="rounded-xl border border-neon-purple/30 bg-neon-purple/10 px-4 py-2 text-sm text-zinc-200">
          {hint}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3 text-xs text-zinc-500">
        <span
          className={`rounded-full px-2 py-0.5 ${
            creatorOnline ? "bg-emerald-500/15 text-emerald-300" : "bg-zinc-800 text-zinc-400"
          }`}
        >
          {creatorOnline ? "Anaïs en línea" : "Anaïs fuera de línea"}
        </span>
        <span>Saldo: {formatEur(balance)}</span>
        {freeLeft !== null && (
          <span>
            Mensajes de bienvenida: {freeLeft}/{priceUi.freeFirstMessages}
          </span>
        )}
        <span className="text-zinc-600">
          Después: {formatEur(priceUi.chatMessageCostCents)} / mensaje · Prioridad +
          {formatEur(priceUi.priorityReplyCents)}
        </span>
        {session?.user?.level != null && session.user.level > 1 && (
          <span className="text-zinc-600">
            VIP {session.user.level}: respuestas simuladas más ágiles cuando están activas.
          </span>
        )}
      </div>

      <GlassCard className="flex flex-1 flex-col overflow-hidden p-0" strong>
        <div className="border-b border-white/10 px-4 py-3 sm:px-6">
          <h2 className="font-display text-lg text-white">Mensajes con Anaïs</h2>
          <p className="text-xs text-zinc-500">Tiempo real · lectura · prioridad opcional</p>
        </div>
        <div className="flex flex-1 flex-col gap-3 overflow-y-auto px-4 py-4 sm:px-6">
          {typingPeer && (
            <div className="text-xs italic text-zinc-500">Anaïs está escribiendo…</div>
          )}
          {messages.length === 0 && (
            <p className="text-sm text-zinc-500">
              Primeros mensajes sin coste. Después, el monedero mantiene el ritmo del hilo.
            </p>
          )}
          {messages.map((m) => {
            const mine = m.senderId === uid;
            return (
              <div
                key={m.id}
                className={`max-w-[90%] rounded-2xl px-4 py-2 text-sm sm:max-w-[85%] ${
                  mine
                    ? "ml-auto bg-gradient-to-br from-neon-purple/30 to-neon-blue/20 text-zinc-100"
                    : "mr-auto border border-white/10 bg-white/5 text-zinc-200"
                }`}
              >
                {m.isLocked ? (
                  <div className="space-y-2">
                    <p className="blur-sm select-none">{m.previewText ?? "Reservado"}</p>
                    <p className="text-xs text-zinc-400">
                      Desbloquear · desde{" "}
                      {formatEur(m.unlockPriceCents ?? priceUi.defaultUnlockMessageCents)}
                    </p>
                    <NeonButton
                      type="button"
                      variant="outline"
                      className="py-1.5 text-xs"
                      onClick={() => unlockMessage(m.id)}
                    >
                      Desbloquear
                    </NeonButton>
                  </div>
                ) : (
                  <p className="whitespace-pre-wrap">{m.body}</p>
                )}
                <p className="mt-1 text-[10px] uppercase tracking-wider text-zinc-500">
                  {new Date(m.createdAt).toLocaleString("es", {
                    day: "numeric",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                  {m.seenAt && mine ? " · visto" : ""}
                  {m.priorityBoost ? " · prioridad" : ""}
                </p>
              </div>
            );
          })}
          <div ref={bottom} />
        </div>
        <div className="border-t border-white/10 bg-black/20 px-3 py-2 sm:px-4">
          <div className="flex flex-wrap gap-3 text-xs text-zinc-500">
            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                checked={priorityBoost}
                onChange={(e) => setPriorityBoost(e.target.checked)}
              />
              Prioridad (+{formatEur(priceUi.priorityReplyCents)})
            </label>
            <NeonButton
              type="button"
              variant="ghost"
              className="py-1.5 text-xs"
              onClick={() => void specialInteraction()}
            >
              Gestión prioritaria ({formatEur(priceUi.specialInteractionCents)})
            </NeonButton>
          </div>
        </div>
        <form
          onSubmit={send}
          className="flex gap-2 border-t border-white/10 bg-black/20 p-3 sm:p-4"
        >
          <input
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              emitTyping();
            }}
            placeholder="Escribe con intención…"
            className="min-w-0 flex-1 rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white outline-none focus:border-neon-purple/40"
            maxLength={4000}
          />
          <NeonButton type="submit" disabled={sending} className="shrink-0 px-5">
            Enviar
          </NeonButton>
        </form>
      </GlassCard>
    </div>
  );
}
