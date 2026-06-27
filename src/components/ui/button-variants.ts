import { cn } from "@/lib/utils";

export type ButtonVariant = "default" | "secondary" | "danger" | "ghost";
export type ButtonSize = "default" | "sm" | "lg";

const base =
  "inline-flex items-center justify-center gap-2 rounded-md border text-sm font-medium transition-colors duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 active:translate-y-px";

const variants: Record<ButtonVariant, string> = {
  default: "border-primary bg-primary text-primary-foreground hover:bg-primary/90",
  secondary: "border-border bg-card text-foreground hover:bg-muted",
  danger: "border-destructive bg-destructive text-destructive-foreground hover:bg-destructive/90",
  ghost: "border-transparent bg-transparent text-muted-foreground hover:bg-accent hover:text-accent-foreground",
};

const sizes: Record<ButtonSize, string> = {
  default: "h-10 px-4 py-2",
  sm: "h-8 px-3 text-xs",
  lg: "h-11 px-5",
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