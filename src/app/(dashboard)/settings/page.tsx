import { PageHeader } from "@/components/dashboard/page-header";
import { Badge } from "@/components/ui/badge";
import { getBaseEnv } from "@/lib/env";

export default function SettingsPage() {
  const env = getBaseEnv();

  const settings = [
    {
      label: "DATABASE_URL",
      value: env.DATABASE_URL,
      description: "SQLite path shared by web and worker.",
      configured: Boolean(env.DATABASE_URL),
    },
    {
      label: "Telegram API ID",
      value: env.TELEGRAM_API_ID ? "configured" : "missing",
      description: "Default when an account has no override.",
      configured: Boolean(env.TELEGRAM_API_ID),
    },
    {
      label: "Telegram API hash",
      value: env.TELEGRAM_API_HASH ? "configured" : "missing",
      description: "Default application credentials.",
      configured: Boolean(env.TELEGRAM_API_HASH),
    },
    {
      label: "Encryption key",
      value: "configured",
      description: "Protects secrets in the database.",
      configured: true,
    },
    {
      label: "Admin password",
      value: "configured",
      description: "Dashboard login.",
      configured: true,
    },
  ] as const;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Runtime"
        title="Environment"
        description="Server-side values required before accounts and jobs can run."
      />

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {settings.map((setting) => (
          <div
            key={setting.label}
            className="rounded-lg border border-border/60 bg-background/80 px-4 py-3"
          >
            <div className="flex items-start justify-between gap-2">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">{setting.label}</p>
              <Badge variant={setting.configured ? "green" : "red"}>{setting.configured ? "ok" : "missing"}</Badge>
            </div>
            <p className="mt-1.5 font-mono text-sm font-semibold tabular-nums text-foreground break-all">{setting.value}</p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">{setting.description}</p>
          </div>
        ))}
      </div>
    </div>
  );
}