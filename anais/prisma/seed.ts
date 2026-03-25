import {
  PrismaClient,
  Role,
  ContentMediaKind,
  ContentVideoTier,
  type Prisma,
} from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const adminEmail = process.env.SEED_ADMIN_EMAIL ?? "admin@anais.local";
  const adminPass = process.env.SEED_ADMIN_PASSWORD ?? "ChangeMe!Anais1";
  const hash = await bcrypt.hash(adminPass, 12);

  await prisma.user.upsert({
    where: { email: adminEmail },
    create: {
      email: adminEmail,
      passwordHash: hash,
      name: "Anaïs",
      role: Role.ADMIN,
      walletBalanceCents: 0,
      totalSpentCents: 0,
    },
    update: { role: Role.ADMIN },
  });

  await prisma.platformConfig.upsert({
    where: { id: 1 },
    create: { id: 1, pricing: {} },
    update: {},
  });

  const invite = await prisma.invite.upsert({
    where: { code: "founders" },
    create: {
      code: "founders",
      maxUses: 1000,
      usedCount: 0,
      note: "Acceso fundador (demo)",
    },
    update: { maxUses: 1000 },
  });

  const memberHash = await bcrypt.hash("MemberDemo!1", 12);
  const demo = await prisma.user.upsert({
    where: { email: "member@anais.local" },
    create: {
      email: "member@anais.local",
      passwordHash: memberHash,
      name: "Member",
      role: Role.USER,
      inviteId: invite.id,
      walletBalanceCents: 2500,
      totalSpentCents: 0,
      chatEntitlement: { create: { freeMessagesLeft: 1 } },
    },
    update: {
      inviteId: invite.id,
    },
  });

  await prisma.chatEntitlement.upsert({
    where: { userId: demo.id },
    create: { userId: demo.id, freeMessagesLeft: 1 },
    update: { freeMessagesLeft: 1 },
  });

  const DEMO_VIDEO =
    "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4";

  const count = await prisma.content.count();
  if (count === 0) {
    const rows: Prisma.ContentCreateManyInput[] = [];
    let sortOrder = 0;

    for (let i = 0; i < 5; i++) {
      const isVid = i % 2 === 1;
      rows.push({
        title: `Serie abierta ${i + 1}`,
        description: "Disponible sin desbloqueo. Vista neutra.",
        isPremium: false,
        unlockPriceCents: 0,
        sortOrder: sortOrder++,
        isSeed: true,
        mediaKind: isVid ? ContentMediaKind.VIDEO : ContentMediaKind.STANDARD,
        videoTeaserUrl: isVid ? DEMO_VIDEO : null,
        videoFullUrl: isVid ? DEMO_VIDEO : null,
        teaserSeconds: 8,
        previewUrl: isVid ? null : null,
        videoTier: isVid ? ContentVideoTier.TEASER : null,
      });
    }

    for (let i = 0; i < 16; i++) {
      const isVid = i < 7;
      rows.push({
        title: `Pieza reservada ${i + 1}`,
        description: "Micro-pago para acceso. Sin suscripción.",
        isPremium: true,
        unlockPriceCents: 280 + (i % 6) * 45,
        sortOrder: sortOrder++,
        isSeed: true,
        mediaKind: isVid ? ContentMediaKind.VIDEO : ContentMediaKind.STANDARD,
        videoTeaserUrl: isVid ? DEMO_VIDEO : null,
        videoFullUrl: isVid ? DEMO_VIDEO : null,
        teaserSeconds: 6 + (i % 5),
        videoTier: isVid ? ContentVideoTier.LOCKED : null,
      });
    }

    for (let i = 0; i < 5; i++) {
      rows.push({
        title: `Colección premium ${i + 1}`,
        description: "Acceso de nivel superior.",
        isPremium: true,
        unlockPriceCents: 880 + i * 50,
        sortOrder: sortOrder++,
        isSeed: true,
        mediaKind: i % 2 === 0 ? ContentMediaKind.VIDEO : ContentMediaKind.STANDARD,
        videoTeaserUrl: i % 2 === 0 ? DEMO_VIDEO : null,
        videoFullUrl: i % 2 === 0 ? DEMO_VIDEO : null,
        teaserSeconds: 10,
        videoTier: i % 2 === 0 ? ContentVideoTier.PREMIUM : null,
      });
    }

    await prisma.content.createMany({ data: rows });
  }

  console.log("Seed OK.");
  console.log("Admin:", adminEmail, "| Demo: member@anais.local / MemberDemo!1");
  console.log("Invitación demo: /i/founders");
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
