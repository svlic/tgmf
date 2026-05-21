import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getBaseEnv } from "@/lib/env";

export default function SettingsPage() {
  const env = getBaseEnv();

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Environment-backed settings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-slate-600">
          <p><strong>DATABASE_URL:</strong> {env.DATABASE_URL}</p>
          <p><strong>Default Telegram API ID:</strong> {env.TELEGRAM_API_ID ? "configured" : "missing"}</p>
          <p><strong>Default Telegram API hash:</strong> {env.TELEGRAM_API_HASH ? "configured" : "missing"}</p>
          <p><strong>App encryption key:</strong> configured at runtime</p>
          <p><strong>Admin password:</strong> configured at runtime</p>
        </CardContent>
      </Card>
    </div>
  );
}
