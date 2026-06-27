import { cn } from "@/lib/utils";

export type ButtonVariant = "default" | "secondary" | "danger" | "ghost";
export type ButtonSize = "default" | "sm" | "lg";

const base =
  "inline-flex items-center justify-center gap-2 rounded-[calc(var(--radius)-0.125rem)] border text-sm font-medium transition-all duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/70 focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 active:translate-y-px";

const variants: Record<ButtonVariant, string> = {
  default:
    "border-primary/90 bg-primary text-primary-foreground shadow-[0_12px_28px_-16px_color-mix(in_oklab,var(--primary)_65%,transparent)] hover:-translate-y-0.5 hover:border-primary hover:brightness-110",
  secondary:
    "border-border/80 bg-white/80 text-secondary-foreground shadow-sm shadow-black/5 hover:-translate-y-0.5 hover:border-primary/20 hover:bg-white hover:text-foreground",
  danger:
    "border-destructive/90 bg-destructive text-destructive-foreground shadow-[0_12px_28px_-16px_color-mix(in_oklab,var(--destructive)_55%,transparent)] hover:-translate-y-0.5 hover:brightness-105",
  ghost: "border-transparent bg-transparent text-muted-foreground hover:bg-accent/80 hover:text-accent-foreground",
};

const sizes: Record<ButtonSize, string> = {
  default: "h-10 px-4 py-2",
  sm: "h-8 px-3 text-xs",
  lg: "h-11 px-5 text-sm",
};

export function buttonVariants({
  variant = "default",
  size = "default",
  className,
}: {
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
}) {
  return cn(base, sizes[size], variants[variant], className);
}