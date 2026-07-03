import type { ReactNode } from "react";
import Link from "next/link";
import { buttonVariants, type ButtonSize, type ButtonVariant } from "@/components/ui/button-variants";

type LinkButtonProps = {
  href: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
  children: ReactNode;
};

export function LinkButton({ href, variant = "default", size = "default", className, children }: LinkButtonProps) {
  return (
    <Link href={href} className={buttonVariants({ variant, size, className })}>
      {children}
    </Link>
  );
}