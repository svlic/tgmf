import Link from "next/link";
import { APP_NAME } from "@/lib/constants";
import { LogoutButton } from "@/components/dashboard/forms";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const navigation = [
  { href: "/", label: "Overview", description: "Status, job creation, and recent activity" },
  { href: "/accounts", label: "Accounts", description: "Manage Telegram identities and dialogs" },
  { href: "/settings", label: "Settings", description: "Review environment-backed configuration" },
];

export function DashboardLayoutShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-100 text-slate-950">
      <div className="absolute inset-x-0 top-0 h-72 bg-gradient-to-b from-sky-100 via-white to-transparent" />
      <div className="relative mx-auto flex min-h-screen w-full max-w-7xl flex-col px-4 py-4 sm:px-6 lg:px-8">
        <header className="mb-6 overflow-hidden rounded-[28px] border border-slate-200/80 bg-white/95 shadow-sm shadow-slate-950/5 backdrop-blur">
          <div className="flex flex-col gap-6 border-b border-slate-100 px-6 py-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-3">
              <Badge variant="blue" className="w-fit">Telegram migration console</Badge>
              <div className="space-y-1">
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Admin workspace</p>
                <h1 className="text-2xl font-semibold tracking-tight text-slate-950 sm:text-3xl">{APP_NAME}</h1>
                <p className="max-w-2xl text-sm leading-6 text-slate-500">
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
                  "group rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-4 transition hover:border-sky-200 hover:bg-sky-50/70 hover:shadow-sm",
                )}
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="font-medium text-slate-900 transition group-hover:text-sky-700">{item.label}</p>
                  <span className="text-slate-300 transition group-hover:text-sky-400">→</span>
                </div>
                <p className="mt-2 text-sm leading-6 text-slate-500">{item.description}</p>
              </Link>
            ))}
          </div>
        </header>
        <main className="flex flex-1 flex-col gap-6 pb-10">{children}</main>
      </div>
    </div>
  );
}
