import type { ReactNode } from "react";
import { APP_NAME } from "@/lib/constants";
import { LogoutButton } from "@/components/dashboard/forms";
import { DashboardNav } from "@/components/dashboard/nav";

export function DashboardLayoutShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="border-b border-border/60 px-4 py-3 xl:hidden">
        <div className="mx-auto flex max-w-[1400px] flex-col gap-3">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-semibold text-foreground">{APP_NAME}</p>
            <LogoutButton />
          </div>
          <DashboardNav />
        </div>
      </div>
      <div className="mx-auto flex min-h-screen w-full max-w-[1400px] gap-6 px-4 py-6 sm:px-6 lg:px-8">
        <aside className="hidden w-56 shrink-0 flex-col gap-6 xl:flex xl:sticky xl:top-6 xl:self-start xl:max-h-[calc(100vh-3rem)]">
          <div className="space-y-1 border-b border-border/60 pb-5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Admin</p>
            <h1 className="text-lg font-semibold tracking-tight text-foreground">{APP_NAME}</h1>
            <p className="text-xs leading-5 text-muted-foreground">Accounts, jobs, and worker status.</p>
          </div>
          <div className="min-h-0 flex-1 overflow-auto">
            <DashboardNav />
          </div>
          <div className="border-t border-border/60 pt-4">
            <LogoutButton />
          </div>
        </aside>
        <main className="min-w-0 flex-1 pb-10">{children}</main>
      </div>
    </div>
  );
}