"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { GlassCard } from "@/components/GlassCard";
import { NeonButton } from "@/components/NeonButton";

/**
 * Fase 1 del viaje: empuja primera recarga (10–25 €) en 1–2 clics.
 * Se oculta tras la primera TOPUP (journeyPhase ≥ 2) o saldo ≥ 10 €.
 */
export function FirstSessionPaywall() {
  const { data } = useSession();
  if (!data?.user?.id || data.user.role === "ADMIN") return null;

  const phase = data.user.journeyPhase ?? 1;
  const bal = data.user.walletBalanceCents ?? 0;
  if (phase !== 1 || bal >= 1000) return null;

  return (
    <GlassCard strong className="border-amber-500/25 bg-amber-500/[0.06]">
      <p className="text-xs font-medium uppercase tracking-widest text-amber-200/90">
        Primer paso · menos de 1 minuto
      </p>
      <p className="mt-2 text-sm text-zinc-200">
        Activa el monedero con una recarga pequeña (desde 10 €) para desbloquear el candado del chat y
        las piezas en vídeo. Extractos neutros en banco.
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <Link href="/profile">
          <NeonButton type="button" variant="primary" className="text-sm">
            Recargar saldo
          </NeonButton>
        </Link>
        <Link href="/content">
          <NeonButton type="button" variant="outline" className="text-sm">
            Ver vista previa
          </NeonButton>
        </Link>
        <Link href="/chat">
          <NeonButton type="button" variant="ghost" className="text-sm">
            Abrir mensajes
          </NeonButton>
        </Link>
      </div>
    </GlassCard>
  );
}
