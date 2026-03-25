"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { GlassCard } from "@/components/GlassCard";

export default function LandingPage() {
  return (
    <div className="relative min-h-screen overflow-hidden">
      <div className="pointer-events-none absolute inset-0 bg-gradient-radial from-neon-purple/20 via-transparent to-transparent opacity-40" />
      <div className="pointer-events-none absolute -right-32 top-1/4 h-96 w-96 rounded-full bg-neon-blue/10 blur-3xl" />
      <div className="pointer-events-none absolute -left-24 bottom-1/4 h-80 w-80 rounded-full bg-neon-purple/15 blur-3xl" />

      <header className="relative z-10 mx-auto flex max-w-6xl items-center justify-between px-4 py-6 sm:px-6">
        <span className="font-display text-3xl text-gradient sm:text-4xl">Anaïs</span>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <span className="hidden text-xs text-zinc-500 sm:inline">
            Registro solo con enlace privado
          </span>
          <Link
            href="/login"
            className="rounded-full border border-white/15 px-4 py-2 text-sm text-zinc-300 transition hover:border-white/30 hover:text-white"
          >
            Acceder
          </Link>
        </div>
      </header>

      <main className="relative z-10 mx-auto flex max-w-6xl flex-col gap-12 px-4 pb-24 pt-8 sm:px-6 sm:pt-16">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          className="max-w-2xl space-y-6"
        >
          <p className="text-xs font-medium uppercase tracking-[0.35em] text-neon-blue/90">
            Acceso bajo invitación · monedero discreto
          </p>
          <h1 className="font-display text-4xl leading-tight text-white sm:text-6xl sm:leading-[1.05]">
            Private. Exclusive.{" "}
            <span className="text-gradient">Personalized.</span>
          </h1>
          <p className="max-w-xl text-lg text-zinc-400">
            Motor de monetización suave: conversación en tiempo real, micro-pagos desde monedero y
            gamificación por gasto acumulado. Sin contenido explícito en la superficie — solo
            estructura premium, privacidad y hábitos de uso.
          </p>
          <div className="flex flex-wrap gap-3 pt-2">
            <Link
              href="/login"
              className="inline-flex items-center justify-center rounded-full bg-gradient-to-r from-neon-purple/90 to-neon-blue/80 px-8 py-3 text-base font-medium text-white shadow-neon transition hover:brightness-110 active:scale-[0.98]"
            >
              Entrar al club
            </Link>
            <span className="inline-flex items-center justify-center rounded-full border border-white/10 bg-white/5 px-6 py-3 text-sm text-zinc-400">
              Usa el enlace <code className="text-neon-blue">/i/…</code> que te compartieron
            </span>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, duration: 0.6 }}
          className="grid gap-4 sm:grid-cols-3"
        >
          {[
            {
              t: "Monedero + micro-pagos",
              d: "Recargas de 10–50 €. El chat y los desbloqueos consumen saldo; Stripe solo entra en recargas (extractos neutros).",
            },
            {
              t: "Chat en tiempo real",
              d: "Socket.io: presencia, escritura, visto. Primeros mensajes sin coste; después, fricción mínima por mensaje.",
            },
            {
              t: "VIP por hábito",
              d: "Niveles según gasto acumulado: mejor percepción de prioridad y accesos — sin promesas explícitas.",
            },
          ].map((item, i) => (
            <GlassCard key={item.t} className="animate-slide-up" strong={i === 1}>
              <h3 className="font-display text-xl text-white">{item.t}</h3>
              <p className="mt-2 text-sm leading-relaxed text-zinc-400">{item.d}</p>
            </GlassCard>
          ))}
        </motion.div>
      </main>
    </div>
  );
}
