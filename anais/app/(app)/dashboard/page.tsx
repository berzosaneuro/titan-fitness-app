import Link from "next/link";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { GlassCard } from "@/components/GlassCard";
import { FirstSessionBootstrap } from "@/components/FirstSessionBootstrap";
import { FirstSessionPaywall } from "@/components/FirstSessionPaywall";
import { progressToNextLevel } from "@/lib/pricing";
import { getEffectivePricing } from "@/lib/effective-pricing";

function formatEur(cents: number) {
  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: "EUR",
  }).format(cents / 100);
}

export default async function DashboardPage() {
  const session = await getSession();
  if (!session?.user?.id) return null;

  const pricing = await getEffectivePricing();
  const u = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      walletBalanceCents: true,
      totalSpentCents: true,
      chatEntitlement: { select: { freeMessagesLeft: true } },
    },
  });

  const nextAppt = await prisma.appointment.findFirst({
    where: {
      userId: session.user.id,
      status: { in: ["CONFIRMED", "PENDING"] },
      startAt: { gte: new Date() },
    },
    orderBy: { startAt: "asc" },
  });

  const gam = progressToNextLevel(
    u?.totalSpentCents ?? 0,
    pricing.levelThresholdsCents
  );
  const pct = Math.round(gam.progress01 * 100);
  const nextIncentive =
    gam.nextAt != null
      ? `Siguiente nivel a ${formatEur(gam.nextAt)} de gasto acumulado · mejor prioridad percibida y accesos.`
      : "Nivel máximo de estatus en la experiencia actual.";

  return (
    <div className="space-y-8">
      <FirstSessionBootstrap />
      <FirstSessionPaywall />
      <div>
        <h1 className="font-display text-3xl text-white sm:text-4xl">
          Hola{session.user.name ? `, ${session.user.name}` : ""}
        </h1>
        <p className="mt-2 text-zinc-400">
          Bucle privado: conversación → valor percibido → micro-pagos → recompensa. Discreto por
          diseño.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <GlassCard strong>
          <p className="text-xs font-medium uppercase tracking-widest text-neon-purple/90">
            Monedero
          </p>
          <p className="mt-2 text-2xl text-white">
            {formatEur(u?.walletBalanceCents ?? 0)}
          </p>
          <p className="mt-1 text-sm text-zinc-500">
            Mensajes de cortesía:{" "}
            {u?.chatEntitlement?.freeMessagesLeft ?? "—"} restantes
          </p>
          <Link
            href="/profile"
            className="mt-4 inline-flex rounded-full bg-gradient-to-r from-neon-purple/90 to-neon-blue/80 px-5 py-2.5 text-sm font-medium text-white shadow-neon transition hover:brightness-110"
          >
            Recargar saldo
          </Link>
        </GlassCard>
        <GlassCard>
          <p className="text-xs font-medium uppercase tracking-widest text-neon-blue/90">
            Progreso VIP
          </p>
          <p className="mt-2 text-lg text-white">
            Nivel {gam.level}
            {gam.nextAt != null && (
              <span className="text-zinc-500">
                {" "}
                · siguiente umbral {formatEur(gam.nextAt)}
              </span>
            )}
          </p>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-zinc-800">
            <div
              className="h-full rounded-full bg-gradient-to-r from-neon-purple to-neon-blue transition-all"
              style={{ width: `${pct}%` }}
            />
          </div>
          <p className="mt-2 text-xs text-zinc-400">
            Estás al <span className="text-zinc-200">{pct}%</span> del siguiente nivel VIP.
          </p>
          <p className="mt-1 text-xs text-zinc-500">{nextIncentive}</p>
        </GlassCard>
      </div>

      <GlassCard>
        <p className="text-xs font-medium uppercase tracking-widest text-zinc-500">
          Objetivo de LTV
        </p>
        <p className="mt-2 text-sm text-zinc-300">
          El sistema está calibrado para micro-gastos repetidos (chat, desbloqueos, prioridad). La
          barra VIP refuerza hábito y gasto acumulado sin promesas explícitas.
        </p>
      </GlassCard>

      <GlassCard>
        <p className="text-xs font-medium uppercase tracking-widest text-zinc-500">
          Próxima cita
        </p>
        {nextAppt ? (
          <p className="mt-2 text-lg text-white">
            {nextAppt.startAt.toLocaleString("es", {
              weekday: "long",
              day: "numeric",
              month: "short",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </p>
        ) : (
          <p className="mt-2 text-zinc-400">No hay citas programadas.</p>
        )}
        <Link
          href="/appointments"
          className="mt-4 inline-flex rounded-full border border-neon-purple/50 px-5 py-2.5 text-sm font-medium text-neon-purple transition hover:bg-neon-purple/10"
        >
          Reservar
        </Link>
      </GlassCard>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { href: "/chat", label: "Chat (motor)" },
          { href: "/content", label: "Contenido" },
          { href: "/profile", label: "Monedero" },
          { href: "/appointments", label: "Citas" },
        ].map((x) => (
          <Link
            key={x.href}
            href={x.href}
            className="glass rounded-2xl px-4 py-4 text-center text-sm font-medium text-zinc-200 transition hover:border-neon-purple/30 hover:text-white"
          >
            {x.label}
          </Link>
        ))}
      </div>
    </div>
  );
}
