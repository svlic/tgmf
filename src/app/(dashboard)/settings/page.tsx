import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getBaseEnv } from "@/lib/env";

export default function SettingsPage() {
  const env = getBaseEnv();

  const settings = [
    {
      label: "DATABASE_URL",
      value: env.DATABASE_URL,
      description: "SQLite database location shared by the web app and worker.",
      configured: Boolean(env.DATABASE_URL),
    },
    {
      label: "Default Telegram API ID",
      value: env.TELEGRAM_API_ID ? "configured" : "missing",
      description: "Fallback API ID used when an account does not provide an override.",
      configured: Boolean(env.TELEGRAM_API_ID),
    },
    {
      label: "Default Telegram API hash",
      value: env.TELEGRAM_API_HASH ? "configured" : "missing",
      description: "Fallback API hash used with the default Telegram application credentials.",
      configured: Boolean(env.TELEGRAM_API_HASH),
    },
    {
      label: "App encryption key",
      value: "configured at runtime",
      description: "Protects encrypted secrets stored in the database.",
      configured: true,
    },
    {
      label: "Admin password",
      value: "configured at runtime",
      description: "Controls access to the administrative dashboard.",
      configured: true,
    },
  ];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardDescription>Runtime-backed configuration</CardDescription>
          <CardTitle>Environment settings</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {settings.map((setting) => (
            <div key={setting.label} className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-medium text-slate-900">{setting.label}</p>
                <Badge variant={setting.configured ? "green" : "red"}>{setting.configured ? "configured" : "missing"}</Badge>
              </div>
              <p className="mt-3 text-sm font-medium text-slate-700">{setting.value}</p>
              <p className="mt-2 text-sm leading-6 text-slate-500">{setting.description}</p>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
