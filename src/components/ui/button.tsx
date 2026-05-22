import * as React from "react";
import { cn } from "@/lib/utils";

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "default" | "secondary" | "danger" | "ghost";
  size?: "default" | "sm" | "lg";
};

export function Button({ className, variant = "default", size = "default", ...props }: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-[calc(var(--radius)-0.125rem)] border text-sm font-medium transition-all duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/70 focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50",
        size === "default" && "h-10 px-4 py-2",
        size === "sm" && "h-8 px-3 text-xs",
        size === "lg" && "h-11 px-5 text-sm",
        variant === "default" && "border-primary/90 bg-primary text-primary-foreground shadow-[0_16px_36px_-18px_color-mix(in_oklab,var(--primary)_70%,transparent)] hover:-translate-y-0.5 hover:border-primary hover:brightness-110",
        variant === "secondary" && "border-border/80 bg-white/75 text-secondary-foreground shadow-sm shadow-black/5 backdrop-blur hover:-translate-y-0.5 hover:border-primary/20 hover:bg-white hover:text-foreground",
        variant === "danger" && "border-destructive/90 bg-destructive text-destructive-foreground shadow-[0_16px_34px_-18px_color-mix(in_oklab,var(--destructive)_65%,transparent)] hover:-translate-y-0.5 hover:brightness-105",
        variant === "ghost" && "border-transparent bg-transparent text-muted-foreground hover:bg-accent/80 hover:text-accent-foreground",
        className,
      )}
      {...props}
    />
  );
}
