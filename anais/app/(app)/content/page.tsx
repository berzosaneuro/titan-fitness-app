import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { GlassCard } from "@/components/GlassCard";
import { ContentGridClient } from "@/components/ContentGridClient";
import { applyPriceMultiplier, getUserMonetizationProfile } from "@/lib/decision-engine";
import Link from "next/link";

export default async function ContentPage() {
  const session = await getSession();
  if (!session?.user?.id) return null;

  const items = await prisma.content.findMany({
    orderBy: { sortOrder: "asc" },
    select: {
      id: true,
      title: true,
      description: true,
      previewUrl: true,
      fullUrl: true,
      isPremium: true,
      unlockPriceCents: true,
      sortOrder: true,
      mediaKind: true,
      videoTeaserUrl: true,
      videoFullUrl: true,
      videoPosterUrl: true,
      teaserSeconds: true,
      videoTier: true,
    },
  });
  const unlocks = await prisma.contentUnlock.findMany({
    where: { userId: session.user.id },
    select: { contentId: true },
  });
  const unlocked = new Set(unlocks.map((u) => u.contentId));
  const profile = await getUserMonetizationProfile(session.user.id);

  const mapped = items.map((c) => {
    const locked = c.isPremium && !unlocked.has(c.id);
    const displayUnlock = locked
      ? applyPriceMultiplier(c.unlockPriceCents, profile.priceMultiplierPercent)
      : c.unlockPriceCents;
    const playUrl =
      c.mediaKind === "VIDEO"
        ? locked
          ? null
          : c.videoFullUrl || c.fullUrl
        : locked
          ? null
          : c.fullUrl;
    return {
      id: c.id,
      title: c.title,
      description: c.description,
      previewUrl: c.previewUrl,
      fullUrl: playUrl,
      isPremium: c.isPremium,
      unlockPriceCents: displayUnlock,
      locked,
      mediaKind: c.mediaKind,
      videoTeaserUrl: c.videoTeaserUrl,
      videoFullUrl: c.videoFullUrl,
      videoPosterUrl: c.videoPosterUrl,
      teaserSeconds: c.teaserSeconds,
      videoTier: c.videoTier,
    };
  });

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-3xl text-white">Contenido exclusivo</h1>
        <p className="mt-2 text-zinc-400">
          Cada pieza se desbloquea con el monedero. Sin suscripciones forzadas: micro-pagos bajo
          demanda.
        </p>
      </div>

      <GlassCard className="border-neon-purple/20" strong>
        <p className="text-sm text-zinc-300">
          Saldo actual en{" "}
          <Link href="/profile" className="text-neon-blue underline-offset-2 hover:underline">
            Perfil
          </Link>
          . Los importes son discretos en extractos.
        </p>
      </GlassCard>

      <ContentGridClient items={mapped} />
    </div>
  );
}
