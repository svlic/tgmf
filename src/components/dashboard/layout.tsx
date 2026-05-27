import Link from "next/link";
import { APP_NAME } from "@/lib/constants";
import { LogoutButton } from "@/components/dashboard/forms";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const navigation = [
  { href: "/jobs/new", label: "New job", description: "Create a message transfer task" },
  { href: "/accounts", label: "Accounts", description: "Manage Telegram identities and dialogs" },
  { href: "/settings", label: "Settings", description: "Review environment-backed configuration" },
];

export function DashboardLayoutShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-background text-foreground">
      <div className="grid-noise absolute inset-x-0 top-0 h-80" />
      <div className="absolute inset-x-0 top-0 h-96 bg-[radial-gradient(circle_at_top,_color-mix(in_oklab,var(--primary)_18%,transparent),_transparent_48%),linear-gradient(180deg,_color-mix(in_oklab,white_68%,transparent),_transparent)]" />
      <div className="relative mx-auto flex min-h-screen w-full max-w-7xl flex-col px-4 py-4 sm:px-6 lg:px-8">
        <header className="surface-glass surface-panel mb-6 overflow-hidden rounded-[calc(var(--radius-xl)+0.25rem)] border border-border/70 shadow-[0_24px_80px_-36px_color-mix(in_oklab,var(--foreground)_22%,transparent)]">
          <div className="flex flex-col gap-6 border-b border-border/70 px-6 py-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-3">
              <Badge variant="blue" className="w-fit">Telegram migration console</Badge>
              <div className="space-y-1.5">
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">Admin workspace</p>
                <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">{APP_NAME}</h1>
                <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
                  Operate account onboarding, worker health, and message transfer jobs from one focused dashboard.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 self-start lg:self-auto">
              <LogoutButton />
            </div>
          </div>
          <div className="grid gap-3 px-4 py-4 sm:px-6 lg:grid-cols-3">
            {navigation.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "group rounded-[var(--radius)] border border-border/70 bg-white/60 px-4 py-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.55)] transition duration-200 hover:-translate-y-0.5 hover:border-primary/20 hover:bg-white/85 hover:shadow-[0_18px_38px_-26px_color-mix(in_oklab,var(--primary)_45%,transparent)]",
                )}
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="font-medium text-foreground transition group-hover:text-primary">{item.label}</p>
                  <span className="text-muted-foreground transition group-hover:text-primary">→</span>
                </div>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{item.description}</p>
              </Link>
            ))}
          </div>
        </header>
        <main className="flex flex-1 flex-col gap-6 pb-10">{children}</main>
      </div>
    </div>
  );
}

