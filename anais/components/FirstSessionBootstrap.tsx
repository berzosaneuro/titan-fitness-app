"use client";

import { useSession } from "next-auth/react";
import { useEffect, useRef } from "react";

/** Garantiza mensajes de primera sesión (idempotente en servidor). */
export function FirstSessionBootstrap() {
  const { status } = useSession();
  const done = useRef(false);

  useEffect(() => {
    if (status !== "authenticated" || done.current) return;
    done.current = true;
    void fetch("/api/onboarding/bootstrap", { method: "POST" }).catch(() => {});
  }, [status]);

  return null;
}
