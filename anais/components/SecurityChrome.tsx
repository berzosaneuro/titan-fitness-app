"use client";

import { signOut, useSession } from "next-auth/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useDiscreetMode } from "@/components/DiscreetModeProvider";

const IDLE_MS = Number(process.env.NEXT_PUBLIC_IDLE_LOGOUT_MS ?? 25 * 60 * 1000);

/** Cierre por inactividad + botón ocultar rápido + modo discreto. */
export function SecurityChrome() {
  const { data } = useSession();
  const { discreet, toggleDiscreet } = useDiscreetMode();
  const idleRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [panic, setPanic] = useState(false);

  const resetIdle = useCallback(() => {
    if (!data?.user?.id || data.user.role === "ADMIN") return;
    if (idleRef.current) clearTimeout(idleRef.current);
    idleRef.current = setTimeout(() => {
      void signOut({ callbackUrl: "/" });
    }, IDLE_MS);
  }, [data?.user?.id, data?.user?.role]);

  useEffect(() => {
    if (!data?.user?.id || data.user.role === "ADMIN") return;
    const ev = () => resetIdle();
    resetIdle();
    window.addEventListener("pointerdown", ev, { passive: true });
    window.addEventListener("keydown", ev);
    window.addEventListener("scroll", ev, { passive: true });
    return () => {
      if (idleRef.current) clearTimeout(idleRef.current);
      window.removeEventListener("pointerdown", ev);
      window.removeEventListener("keydown", ev);
      window.removeEventListener("scroll", ev);
    };
  }, [data?.user?.id, data?.user?.role, resetIdle]);

  function panicHide() {
    setPanic(true);
    setTimeout(() => setPanic(false), 2800);
  }

  if (!data?.user?.id || data.user.role === "ADMIN") return null;

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => toggleDiscreet()}
          className={`rounded-full border px-3 py-1 text-[10px] font-medium uppercase tracking-wider transition ${
            discreet
              ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-200"
              : "border-white/10 text-zinc-400 hover:border-white/20"
          }`}
        >
          {discreet ? "Discreto" : "Modo discreto"}
        </button>
        <button
          type="button"
          onClick={panicHide}
          className="rounded-full border border-white/10 px-3 py-1 text-[10px] font-medium uppercase tracking-wider text-zinc-400 hover:border-amber-500/30 hover:text-amber-200"
        >
          Ocultar
        </button>
      </div>
      {panic && (
        <div
          className="fixed inset-0 z-[100] cursor-default bg-[#0a0a0a] opacity-[0.98]"
          aria-hidden
          role="presentation"
        />
      )}
    </>
  );
}
