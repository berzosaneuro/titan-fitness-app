"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { motion } from "framer-motion";
import type { ReactNode } from "react";
import { NotificationBell } from "@/components/NotificationBell";
import { SecurityChrome } from "@/components/SecurityChrome";
import { useDiscreetMode } from "@/components/DiscreetModeProvider";

const links = [
  { href: "/dashboard", label: "Inicio" },
  { href: "/appointments", label: "Citas" },
  { href: "/content", label: "Contenido" },
  { href: "/chat", label: "Mensajes" },
  { href: "/profile", label: "Perfil" },
];

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { data } = useSession();
  const { discreet } = useDiscreetMode();
  const isAdmin = data?.user?.role === "ADMIN";

  return (
    <div className="min-h-screen pb-24 sm:pb-8">
      <header className="sticky top-0 z-40 border-b border-white/5 bg-[#0A0A0A]/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <Link href="/dashboard" className="font-display text-2xl tracking-tight text-gradient">
            {discreet ? "Área privada" : "Anaïs"}
          </Link>
          <div className="hidden items-center gap-3 sm:flex">
            {!isAdmin && (
              <>
                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-zinc-300">
                  {new Intl.NumberFormat("es-ES", {
                    style: "currency",
                    currency: "EUR",
                  }).format((data?.user?.walletBalanceCents ?? 0) / 100)}
                </span>
                <SecurityChrome />
                <NotificationBell />
              </>
            )}
            <nav className="flex items-center gap-1">
            {links.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className={`rounded-full px-3 py-1.5 text-sm transition-colors ${
                  pathname === l.href
                    ? "bg-white/10 text-white"
                    : "text-zinc-400 hover:text-white"
                }`}
              >
                {l.label}
              </Link>
            ))}
            {isAdmin && (
              <Link
                href="/admin"
                className={`rounded-full px-3 py-1.5 text-sm transition-colors ${
                  pathname.startsWith("/admin")
                    ? "bg-neon-purple/20 text-neon-purple"
                    : "text-zinc-400 hover:text-neon-purple"
                }`}
              >
                Admin
              </Link>
            )}
            <button
              type="button"
              onClick={() => signOut({ callbackUrl: "/" })}
              className="ml-2 rounded-full border border-white/10 px-3 py-1.5 text-sm text-zinc-400 hover:border-white/20 hover:text-white"
            >
              Salir
            </button>
            </nav>
          </div>
        </div>
      </header>

      <motion.main
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-10"
      >
        {children}
      </motion.main>

      <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-white/10 bg-[#0A0A0A]/90 backdrop-blur-xl sm:hidden">
        <div className="flex justify-around px-1 py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
          {links.map((l) => {
            const active = pathname === l.href;
            return (
              <Link
                key={l.href}
                href={l.href}
                className={`flex min-w-[4rem] flex-col items-center gap-0.5 rounded-xl px-2 py-1 text-[10px] font-medium ${
                  active ? "text-neon-blue" : "text-zinc-500"
                }`}
              >
                <span
                  className={`h-1 w-8 rounded-full ${active ? "bg-neon-blue" : "bg-transparent"}`}
                />
                {l.label}
              </Link>
            );
          })}
          {isAdmin && (
            <Link
              href="/admin"
              className={`flex min-w-[4rem] flex-col items-center gap-0.5 rounded-xl px-2 py-1 text-[10px] font-medium ${
                pathname.startsWith("/admin") ? "text-neon-purple" : "text-zinc-500"
              }`}
            >
              <span
                className={`h-1 w-8 rounded-full ${
                  pathname.startsWith("/admin") ? "bg-neon-purple" : "bg-transparent"
                }`}
              />
              Admin
            </Link>
          )}
        </div>
      </nav>
    </div>
  );
}
