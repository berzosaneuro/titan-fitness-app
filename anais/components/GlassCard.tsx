import type { ReactNode } from "react";

export function GlassCard({
  children,
  className = "",
  strong = false,
}: {
  children: ReactNode;
  className?: string;
  strong?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl p-5 sm:p-6 ${strong ? "glass-strong" : "glass"} ${className}`}
    >
      {children}
    </div>
  );
}
