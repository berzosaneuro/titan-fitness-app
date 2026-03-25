"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { GlassCard } from "@/components/GlassCard";
import { NeonButton } from "@/components/NeonButton";

type Appointment = {
  id: string;
  startAt: string;
  endAt: string;
  status: string;
  notes: string | null;
};

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function addDays(d: Date, n: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

/** Ranuras locales (ej. cada 30 min, próximos días). */
function buildSlots(days: number): Date[] {
  const out: Date[] = [];
  const now = new Date();
  for (let day = 0; day < days; day++) {
    const base = addDays(startOfDay(now), day);
    for (let h = 10; h < 19; h++) {
      for (let m = 0; m < 60; m += 30) {
        const t = new Date(base);
        t.setHours(h, m, 0, 0);
        if (t.getTime() > now.getTime() + 15 * 60 * 1000) out.push(t);
      }
    }
  }
  return out;
}

export function AppointmentsClient() {
  const [list, setList] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [booking, setBooking] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const slots = useMemo(() => buildSlots(10), []);

  const load = useCallback(async () => {
    setLoading(true);
    const r = await fetch("/api/appointments");
    if (r.ok) {
      const data = await r.json();
      setList(data);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function book(at: Date) {
    setMsg(null);
    setBooking(true);
    const r = await fetch("/api/appointments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ startAt: at.toISOString(), slotMinutes: 30 }),
    });
    setBooking(false);
    if (!r.ok) {
      const e = await r.json().catch(() => ({}));
      setMsg(e.error ?? "No se pudo reservar");
      return;
    }
    setMsg("Cita confirmada.");
    load();
  }

  async function cancel(id: string) {
    setMsg(null);
    const r = await fetch(`/api/appointments/${id}`, { method: "DELETE" });
    if (!r.ok) {
      setMsg("No se pudo cancelar");
      return;
    }
    load();
  }

  async function reschedule(id: string, newStart: Date) {
    setMsg(null);
    setBooking(true);
    const r = await fetch(`/api/appointments/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ startAt: newStart.toISOString(), slotMinutes: 30 }),
    });
    setBooking(false);
    if (!r.ok) {
      setMsg("No se pudo reprogramar");
      return;
    }
    setMsg("Cita actualizada.");
    load();
  }

  const upcoming = list.filter(
    (a) =>
      a.status !== "CANCELED" &&
      new Date(a.startAt).getTime() > Date.now() - 60 * 60 * 1000
  );

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-3xl text-white">Citas privadas</h1>
        <p className="mt-2 text-zinc-400">
          Elige una ventana discreta. Las confirmaciones aparecen aquí al instante.
        </p>
      </div>

      {msg && (
        <p className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-zinc-300">
          {msg}
        </p>
      )}

      <GlassCard strong>
        <h2 className="font-display text-xl text-white">Nueva reserva</h2>
        <p className="mt-1 text-sm text-zinc-500">Zona horaria local · franjas de 30 minutos</p>
        <div className="mt-4 grid max-h-[420px] grid-cols-2 gap-2 overflow-y-auto sm:grid-cols-3 md:grid-cols-4">
          {slots.slice(0, 48).map((t) => (
            <NeonButton
              key={t.toISOString()}
              variant="ghost"
              className="py-2 text-xs font-normal"
              disabled={booking || loading}
              onClick={() => book(t)}
            >
              {t.toLocaleString("es", {
                weekday: "short",
                day: "numeric",
                month: "short",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </NeonButton>
          ))}
        </div>
      </GlassCard>

      <GlassCard>
        <h2 className="font-display text-xl text-white">Tus citas</h2>
        {loading ? (
          <p className="mt-4 text-sm text-zinc-500">Cargando…</p>
        ) : upcoming.length === 0 ? (
          <p className="mt-4 text-sm text-zinc-500">Aún no hay citas activas.</p>
        ) : (
          <ul className="mt-4 space-y-3">
            {upcoming.map((a) => (
              <li
                key={a.id}
                className="flex flex-col gap-2 rounded-xl border border-white/10 bg-black/30 p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="text-white">
                    {new Date(a.startAt).toLocaleString("es", {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                  </p>
                  <p className="text-xs uppercase tracking-wider text-zinc-500">{a.status}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <NeonButton
                    variant="outline"
                    className="py-2 text-xs"
                    disabled={booking}
                    onClick={() => {
                      const next = slots.find((s) => s.getTime() > Date.now());
                      if (next) reschedule(a.id, next);
                    }}
                  >
                    Reprogramar
                  </NeonButton>
                  <NeonButton
                    variant="ghost"
                    className="py-2 text-xs text-red-300 border-red-500/30"
                    disabled={booking}
                    onClick={() => cancel(a.id)}
                  >
                    Cancelar
                  </NeonButton>
                </div>
              </li>
            ))}
          </ul>
        )}
      </GlassCard>
    </div>
  );
}
