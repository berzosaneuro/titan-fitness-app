import { AppShell } from "@/components/AppShell";
import { DiscreetModeProvider } from "@/components/DiscreetModeProvider";
import type { ReactNode } from "react";

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <DiscreetModeProvider>
      <AppShell>{children}</AppShell>
    </DiscreetModeProvider>
  );
}
