import { prisma } from "@/lib/prisma";

/** Usuario “creador” para el hilo de chat (admin por defecto o CREATOR_USER_ID). */
export async function getCreatorUserId(): Promise<string | null> {
  const fromEnv = process.env.CREATOR_USER_ID?.trim();
  if (fromEnv) {
    const u = await prisma.user.findUnique({ where: { id: fromEnv } });
    if (u) return u.id;
  }
  const admin = await prisma.user.findFirst({
    where: { role: "ADMIN" },
    orderBy: { createdAt: "asc" },
  });
  return admin?.id ?? null;
}
