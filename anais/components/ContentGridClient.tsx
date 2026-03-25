"use client";

import { useSession } from "next-auth/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { GlassCard } from "@/components/GlassCard";
import { NeonButton } from "@/components/NeonButton";
import { useDiscreetMode } from "@/components/DiscreetModeProvider";

export type GridItem = {
  id: string;
  title: string;
  description: string | null;
  previewUrl: string | null;
  fullUrl: string | null;
  isPremium: boolean;
  unlockPriceCents: number;
  locked: boolean;
  mediaKind: "STANDARD" | "VIDEO";
  videoTeaserUrl: string | null;
  videoFullUrl: string | null;
  videoPosterUrl: string | null;
  teaserSeconds: number;
  videoTier: "TEASER" | "LOCKED" | "PREMIUM" | null;
};

function formatEur(cents: number) {
  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: "EUR",
  }).format(cents / 100);
}

function VideoLockedCard({
  c,
  busy,
  onUnlock,
  discreet,
}: {
  c: GridItem;
  busy: boolean;
  onUnlock: (id: string) => void;
  discreet: boolean;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  const [cut, setCut] = useState(false);

  const teaserSrc = c.videoTeaserUrl || c.previewUrl || "";
  const maxT = Math.max(3, Math.min(15, c.teaserSeconds || 8));

  const onTimeUpdate = useCallback(() => {
    const v = ref.current;
    if (!v || cut) return;
    if (v.currentTime >= maxT) {
      v.pause();
      setCut(true);
    }
  }, [cut, maxT]);

  useEffect(() => {
    if (!teaserSrc) setCut(true);
  }, [teaserSrc]);

  return (
    <GlassCard className={`relative overflow-hidden ${c.locked ? "opacity-95" : ""}`}>
      <div
        className={`relative aspect-video w-full overflow-hidden rounded-xl bg-black ${
          discreet && c.locked ? "blur-md" : ""
        }`}
      >
        {teaserSrc ? (
          <video
            ref={ref}
            src={teaserSrc}
            poster={c.videoPosterUrl ?? undefined}
            className="h-full w-full object-cover"
            muted
            playsInline
            autoPlay
            onTimeUpdate={onTimeUpdate}
          />
        ) : (
          <div className="flex h-full items-center justify-center text-zinc-500">Vista previa</div>
        )}
        {(cut || !teaserSrc) && c.locked && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/70 px-4 backdrop-blur-md">
            <p className="text-center text-xs font-medium uppercase tracking-widest text-zinc-300">
              {c.videoTier === "PREMIUM"
                ? "Acceso completo"
                : c.videoTier === "TEASER"
                  ? "Vista previa"
                  : "Continuar viendo"}{" "}
              — {formatEur(c.unlockPriceCents)}
            </p>
            <NeonButton
              type="button"
              variant="primary"
              className="text-xs"
              disabled={busy}
              onClick={() => onUnlock(c.id)}
            >
              {busy ? "…" : "Desbloquear acceso"}
            </NeonButton>
          </div>
        )}
      </div>
      <h2 className="mt-4 font-display text-xl text-white">{c.title}</h2>
      {c.description && (
        <p className="mt-1 text-sm text-zinc-400 line-clamp-2">{c.description}</p>
      )}
    </GlassCard>
  );
}

function VideoOpenCard({ c, discreet }: { c: GridItem; discreet: boolean }) {
  const src = c.videoFullUrl || c.fullUrl || c.videoTeaserUrl || "";
  return (
    <GlassCard>
      <div className={`relative aspect-video overflow-hidden rounded-xl bg-black ${discreet ? "blur-sm" : ""}`}>
        {src ? (
          <video
            src={src}
            controls
            playsInline
            className="h-full w-full object-cover"
            poster={c.videoPosterUrl ?? undefined}
          />
        ) : null}
      </div>
      <h2 className="mt-4 font-display text-xl text-white">{c.title}</h2>
    </GlassCard>
  );
}

export function ContentGridClient({ items }: { items: GridItem[] }) {
  const { update } = useSession();
  const { discreet } = useDiscreetMode();
  const [local, setLocal] = useState(items);
  const [busy, setBusy] = useState<string | null>(null);

  async function unlock(id: string) {
    setBusy(id);
    const r = await fetch("/api/content/unlock", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contentId: id }),
    });
    const data = await r.json().catch(() => ({}));
    setBusy(null);
    if (r.ok) {
      setLocal((prev) =>
        prev.map((c) =>
          c.id === id
            ? {
                ...c,
                locked: false,
                fullUrl: data.fullUrl ?? c.fullUrl,
                videoFullUrl: c.videoFullUrl ?? c.fullUrl,
              }
            : c
        )
      );
      if (typeof data.walletBalanceCents === "number") {
        void update({ walletBalanceCents: data.walletBalanceCents });
      }
    }
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {local.map((c) => {
        if (c.mediaKind === "VIDEO") {
          if (c.locked) {
            return (
              <VideoLockedCard
                key={c.id}
                c={c}
                busy={busy === c.id}
                onUnlock={unlock}
                discreet={discreet}
              />
            );
          }
          return <VideoOpenCard key={c.id} c={c} discreet={discreet} />;
        }

        return (
          <GlassCard
            key={c.id}
            className={`relative overflow-hidden ${c.locked ? "opacity-95" : ""}`}
          >
            <div
              className={`relative aspect-[4/5] w-full overflow-hidden rounded-xl bg-gradient-to-br from-zinc-800 via-zinc-900 to-black ${
                c.locked ? "blur-md" : ""
              } ${discreet && c.locked ? "blur-xl" : ""}`}
            >
              {c.previewUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={c.previewUrl}
                  alt=""
                  className="h-full w-full object-cover opacity-80"
                />
              ) : (
                <div className="flex h-full items-center justify-center p-6 text-center font-display text-lg text-zinc-500">
                  Vista reservada
                </div>
              )}
              {c.locked && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/50 px-4 backdrop-blur-sm">
                  <span className="rounded-full border border-white/20 px-4 py-2 text-center text-xs font-medium uppercase tracking-widest text-white">
                    Desde {formatEur(c.unlockPriceCents)}
                  </span>
                  <NeonButton
                    type="button"
                    variant="primary"
                    className="text-xs"
                    disabled={busy === c.id}
                    onClick={() => unlock(c.id)}
                  >
                    {busy === c.id ? "…" : "Desbloquear"}
                  </NeonButton>
                </div>
              )}
            </div>
            <h2 className="mt-4 font-display text-xl text-white">{c.title}</h2>
            {c.description && (
              <p className="mt-1 text-sm text-zinc-400 line-clamp-3">{c.description}</p>
            )}
            {!c.locked && c.fullUrl && (
              <a
                href={c.fullUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 inline-block text-sm text-neon-blue hover:underline"
              >
                Abrir pieza
              </a>
            )}
          </GlassCard>
        );
      })}
    </div>
  );
}
