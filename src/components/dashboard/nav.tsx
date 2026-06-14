"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const navigation = [
  { href: "/jobs", label: "Jobs", description: "Track lifecycle, progress, and recovery actions" },
  { href: "/accounts", label: "Accounts", description: "Manage Telegram identities and login readiness" },
  { href: "/settings", label: "Settings", description: "Review environment-backed configuration" },
];

function isActivePath(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function DashboardNav() {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-1.5" aria-label="Dashboard navigation">
      {navigation.map((item) => {
        const active = isActivePath(pathname, item.href);

        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "group rounded-[var(--radius)] border border-transparent bg-transparent px-3.5 py-2.5 transition duration-200 hover:border-primary/12 hover:bg-white/55 hover:shadow-[0_14px_30px_-26px_color-mix(in_oklab,var(--primary)_28%,transparent)]",
              active && "border-primary/18 bg-primary/9 shadow-[0_16px_34px_-28px_color-mix(in_oklab,var(--primary)_42%,transparent),inset_0_1px_0_rgba(255,255,255,0.75)]",
            )}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-0.5">
                <p className={cn("font-medium text-foreground transition group-hover:text-primary", active && "text-primary")}>{item.label}</p>
                <p className="text-sm leading-5 text-muted-foreground/90">{item.description}</p>
              </div>
              <span className={cn("mt-0.5 inline-flex min-w-4 justify-end text-[11px] text-muted-foreground/80 transition group-hover:text-primary", active && "text-primary")}>{active ? "●" : "→"}</span>
            </div>
          </Link>
        );
      })}
    </nav>
  );
}
