"use client";

import { useCallback, useEffect, useState } from "react";
import { GlassCard } from "@/components/GlassCard";
import { NeonButton } from "@/components/NeonButton";

type UserRow = {
  id: string;
  email: string;
  name: string | null;
  role: string;
  createdAt: string;
  walletBalanceCents: number;
  totalSpentCents: number;
  subscription: { status: string; currentPeriodEnd: string | null } | null;
};

type ApptRow = {
  id: string;
  startAt: string;
  status: string;
  user: { email: string; name: string | null };
};

type ContentRow = {
  id: string;
  title: string;
  description: string | null;
  previewUrl: string | null;
  fullUrl: string | null;
  isPremium: boolean;
  unlockPriceCents: number;
  sortOrder: number;
};

type InviteRow = {
  id: string;
  code: string;
  maxUses: number;
  usedCount: number;
  expiresAt: string | null;
  note: string | null;
};

type InboxRow = {
  user: { id: string; email: string; name: string | null };
  lastAt: string;
  preview: string;
};

type Msg = { id: string; body: string; senderId: string; createdAt: string };

type AnalyticsSummary = {
  days: number;
  analyticsRevenueCents: number;
  topupsVolumeCents: number;
  topupsCount: number;
  byType: { type: string; _sum: { revenueCents: number | null }; _count: { _all: number } }[];
  topSpenders: {
    id: string;
    email: string;
    totalSpentCents: number;
    walletBalanceCents: number;
    createdAt: string;
    referredByUserId: string | null;
    journeyPhase: number;
    vipLevel: number;
  }[];
  userCounts: { role: string; _count: { _all: number } }[];
  journeyBuckets: { journeyPhase: number; _count: { _all: number } }[];
};

