import { APP_NAME } from "@/lib/constants";
import { LogoutButton } from "@/components/dashboard/forms";
import { DashboardNav } from "@/components/dashboard/nav";
import { Badge } from "@/components/ui/badge";

export function DashboardLayoutShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-[linear-gradient(180deg,color-mix(in_oklab,white_78%,transparent),transparent_24%),var(--background)] text-foreground">
      <div className="grid-noise absolute inset-x-0 top-0 h-56 opacity-80" />
      <div className="absolute inset-x-0 top-0 h-72 bg-[radial-gradient(circle_at_top,_color-mix(in_oklab,var(--primary)_10%,transparent),_transparent_52%)]" />
      <div className="relative mx-auto flex min-h-screen w-full max-w-[1500px] px-4 py-4 sm:px-6 lg:px-8">
        <div className="grid min-h-full w-full gap-6 xl:grid-cols-[280px_minmax(0,1fr)]">
          <aside className="flex h-full flex-col gap-5 rounded-[calc(var(--radius-xl)+0.125rem)] border border-border bg-white/70 p-5 shadow-[0_18px_42px_-30px_color-mix(in_oklab,var(--foreground)_14%,transparent)] backdrop-blur xl:sticky xl:top-4 xl:h-[calc(100vh-2rem)] xl:overflow-hidden">
            <div className="space-y-3.5 border-b border-border/70 pb-4">
              <Badge variant="blue" className="w-fit text-[10px] tracking-[0.06em]">Telegram migration console</Badge>
              <div className="space-y-1">
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Admin workspace</p>
                <h1 className="text-2xl font-bold tracking-tight text-foreground">{APP_NAME}</h1>
                <p className="text-xs leading-5 text-muted-foreground">
                  A calmer control surface for accounts, workers, and transfer operations.
                </p>
              </div>
            </div>
            <div className="min-h-0 flex-1 overflow-auto py-1">
              <DashboardNav />
            </div>
            <div className="border-t border-border/50 pt-4">
              <LogoutButton />
            </div>
          </aside>
          <main className="flex min-w-0 flex-1 flex-col pb-10">{children}</main>
        </div>
      </div>
    </div>
  );
}

