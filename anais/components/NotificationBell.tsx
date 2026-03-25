"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type Row = {
  id: string;
  kind: string;
  title: string;
  body: string;
  read: boolean;
  createdAt: string;
};

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<Row[]>([]);
  const rootRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    const r = await fetch("/api/notifications");
    if (r.ok) setRows(await r.json());
  }, []);

  useEffect(() => {
    void load();
    const t = setInterval(() => void load(), 120_000);
    const onVis = () => {
      if (document.visibilityState === "visible") void load();
    };
    const onPush = () => void load();
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("anais-notify", onPush);
    return () => {
      clearInterval(t);
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("anais-notify", onPush);
    };
  }, [load]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const unread = rows.filter((x) => !x.read).length;

  async function markRead(ids: string[]) {
    if (ids.length === 0) return;
    await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids, read: true }),
    });
    void load();
  }

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        onClick={() => {
          setOpen((o) => !o);
          void load();
        }}
        className="relative rounded-full border border-white/10 px-3 py-1.5 text-xs text-zinc-300 hover:border-white/20 hover:text-white"
        aria-label="Notificaciones"
      >
        Avisos
        {unread > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-neon-purple px-1 text-[10px] font-semibold text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-[min(100vw-2rem,20rem)] rounded-xl border border-white/10 bg-[#0f0f0f] py-2 shadow-xl">
          <div className="flex items-center justify-between border-b border-white/5 px-3 pb-2">
            <span className="text-xs font-medium text-zinc-400">Centro discreto</span>
            {unread > 0 && (
              <button
                type="button"
                className="text-[10px] text-neon-blue hover:underline"
                onClick={() =>
                  void markRead(rows.filter((x) => !x.read).map((x) => x.id))
                }
              >
                Marcar leídas
              </button>
            )}
          </div>
          <ul className="max-h-72 overflow-y-auto text-sm">
            {rows.length === 0 && (
              <li className="px-3 py-4 text-center text-xs text-zinc-500">Sin avisos</li>
            )}
            {rows.map((n) => (
              <li
                key={n.id}
                className={`border-b border-white/5 px-3 py-2 last:border-0 ${
                  n.read ? "opacity-60" : ""
                }`}
              >
                <p className="font-medium text-zinc-200">{n.title}</p>
                <p className="text-xs text-zinc-500">{n.body}</p>
                {!n.read && (
                  <button
                    type="button"
                    className="mt-1 text-[10px] text-zinc-600 hover:text-zinc-400"
                    onClick={() => void markRead([n.id])}
                  >
                    Marcar leída
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
