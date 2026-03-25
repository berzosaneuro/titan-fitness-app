import type { Role } from "@prisma/client";
import "next-auth";
import "next-auth/jwt";

declare module "next-auth" {
  interface User {
    role?: Role;
    isSubscribed?: boolean;
    walletBalanceCents?: number;
    totalSpentCents?: number;
    journeyPhase?: number;
    vipLevel?: number;
  }

  interface Session {
    user: {
      id: string;
      email?: string | null;
      name?: string | null;
      image?: string | null;
      role: Role;
      isSubscribed: boolean;
      walletBalanceCents: number;
      totalSpentCents: number;
      level: number;
      journeyPhase: number;
      vipLevel: number;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role?: Role;
    isSubscribed?: boolean;
    walletBalanceCents?: number;
    totalSpentCents?: number;
    journeyPhase?: number;
    vipLevel?: number;
  }
}
