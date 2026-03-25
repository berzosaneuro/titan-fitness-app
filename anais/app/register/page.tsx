"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { GlassCard } from "@/components/GlassCard";
import { NeonButton } from "@/components/NeonButton";

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const res = await fetch("/api/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: name.trim() || undefined,
        email: email.trim().toLowerCase(),
        password,
      }),
    });
    const data = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) {
      setError(data.error ?? "No se pudo completar el registro.");
      return;
    }
    router.push("/login?registered=1");
    router.refresh();
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 py-16">
      <Link
        href="/"
        className="mb-8 font-display text-3xl text-gradient transition hover:opacity-90"
      >
        Anaïs
      </Link>
      <GlassCard className="w-full max-w-md" strong>
        <h1 className="font-display text-2xl text-white">Solicitud de acceso</h1>
        <p className="mt-1 text-sm text-zinc-400">
          Necesitas un enlace de invitación válido (cookie segura). Después, recargas saldo para el
          chat y los desbloqueos — sin pagos por acción sueltos en cada clic.
        </p>
        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          <div>
            <label htmlFor="name" className="block text-xs font-medium text-zinc-400">
              Nombre (opcional)
            </label>
            <input
              id="name"
              type="text"
              autoComplete="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white outline-none focus:border-neon-purple/50"
            />
          </div>
          <div>
            <label htmlFor="email" className="block text-xs font-medium text-zinc-400">
              Correo
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white outline-none focus:border-neon-purple/50"
            />
          </div>
          <div>
            <label htmlFor="password" className="block text-xs font-medium text-zinc-400">
              Contraseña (mín. 8 caracteres)
            </label>
            <input
              id="password"
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white outline-none focus:border-neon-purple/50"
            />
          </div>
          {error && <p className="text-sm text-red-400">{error}</p>}
          <NeonButton type="submit" className="w-full py-3" disabled={loading}>
            {loading ? "Creando…" : "Registrar"}
          </NeonButton>
        </form>
        <p className="mt-6 text-center text-sm text-zinc-500">
          ¿Ya tienes cuenta?{" "}
          <Link href="/login" className="text-neon-blue hover:underline">
            Entrar
          </Link>
        </p>
      </GlassCard>
    </div>
  );
}
