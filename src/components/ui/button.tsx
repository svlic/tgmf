import * as React from "react";
import { buttonVariants } from "@/components/ui/button-variants";
import type { ButtonSize, ButtonVariant } from "@/components/ui/button-variants";

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
};

export function Button({ className, variant = "default", size = "default", ...props }: ButtonProps) {
  return <button className={buttonVariants({ variant, size, className })} {...props} />;
}
