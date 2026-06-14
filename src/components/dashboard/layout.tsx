import { APP_NAME } from "@/lib/constants";
import { LogoutButton } from "@/components/dashboard/forms";
import { DashboardNav } from "@/components/dashboard/nav";
import { Badge } from "@/components/ui/badge";

export function DashboardLayoutShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-background text-foreground">
      <div className="grid-noise absolute inset-x-0 top-0 h-80" />
      <div className="absolute inset-x-0 top-0 h-96 bg-[radial-gradient(circle_at_top,_color-mix(in_oklab,var(--primary)_18%,transparent),_transparent_48%),linear-gradient(180deg,_color-mix(in_oklab,white_68%,transparent),_transparent)]" />
      <div className="relative mx-auto flex min-h-screen w-full max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
        <div className="flex min-h-full w-full flex-col gap-6 lg:flex-row">
          <aside className="surface-glass surface-panel h-fit overflow-hidden rounded-[calc(var(--radius-xl)+0.25rem)] border border-border/70 shadow-[0_24px_80px_-36px_color-mix(in_oklab,var(--foreground)_22%,transparent)] lg:sticky lg:top-4 lg:w-[320px] lg:min-w-[320px]">
            <div className="border-b border-border/70 px-6 py-6">
              <div className="space-y-3">
                <Badge variant="blue" className="w-fit">Telegram migration console</Badge>
                <div className="space-y-1.5">
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">Admin workspace</p>
                  <h1 className="text-2xl font-semibold tracking-tight text-foreground">{APP_NAME}</h1>
                  <p className="text-sm leading-6 text-muted-foreground">
                    Operate account onboarding, worker health, and message transfer jobs from one focused dashboard.
                  </p>
                </div>
              </div>
            </div>
            <div className="px-4 py-4 sm:px-6">
              <DashboardNav />
            </div>
            <div className="border-t border-border/70 px-6 py-5">
              <LogoutButton />
            </div>
          </aside>
          <main className="flex min-w-0 flex-1 flex-col gap-6 pb-10">{children}</main>
        </div>
      </div>
    </div>
  );
}

