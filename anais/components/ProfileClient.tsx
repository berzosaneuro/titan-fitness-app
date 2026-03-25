"use client";

import { signOut, useSession } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { GlassCard } from "@/components/GlassCard";
import { NeonButton } from "@/components/NeonButton";

function formatEur(cents: number) {
  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: "EUR",
  }).format(cents / 100);
}

type PublicPricing = {
  topupTiers: { eur: number; bonusPercent: number }[];
  recommendedTopupEur?: number;
};

function ProfileInner() {
  const { data: session, update } = useSession();
  const searchParams = useSearchParams();
  const [checkoutLoading, setCheckoutLoading] = useState<number | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [pricing, setPricing] = useState<PublicPricing | null>(null);
  const [referral, setReferral] = useState<{
    link: string;
    invitedCount: number;
  } | null>(null);

  useEffect(() => {
    void fetch("/api/pricing/public")
      .then((r) => r.json())
      .then((j) => setPricing(j))
      .catch(() => setPricing(null));
  }, []);

  useEffect(() => {
    if (session?.user?.role === "ADMIN") return;
    void fetch("/api/account/referral")
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (j?.link) setReferral({ link: j.link, invitedCount: j.invitedCount ?? 0 });
      })
      .catch(() => {});
  }, [session?.user?.role]);

  useEffect(() => {
    const w = searchParams.get("wallet");
    if (w === "ok") {
      setNote("Recarga procesada. Sincronizando saldo…");
      void update().then(() => setNote("Saldo actualizado."));
    }
    if (w === "cancel") setNote("Recarga cancelada.");
  }, [searchParams, update]);

  async function topup(eur: number) {
    setCheckoutLoading(eur);
    setNote(null);
    const r = await fetch("/api/wallet/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ eur }),
    });
    const data = await r.json().catch(() => ({}));
    setCheckoutLoading(null);
    if (data.url) {
      window.location.href = data.url as string;
      return;
    }
    setNote(data.error ?? "No se pudo iniciar el pago. Configura Stripe.");
  }

  const balance = session?.user?.walletBalanceCents ?? 0;
  const spent = session?.user?.totalSpentCents ?? 0;
  const level = session?.user?.level ?? 1;

  const tiers = pricing?.topupTiers ?? [
    { eur: 10, bonusPercent: 0 },
    { eur: 25, bonusPercent: 0 },
    { eur: 50, bonusPercent: 8 },
  ];
  const recommended = pricing?.recommendedTopupEur ?? 25;

  return (
    <div className="space-y-6">
      {note && (
        <p className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-zinc-300">
          {note}
        </p>
      )}

      <GlassCard strong>
        <h2 className="font-display text-xl text-white">Monedero discreto</h2>
        <p className="mt-1 text-sm text-zinc-400">
          Recarga obligatoria antes de interactuar. Bonos en saldo (no en cargo Stripe) para
          incentivar tickets más altos.
        </p>
        <dl className="mt-6 space-y-2 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-zinc-500">Correo</dt>
            <dd className="text-right text-zinc-200">{session?.user?.email}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-zinc-500">Saldo</dt>
            <dd className="text-right text-neon-blue">{formatEur(balance)}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-zinc-500">Gasto acumulado (LTV)</dt>
            <dd className="text-right text-zinc-300">{formatEur(spent)}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-zinc-500">Nivel</dt>
            <dd className="text-right text-neon-purple">VIP {level}</dd>
          </div>
        </dl>

        <p className="mt-6 text-xs font-medium uppercase tracking-widest text-zinc-500">
          Recargas sugeridas
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {tiers.map((t) => {
            const isRec = t.eur === recommended;
            return (
              <NeonButton
                key={t.eur}
                type="button"
                variant={isRec ? "primary" : "outline"}
                disabled={checkoutLoading !== null}
                className={`text-sm ${isRec ? "ring-2 ring-neon-purple/80 ring-offset-2 ring-offset-[#0A0A0A]" : ""}`}
                onClick={() => topup(t.eur)}
              >
                {checkoutLoading === t.eur ? "…" : `${t.eur} €`}
                {t.bonusPercent > 0 ? ` +${t.bonusPercent}%` : ""}
                {isRec ? " · sugerido" : ""}
              </NeonButton>
            );
          })}
        </div>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <NeonButton
            variant="outline"
            className="text-xs"
            type="button"
            onClick={() => void update()}
          >
            Actualizar sesión
          </NeonButton>
          <NeonButton
            variant="ghost"
            type="button"
            onClick={() => signOut({ callbackUrl: "/" })}
            className="border-red-500/20 text-red-300"
          >
            Cerrar sesión
          </NeonButton>
        </div>
      </GlassCard>

      {session?.user?.role !== "ADMIN" && referral && (
        <GlassCard>
          <h3 className="font-display text-lg text-white">Crecimiento controlado</h3>
          <p className="mt-1 text-sm text-zinc-400">
            Comparte tu enlace privado. Cuando alguien que invitaste haga su primera recarga, recibes
            crédito extra en monedero (configurable en admin).
          </p>
          <p className="mt-3 break-all rounded-xl border border-white/10 bg-black/30 p-3 text-sm text-neon-blue">
            {referral.link}
          </p>
          <p className="mt-2 text-xs text-zinc-500">
            Referidos confirmados (cuenta creada): {referral.invitedCount}
          </p>
        </GlassCard>
      )}
    </div>
  );
}

export function ProfileClient() {
  return (
    <Suspense fallback={<p className="text-sm text-zinc-500">Cargando…</p>}>
      <ProfileInner />
    </Suspense>
  );
}
