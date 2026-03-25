"use client";

import { SessionProvider } from "next-auth/react";
import type { ReactNode } from "react";
import { useEffect } from "react";

function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;
    void navigator.serviceWorker.register("/sw.js").catch(() => {});
  }, []);
  return null;
}

export function Providers({ children }: { children: ReactNode }) {
  return (
    <SessionProvider>
      <ServiceWorkerRegister />
      {children}
    </SessionProvider>
  );
}