export function AdminPanel() {
  const [tab, setTab] = useState<
    "users" | "bookings" | "content" | "inbox" | "invites" | "analytics" | "monetization"
  >("users");
  const [users, setUsers] = useState<UserRow[]>([]);
  const [bookings, setBookings] = useState<ApptRow[]>([]);
  const [content, setContent] = useState<ContentRow[]>([]);
  const [inbox, setInbox] = useState<InboxRow[]>([]);
  const [invites, setInvites] = useState<InviteRow[]>([]);
  const [threadUserId, setThreadUserId] = useState<string | null>(null);
  const [thread, setThread] = useState<Msg[]>([]);
  const [reply, setReply] = useState("");
  const [replyLocked, setReplyLocked] = useState(false);
  const [replyPreview, setReplyPreview] = useState("");
  const [replyUnlockCents, setReplyUnlockCents] = useState(200);
  const [replyPriority, setReplyPriority] = useState(false);
  const [loading, setLoading] = useState(false);
  const [analytics, setAnalytics] = useState<AnalyticsSummary | null>(null);
  const [analyticsDays, setAnalyticsDays] = useState(30);
  const [monetizationNote, setMonetizationNote] = useState<string | null>(null);
  const [mForm, setMForm] = useState({
    freeFirstMessages: 3,
    chatMessageCostCents: 150,
    priorityReplyCents: 200,
    specialInteractionCents: 1000,
    defaultUnlockMessageCents: 350,
    defaultContentUnlockCents: 650,
    referrerFirstTopupRewardCents: 500,
    bonus10: 0,
    bonus25: 0,
    bonus50: 8,
    levelThresholdsEur: "0,50,150,400,1000",
  });

  const loadUsers = useCallback(async () => {
    const r = await fetch("/api/admin/users");
    if (r.ok) setUsers(await r.json());
  }, []);
  const loadBookings = useCallback(async () => {
    const r = await fetch("/api/admin/appointments");
    if (r.ok) setBookings(await r.json());
  }, []);
  const loadContent = useCallback(async () => {
    const r = await fetch("/api/admin/content");
    if (r.ok) setContent(await r.json());
  }, []);
  const loadInbox = useCallback(async () => {
    const r = await fetch("/api/admin/inbox");
    if (r.ok) setInbox(await r.json());
  }, []);
  const loadInvites = useCallback(async () => {
    const r = await fetch("/api/admin/invites");
    if (r.ok) setInvites(await r.json());
  }, []);
  const loadAnalytics = useCallback(async () => {
    const r = await fetch(
      `/api/admin/analytics/summary?days=${encodeURIComponent(String(analyticsDays))}`
    );
    if (r.ok) setAnalytics(await r.json());
  }, [analyticsDays]);
  const loadMonetizationForm = useCallback(async () => {
    const [rp, ra] = await Promise.all([
      fetch("/api/pricing/public"),
      fetch("/api/admin/pricing"),
    ]);
    if (!rp.ok) return;
    const pub = await rp.json();
    const admin = ra.ok ? await ra.json() : {};
    const bonus = (admin.topupBonusPercentByEur ?? {}) as Record<string, number>;
    const tier = (eur: number) =>
      typeof bonus[String(eur)] === "number"
        ? bonus[String(eur)]
        : pub.topupTiers?.find((t: { eur: number }) => t.eur === eur)?.bonusPercent ?? 0;
    const thCents: number[] = Array.isArray(admin.levelThresholdsCents)
      ? admin.levelThresholdsCents
      : pub.levelThresholdsCents ?? [];
    const thEur = thCents.map((c: number) => c / 100).join(",");
    setMForm({
      freeFirstMessages:
        typeof admin.freeFirstMessages === "number" ? admin.freeFirstMessages : pub.freeFirstMessages,
      chatMessageCostCents:
        typeof admin.chatMessageCostCents === "number"
          ? admin.chatMessageCostCents
          : pub.chatMessageCostCents,
      priorityReplyCents:
        typeof admin.priorityReplyCents === "number"
          ? admin.priorityReplyCents
          : pub.priorityReplyCents,
      specialInteractionCents:
        typeof admin.specialInteractionCents === "number"
          ? admin.specialInteractionCents
          : pub.specialInteractionCents,
      defaultUnlockMessageCents:
        typeof admin.defaultUnlockMessageCents === "number"
          ? admin.defaultUnlockMessageCents
          : pub.defaultUnlockMessageCents,
      defaultContentUnlockCents:
        typeof admin.defaultContentUnlockCents === "number"
          ? admin.defaultContentUnlockCents
          : pub.defaultContentUnlockCents,
      referrerFirstTopupRewardCents:
        typeof admin.referrerFirstTopupRewardCents === "number"
          ? admin.referrerFirstTopupRewardCents
          : 500,
      bonus10: tier(10),
      bonus25: tier(25),
      bonus50: tier(50),
      levelThresholdsEur: thEur || "0,50,150,400,1000",
    });
  }, []);

  useEffect(() => {
    if (tab === "users") loadUsers();
    if (tab === "bookings") loadBookings();
    if (tab === "content") loadContent();
    if (tab === "inbox") loadInbox();
    if (tab === "invites") loadInvites();
    if (tab === "monetization") void loadMonetizationForm();
  }, [tab, loadUsers, loadBookings, loadContent, loadInbox, loadInvites, loadMonetizationForm]);

  useEffect(() => {
    if (tab === "analytics") void loadAnalytics();
  }, [tab, analyticsDays, loadAnalytics]);

  async function openThread(userId: string) {
    setThreadUserId(userId);
    const r = await fetch(`/api/admin/messages?userId=${encodeURIComponent(userId)}`);
    if (r.ok) setThread(await r.json());
  }

  async function sendReply(e: React.FormEvent) {
    e.preventDefault();
    if (!threadUserId || !reply.trim()) return;
    setLoading(true);
    const r = await fetch("/api/admin/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: threadUserId,
        body: reply.trim(),
        isLocked: replyLocked,
        previewText: replyLocked ? replyPreview.trim() || undefined : undefined,
        unlockPriceCents: replyLocked ? replyUnlockCents : undefined,
        priorityBoost: replyPriority,
      }),
    });
    setLoading(false);
    if (r.ok) {
      setReply("");
      setReplyLocked(false);
      setReplyPreview("");
      setReplyPriority(false);
      openThread(threadUserId);
      loadInbox();
    }
  }

  async function createInvite() {
    setLoading(true);
    const r = await fetch("/api/admin/invites", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ maxUses: 50 }) });
    setLoading(false);
    if (r.ok) loadInvites();
  }

  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newPremium, setNewPremium] = useState(true);

  async function addContent(e: React.FormEvent) {
    e.preventDefault();
    if (!newTitle.trim()) return;
    setLoading(true);
    const r = await fetch("/api/admin/content", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: newTitle.trim(),
        description: newDesc.trim() || undefined,
        isPremium: newPremium,
      }),
    });
    setLoading(false);
    if (r.ok) {
      setNewTitle("");
      setNewDesc("");
      loadContent();
    }
  }

  async function saveMonetization(e: React.FormEvent) {
    e.preventDefault();
    setMonetizationNote(null);
    const parts = mForm.levelThresholdsEur.split(",").map((s) => s.trim());
    const levelThresholdsCents = parts
      .map((p) => Math.round(parseFloat(p) * 100))
      .filter((n) => !Number.isNaN(n));
    if (levelThresholdsCents.length < 2) {
      setMonetizationNote("Umbrales: al menos 2 valores en euros separados por coma.");
      return;
    }
    setLoading(true);
    const r = await fetch("/api/admin/pricing", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        freeFirstMessages: mForm.freeFirstMessages,
        chatMessageCostCents: mForm.chatMessageCostCents,
        priorityReplyCents: mForm.priorityReplyCents,
        specialInteractionCents: mForm.specialInteractionCents,
        defaultUnlockMessageCents: mForm.defaultUnlockMessageCents,
        defaultContentUnlockCents: mForm.defaultContentUnlockCents,
        referrerFirstTopupRewardCents: mForm.referrerFirstTopupRewardCents,
        levelThresholdsCents,
        topupBonusPercentByEur: {
          "10": mForm.bonus10,
          "25": mForm.bonus25,
          "50": mForm.bonus50,
        },
      }),
    });
    setLoading(false);
    if (r.ok) {
      setMonetizationNote("Guardado. La caché de precios se invalidó (~1 min).");
      void loadMonetizationForm();
    } else {
      setMonetizationNote("Error al guardar.");
    }
  }

  const tabs = [
    { id: "users" as const, label: "Usuarios" },
    { id: "bookings" as const, label: "Reservas" },
    { id: "content" as const, label: "Contenido" },
    { id: "inbox" as const, label: "Bandeja" },
    { id: "invites" as const, label: "Invitaciones" },
    { id: "analytics" as const, label: "Analytics" },
    { id: "monetization" as const, label: "Monetización" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl text-white">Panel Anaïs</h1>
        <p className="mt-2 text-zinc-400">Gestión de miembros, citas, piezas y mensajes.</p>
      </div>

      <div className="flex flex-wrap gap-2">
        {tabs.map((t) => (
          <NeonButton
            key={t.id}
            variant={tab === t.id ? "primary" : "ghost"}
            className="text-xs"
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </NeonButton>
        ))}
      </div>

      {tab === "users" && (
        <GlassCard>
          <h2 className="font-display text-lg text-white">Usuarios</h2>
          <ul className="mt-4 space-y-2 text-sm">
            {users.map((u) => (
              <li
                key={u.id}
                className="flex flex-col gap-1 rounded-xl border border-white/10 bg-black/30 px-3 py-2 sm:flex-row sm:items-center sm:justify-between"
              >
                <span className="text-zinc-200">{u.email}</span>
                <span className="text-xs text-zinc-500">
                  {u.role} · saldo {(u.walletBalanceCents / 100).toFixed(2)} € · gasto{" "}
                  {(u.totalSpentCents / 100).toFixed(2)} €
                </span>
              </li>
            ))}
          </ul>
        </GlassCard>
      )}

      {tab === "bookings" && (
        <GlassCard>
          <h2 className="font-display text-lg text-white">Reservas</h2>
          <ul className="mt-4 space-y-2 text-sm">
            {bookings.map((b) => (
              <li
                key={b.id}
                className="rounded-xl border border-white/10 bg-black/30 px-3 py-2"
              >
                <p className="text-white">{b.user.email}</p>
                <p className="text-zinc-400">
                  {new Date(b.startAt).toLocaleString("es")} · {b.status}
                </p>
              </li>
            ))}
          </ul>
        </GlassCard>
      )}

      {tab === "content" && (
        <div className="space-y-4">
          <GlassCard strong>
            <h2 className="font-display text-lg text-white">Nueva pieza</h2>
            <form onSubmit={addContent} className="mt-4 space-y-3">
              <input
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="Título"
                className="w-full rounded-xl border border-white/10 bg-black/40 px-4 py-2 text-sm text-white"
              />
              <textarea
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
                placeholder="Descripción (opcional)"
                rows={3}
                className="w-full rounded-xl border border-white/10 bg-black/40 px-4 py-2 text-sm text-white"
              />
              <label className="flex items-center gap-2 text-sm text-zinc-400">
                <input
                  type="checkbox"
                  checked={newPremium}
                  onChange={(e) => setNewPremium(e.target.checked)}
                />
                Solo suscriptores
              </label>
              <NeonButton type="submit" disabled={loading}>
                Añadir
              </NeonButton>
            </form>
          </GlassCard>
          <GlassCard>
            <h2 className="font-display text-lg text-white">Catálogo</h2>
            <ul className="mt-4 space-y-2 text-sm">
              {content.map((c) => (
                <li
                  key={c.id}
                  className="rounded-xl border border-white/10 bg-black/30 px-3 py-2"
                >
                  <p className="text-white">{c.title}</p>
                  <p className="text-xs text-zinc-500">
                    {c.isPremium ? "premium" : "público"} · desbloqueo{" "}
                    {(c.unlockPriceCents / 100).toFixed(2)} € · orden {c.sortOrder}
                  </p>
                </li>
              ))}
            </ul>
          </GlassCard>
        </div>
      )}

      {tab === "inbox" && (
        <div className="grid gap-4 lg:grid-cols-2">
          <GlassCard>
            <h2 className="font-display text-lg text-white">Conversaciones</h2>
            <ul className="mt-4 space-y-2">
              {inbox.map((row) => (
                <li key={row.user.id}>
                  <button
                    type="button"
                    onClick={() => openThread(row.user.id)}
                    className={`w-full rounded-xl border px-3 py-2 text-left text-sm transition ${
                      threadUserId === row.user.id
                        ? "border-neon-purple/50 bg-neon-purple/10"
                        : "border-white/10 bg-black/30 hover:border-white/20"
                    }`}
                  >
                    <p className="text-white">{row.user.email}</p>
                    <p className="truncate text-xs text-zinc-500">{row.preview}</p>
                  </button>
                </li>
              ))}
            </ul>
          </GlassCard>
          <GlassCard strong>
            <h2 className="font-display text-lg text-white">Hilo</h2>
            {!threadUserId ? (
              <p className="mt-4 text-sm text-zinc-500">Selecciona un miembro.</p>
            ) : (
              <>
                <div className="mt-4 max-h-64 space-y-2 overflow-y-auto text-sm">
                  {thread.map((m) => (
                    <div
                      key={m.id}
                      className="rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-zinc-200"
                    >
                      {m.body}
                    </div>
                  ))}
                </div>
                <form onSubmit={sendReply} className="mt-4 space-y-3">
                  <div className="flex gap-2">
                    <input
                      value={reply}
                      onChange={(e) => setReply(e.target.value)}
                      className="min-w-0 flex-1 rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white"
                      placeholder="Responder como Anaïs…"
                    />
                    <NeonButton type="submit" disabled={loading}>
                      Enviar
                    </NeonButton>
                  </div>
                  <label className="flex items-center gap-2 text-xs text-zinc-400">
                    <input
                      type="checkbox"
                      checked={replyLocked}
                      onChange={(e) => setReplyLocked(e.target.checked)}
                    />
                    Mensaje con candado (vista previa + pago)
                  </label>
                  {replyLocked && (
                    <div className="space-y-2">
                      <input
                        value={replyPreview}
                        onChange={(e) => setReplyPreview(e.target.value)}
                        placeholder="Texto de preview (sugerente, no explícito)"
                        className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white"
                      />
                      <input
                        type="number"
                        min={50}
                        max={50000}
                        value={replyUnlockCents}
                        onChange={(e) => setReplyUnlockCents(Number(e.target.value))}
                        className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white"
                      />
                      <p className="text-[10px] text-zinc-600">Precio en céntimos (ej. 200 = 2 €)</p>
                    </div>
                  )}
                  <label className="flex items-center gap-2 text-xs text-zinc-400">
                    <input
                      type="checkbox"
                      checked={replyPriority}
                      onChange={(e) => setReplyPriority(e.target.checked)}
                    />
                    Marcar prioridad percibida
                  </label>
                </form>
              </>
            )}
          </GlassCard>
        </div>
      )}

      {tab === "analytics" && (
        <div className="space-y-4">
          <GlassCard>
            <div className="flex flex-wrap items-end gap-4">
              <div>
                <h2 className="font-display text-lg text-white">Ingresos y embudo</h2>
                <p className="text-sm text-zinc-500">Eventos con revenue + volumen de recargas Stripe.</p>
              </div>
              <label className="flex items-center gap-2 text-xs text-zinc-400">
                Días
                <select
                  value={analyticsDays}
                  onChange={(e) => setAnalyticsDays(Number(e.target.value))}
                  className="rounded-lg border border-white/10 bg-black/40 px-2 py-1 text-white"
                >
                  {[7, 14, 30, 60, 90].map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </label>
              <NeonButton type="button" className="text-xs" onClick={() => void loadAnalytics()}>
                Actualizar
              </NeonButton>
            </div>
            {analytics && (
              <dl className="mt-6 grid gap-3 text-sm sm:grid-cols-2">
                <div className="rounded-xl border border-white/10 bg-black/30 px-3 py-2">
                  <dt className="text-xs text-zinc-500">Revenue atribuido (analytics)</dt>
                  <dd className="text-lg text-neon-blue">
                    {(analytics.analyticsRevenueCents / 100).toFixed(2)} €
                  </dd>
                </div>
                <div className="rounded-xl border border-white/10 bg-black/30 px-3 py-2">
                  <dt className="text-xs text-zinc-500">Recargas (crédito acreditado)</dt>
                  <dd className="text-lg text-white">
                    {(analytics.topupsVolumeCents / 100).toFixed(2)} € · {analytics.topupsCount}{" "}
                    ops
                  </dd>
                </div>
              </dl>
            )}
          </GlassCard>
          {analytics && (
            <>
              <GlassCard>
                <h3 className="font-display text-md text-white">Embudo y abandono</h3>
                <p className="mt-1 text-xs text-zinc-500">
                  Registro, agotar gratis, primer pago, checkout Stripe y saldo insuficiente. Sirve para
                  localizar fugas.
                </p>
                {(() => {
                  const funnelRows = analytics.byType.filter((row) =>
                    row.type.startsWith("funnel_")
                  );
                  const checkoutStarts =
                    funnelRows.find((r) => r.type === "funnel_checkout_started")?._count._all ?? 0;
                  const convPct =
                    checkoutStarts > 0
                      ? ((analytics.topupsCount / checkoutStarts) * 100).toFixed(1)
                      : null;
                  return (
                    <>
                      {convPct !== null && (
                        <p className="mt-3 text-sm text-neon-blue">
                          Conversión aprox. checkout → recarga en periodo: {convPct}% (
                          {analytics.topupsCount}/{checkoutStarts})
                        </p>
                      )}
                      <ul className="mt-3 space-y-2 text-sm">
                        {funnelRows.length === 0 && (
                          <li className="text-zinc-500">Sin eventos de embudo en este periodo.</li>
                        )}
                        {funnelRows.map((row) => (
                          <li
                            key={row.type}
                            className="flex justify-between gap-4 rounded-lg border border-white/5 bg-black/20 px-3 py-2"
                          >
                            <span className="text-zinc-400">{row.type}</span>
                            <span className="text-zinc-200">
                              {(row._sum.revenueCents ?? 0) / 100} € · {row._count._all} evt
                            </span>
                          </li>
                        ))}
                      </ul>
                    </>
                  );
                })()}
              </GlassCard>
              <GlassCard>
                <h3 className="font-display text-md text-white">Revenue por tipo</h3>
                <ul className="mt-3 space-y-2 text-sm">
                  {analytics.byType
                    .filter((row) => !row.type.startsWith("funnel_"))
                    .map((row) => (
                      <li
                        key={row.type}
                        className="flex justify-between gap-4 rounded-lg border border-white/5 bg-black/20 px-3 py-2"
                      >
                        <span className="text-zinc-400">{row.type}</span>
                        <span className="text-zinc-200">
                          {(row._sum.revenueCents ?? 0) / 100} € · {row._count._all} evt
                        </span>
                      </li>
                    ))}
                </ul>
              </GlassCard>
              <GlassCard>
                <h3 className="font-display text-md text-white">Top LTV (gasto acumulado)</h3>
                <ul className="mt-3 max-h-80 space-y-2 overflow-y-auto text-sm">
                  {analytics.topSpenders.map((u) => (
                    <li
                      key={u.id}
                      className="flex flex-col rounded-lg border border-white/5 bg-black/20 px-3 py-2 sm:flex-row sm:justify-between"
                    >
                      <span className="text-zinc-200">{u.email}</span>
                      <span className="text-xs text-zinc-500">
                        gasto {(u.totalSpentCents / 100).toFixed(2)} € · saldo{" "}
                        {(u.walletBalanceCents / 100).toFixed(2)} €
                        {u.referredByUserId ? " · referido" : ""}
                        {" · "}
                        fase {u.journeyPhase} · VIP {u.vipLevel}
                      </span>
                    </li>
                  ))}
                </ul>
              </GlassCard>
              <GlassCard>
                <h3 className="font-display text-md text-white">Viaje del usuario (fases 1–5)</h3>
                <p className="mt-1 text-xs text-zinc-500">
                  1 sin recarga · 2 con recarga · 3 micro-hábito · 4 nivel alto · 5 LTV fuerte / retorno.
                </p>
                <ul className="mt-3 text-sm text-zinc-400">
                  {analytics.journeyBuckets
                    .slice()
                    .sort((a, b) => a.journeyPhase - b.journeyPhase)
                    .map((j) => (
                      <li key={j.journeyPhase}>
                        Fase {j.journeyPhase}: {j._count._all} usuarios
                      </li>
                    ))}
                </ul>
              </GlassCard>
              <GlassCard>
                <h3 className="font-display text-md text-white">Segmentación básica</h3>
                <ul className="mt-3 text-sm text-zinc-400">
                  {analytics.userCounts.map((u) => (
                    <li key={u.role}>
                      {u.role}: {u._count._all}
                    </li>
                  ))}
                </ul>
              </GlassCard>
            </>
          )}
        </div>
      )}

      {tab === "monetization" && (
        <GlassCard strong>
          <h2 className="font-display text-lg text-white">Control de precios</h2>
          <p className="mt-1 text-sm text-zinc-500">
            Valores en céntimos EUR salvo umbrales (lista en euros). Se fusionan con la configuración
            guardada.
          </p>
          {monetizationNote && (
            <p className="mt-3 text-sm text-neon-blue">{monetizationNote}</p>
          )}
          <form onSubmit={saveMonetization} className="mt-6 grid gap-4 sm:grid-cols-2">
            <label className="text-xs text-zinc-400">
              Mensajes gratis iniciales
              <input
                type="number"
                min={0}
                max={20}
                value={mForm.freeFirstMessages}
                onChange={(e) =>
                  setMForm((f) => ({ ...f, freeFirstMessages: Number(e.target.value) }))
                }
                className="mt-1 w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white"
              />
            </label>
            <label className="text-xs text-zinc-400">
              Coste mensaje chat (céntimos)
              <input
                type="number"
                min={10}
                max={1000}
                value={mForm.chatMessageCostCents}
                onChange={(e) =>
                  setMForm((f) => ({ ...f, chatMessageCostCents: Number(e.target.value) }))
                }
                className="mt-1 w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white"
              />
            </label>
            <label className="text-xs text-zinc-400">
              Prioridad (céntimos)
              <input
                type="number"
                min={10}
                max={500}
                value={mForm.priorityReplyCents}
                onChange={(e) =>
                  setMForm((f) => ({ ...f, priorityReplyCents: Number(e.target.value) }))
                }
                className="mt-1 w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white"
              />
            </label>
            <label className="text-xs text-zinc-400">
              Interacción exclusiva (céntimos)
              <input
                type="number"
                min={50}
                max={5000}
                value={mForm.specialInteractionCents}
                onChange={(e) =>
                  setMForm((f) => ({ ...f, specialInteractionCents: Number(e.target.value) }))
                }
                className="mt-1 w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white"
              />
            </label>
            <label className="text-xs text-zinc-400">
              Unlock mensaje por defecto (céntimos)
              <input
                type="number"
                min={50}
                max={1000}
                value={mForm.defaultUnlockMessageCents}
                onChange={(e) =>
                  setMForm((f) => ({ ...f, defaultUnlockMessageCents: Number(e.target.value) }))
                }
                className="mt-1 w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white"
              />
            </label>
            <label className="text-xs text-zinc-400">
              Unlock contenido por defecto (céntimos)
              <input
                type="number"
                min={50}
                max={2000}
                value={mForm.defaultContentUnlockCents}
                onChange={(e) =>
                  setMForm((f) => ({ ...f, defaultContentUnlockCents: Number(e.target.value) }))
                }
                className="mt-1 w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white"
              />
            </label>
            <label className="text-xs text-zinc-400">
              Bono referidor 1ª recarga referido (céntimos)
              <input
                type="number"
                min={0}
                max={5000}
                value={mForm.referrerFirstTopupRewardCents}
                onChange={(e) =>
                  setMForm((f) => ({
                    ...f,
                    referrerFirstTopupRewardCents: Number(e.target.value),
                  }))
                }
                className="mt-1 w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white"
              />
            </label>
            <label className="text-xs text-zinc-400 sm:col-span-2">
              Umbrales nivel VIP (euros, coma)
              <input
                value={mForm.levelThresholdsEur}
                onChange={(e) => setMForm((f) => ({ ...f, levelThresholdsEur: e.target.value }))}
                className="mt-1 w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white"
                placeholder="0,50,150,400,1000"
              />
            </label>
            <div className="sm:col-span-2">
              <p className="text-xs font-medium uppercase tracking-widest text-zinc-500">
                Bono % recarga (sobre saldo acreditado)
              </p>
              <div className="mt-2 grid gap-3 sm:grid-cols-3">
                {(
                  [
                    ["bonus10", "10 €"] as const,
                    ["bonus25", "25 €"] as const,
                    ["bonus50", "50 €"] as const,
                  ] as const
                ).map(([key, label]) => (
                  <label key={key} className="text-xs text-zinc-400">
                    {label}
                    <input
                      type="number"
                      min={0}
                      max={50}
                      value={mForm[key]}
                      onChange={(e) =>
                        setMForm((f) => ({ ...f, [key]: Number(e.target.value) } as typeof f))
                      }
                      className="mt-1 w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white"
                    />
                  </label>
                ))}
              </div>
            </div>
            <div className="sm:col-span-2 flex flex-wrap gap-2">
              <NeonButton type="submit" disabled={loading}>
                Guardar monetización
              </NeonButton>
              <NeonButton
                type="button"
                variant="ghost"
                disabled={loading}
                onClick={() => void loadMonetizationForm()}
              >
                Recargar desde servidor
              </NeonButton>
            </div>
          </form>
        </GlassCard>
      )}

      {tab === "invites" && (
        <GlassCard strong>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="font-display text-lg text-white">Invitaciones privadas</h2>
              <p className="text-sm text-zinc-500">
                Enlaces del tipo <code className="text-neon-blue">/i/código</code> · caducidad y
                usos limitados.
              </p>
            </div>
            <NeonButton type="button" disabled={loading} onClick={() => void createInvite()}>
              Generar enlace
            </NeonButton>
          </div>
          <ul className="mt-6 space-y-3 text-sm">
            {invites.map((inv) => {
              const link =
                typeof window !== "undefined"
                  ? `${window.location.origin}/i/${inv.code}`
                  : `/i/${inv.code}`;
              return (
                <li
                  key={inv.id}
                  className="rounded-xl border border-white/10 bg-black/30 px-3 py-2"
                >
                  <p className="break-all text-neon-blue">{link}</p>
                  <p className="text-xs text-zinc-500">
                    usos {inv.usedCount}/{inv.maxUses}
                    {inv.expiresAt
                      ? ` · expira ${new Date(inv.expiresAt).toLocaleDateString("es")}`
                      : ""}
                  </p>
                </li>
              );
            })}
          </ul>
        </GlassCard>
      )}
    </div>
  );
}
