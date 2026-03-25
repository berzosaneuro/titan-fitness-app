import { Suspense } from "react";
import { ProfileClient } from "@/components/ProfileClient";

export default function ProfilePage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl text-white">Perfil</h1>
        <p className="mt-2 text-zinc-400">Ajustes de cuenta y gestión de suscripción.</p>
      </div>
      <Suspense
        fallback={<p className="text-sm text-zinc-500">Cargando perfil…</p>}
      >
        <ProfileClient />
      </Suspense>
    </div>
  );
}
