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
    <nav className="flex flex-col gap-2" aria-label="Dashboard navigation">
      {navigation.map((item) => {
        const active = isActivePath(pathname, item.href);

        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "group rounded-[calc(var(--radius)+0.125rem)] border border-transparent px-3.5 py-3 transition duration-200",
              active
                ? "border-primary/18 bg-primary/10 shadow-[0_14px_32px_-26px_color-mix(in_oklab,var(--primary)_34%,transparent)]"
                : "bg-transparent hover:border-border/60 hover:bg-white/45",
            )}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className={cn("h-1.5 w-1.5 rounded-full bg-muted-foreground/35 transition", active && "bg-primary")} />
                  <p className={cn("font-medium text-foreground transition group-hover:text-foreground", active && "text-primary")}>{item.label}</p>
                </div>
                <p className="pl-3.5 text-sm leading-5 text-muted-foreground">{item.description}</p>
              </div>
              <span className={cn("mt-0.5 inline-flex min-w-4 justify-end text-[11px] text-muted-foreground/70 transition", active && "text-primary")}>{active ? "●" : "→"}</span>
            </div>
          </Link>
        );
      })}
    </nav>
  );
}
