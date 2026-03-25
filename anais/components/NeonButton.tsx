import type { ButtonHTMLAttributes, ReactNode } from "react";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
  variant?: "primary" | "ghost" | "outline";
};

export function NeonButton({
  children,
  variant = "primary",
  className = "",
  type = "button",
  ...rest
}: Props) {
  const base =
    "inline-flex items-center justify-center gap-2 rounded-full px-5 py-2.5 text-sm font-medium transition-all duration-300 active:scale-[0.98] disabled:opacity-40 disabled:pointer-events-none";
  const styles = {
    primary:
      "bg-gradient-to-r from-neon-purple/90 to-neon-blue/80 text-white shadow-neon hover:brightness-110",
    ghost: "bg-white/5 text-zinc-200 hover:bg-white/10 border border-white/10",
    outline:
      "border border-neon-purple/50 text-neon-purple hover:bg-neon-purple/10 hover:border-neon-purple",
  };
  return (
    <button type={type} className={`${base} ${styles[variant]} ${className}`} {...rest}>
      {children}
    </button>
  );
}
