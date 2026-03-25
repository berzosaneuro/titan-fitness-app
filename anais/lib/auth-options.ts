import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { levelFromTotalSpent } from "@/lib/pricing";
import { getEffectivePricing } from "@/lib/effective-pricing";

export const authOptions: NextAuthOptions = {
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60,
    /** Con actividad diaria, la sesión se renueva (menos riesgo de sesión abandonada). */
    updateAge: 24 * 60 * 60,
  },
  pages: {
    signIn: "/login",
  },
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;
        const email = credentials.email.trim().toLowerCase();
        const user = await prisma.user.findUnique({
          where: { email },
          select: {
            id: true,
            email: true,
            passwordHash: true,
            name: true,
            image: true,
            role: true,
            walletBalanceCents: true,
            totalSpentCents: true,
            journeyPhase: true,
            vipLevel: true,
            subscription: true,
          },
        });
        if (!user) return null;
        const ok = await bcrypt.compare(credentials.password, user.passwordHash);
        if (!ok) return null;
        const isSubscribed = user.subscription?.status === "ACTIVE";
        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image,
          role: user.role,
          isSubscribed,
          walletBalanceCents: user.walletBalanceCents,
          totalSpentCents: user.totalSpentCents,
          journeyPhase: user.journeyPhase,
          vipLevel: user.vipLevel,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.sub = user.id;
        token.role = user.role;
        token.isSubscribed = user.isSubscribed ?? false;
        token.walletBalanceCents = (user as { walletBalanceCents?: number }).walletBalanceCents ?? 0;
        token.totalSpentCents = (user as { totalSpentCents?: number }).totalSpentCents ?? 0;
        token.journeyPhase = (user as { journeyPhase?: number }).journeyPhase ?? 1;
        token.vipLevel = (user as { vipLevel?: number }).vipLevel ?? 1;
      }
      if (trigger === "update" && token.sub) {
        if (session?.walletBalanceCents !== undefined) {
          token.walletBalanceCents = session.walletBalanceCents;
        }
        if (session?.totalSpentCents !== undefined) {
          token.totalSpentCents = session.totalSpentCents;
        }
        const u = await prisma.user.findUnique({
          where: { id: token.sub },
          select: {
            walletBalanceCents: true,
            totalSpentCents: true,
            subscription: true,
            journeyPhase: true,
            vipLevel: true,
          },
        });
        if (u) {
          token.walletBalanceCents = u.walletBalanceCents;
          token.totalSpentCents = u.totalSpentCents;
          token.isSubscribed = u.subscription?.status === "ACTIVE";
          token.journeyPhase = u.journeyPhase;
          token.vipLevel = u.vipLevel;
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.sub) {
        session.user.id = token.sub;
        session.user.role = (token.role as typeof session.user.role) ?? "USER";
        session.user.isSubscribed = Boolean(token.isSubscribed);
        session.user.walletBalanceCents = (token.walletBalanceCents as number) ?? 0;
        session.user.totalSpentCents = (token.totalSpentCents as number) ?? 0;
        const pricing = await getEffectivePricing();
        session.user.level = levelFromTotalSpent(
          session.user.totalSpentCents,
          pricing.levelThresholdsCents
        );
        session.user.journeyPhase = (token.journeyPhase as number) ?? 1;
        session.user.vipLevel = (token.vipLevel as number) ?? session.user.level;
      }
      return session;
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
};
