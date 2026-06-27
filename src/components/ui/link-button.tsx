import type { ReactNode } from "react";
import Link from "next/link";
import { buttonVariants, type ButtonSize, type ButtonVariant } from "@/components/ui/button-variants";
import { cn } from "@/lib/utils";

type LinkButtonProps = {
  href: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
  children: ReactNode;
};

export function LinkButton({ href, variant = "default", size = "default", className, children }: LinkButtonProps) {
  return (
    <Link href={href} className={cn(buttonVariants({ variant, size }), className)}>
      {children}
    </Link>
  );
}