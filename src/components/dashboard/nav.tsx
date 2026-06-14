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
              "group rounded-[var(--radius)] border border-transparent bg-transparent px-4 py-3 transition duration-200 hover:border-primary/15 hover:bg-white/70 hover:shadow-[0_18px_38px_-30px_color-mix(in_oklab,var(--primary)_40%,transparent)]",
              active && "border-primary/20 bg-primary/10 shadow-[0_18px_38px_-30px_color-mix(in_oklab,var(--primary)_50%,transparent),inset_0_1px_0_rgba(255,255,255,0.75)]",
            )}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className={cn("font-medium text-foreground transition group-hover:text-primary", active && "text-primary")}>{item.label}</p>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">{item.description}</p>
              </div>
              <span className={cn("pt-0.5 text-muted-foreground transition group-hover:text-primary", active && "text-primary")}>{active ? "•" : "→"}</span>
            </div>
          </Link>
        );
      })}
    </nav>
  );
}
