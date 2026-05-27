"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const navigation = [
  { href: "/jobs/new", label: "New job", description: "Create a message transfer task" },
  { href: "/accounts", label: "Accounts", description: "Manage Telegram identities and dialogs" },
  { href: "/settings", label: "Settings", description: "Review environment-backed configuration" },
];

function isActivePath(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function DashboardNav() {
  const pathname = usePathname();

  return (
    <nav className="grid gap-3 px-4 py-4 sm:px-6 lg:grid-cols-3" aria-label="Dashboard navigation">
      {navigation.map((item) => {
        const active = isActivePath(pathname, item.href);

        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "group rounded-[var(--radius)] border border-border/70 bg-white/60 px-4 py-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.55)] transition duration-200 hover:-translate-y-0.5 hover:border-primary/20 hover:bg-white/85 hover:shadow-[0_18px_38px_-26px_color-mix(in_oklab,var(--primary)_45%,transparent)]",
              active && "border-primary/25 bg-primary/10 shadow-[0_18px_38px_-28px_color-mix(in_oklab,var(--primary)_55%,transparent),inset_0_1px_0_rgba(255,255,255,0.7)]",
            )}
          >
            <div className="flex items-center justify-between gap-3">
              <p className={cn("font-medium text-foreground transition group-hover:text-primary", active && "text-primary")}>{item.label}</p>
              <span className={cn("text-muted-foreground transition group-hover:text-primary", active && "text-primary")}>{active ? "•" : "→"}</span>
            </div>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">{item.description}</p>
          </Link>
        );
      })}
    </nav>
  );
}
