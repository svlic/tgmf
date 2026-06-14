import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AccountActionButtons, AccountCreateForm } from "@/components/dashboard/forms";
import { accountRepository } from "@/lib/db/repositories";
import { redactSecret } from "@/lib/utils";
import { EmptyState } from "@/components/ui/empty-state";

function loginStateVariant(status: string) {
  if (status === "ready") {
    return "green" as const;
  }

  if (status === "failed") {
    return "red" as const;
  }

  return "amber" as const;
}

export default function AccountsPage() {
  const accounts = accountRepository.list();

  return (
    <div className="space-y-6">
      <Card className="surface-glass surface-panel border-border/70 shadow-[0_28px_64px_-38px_color-mix(in_oklab,var(--foreground)_18%,transparent)]">
        <CardHeader className="gap-1.5">
          <CardDescription>Onboard Telegram identities</CardDescription>
          <CardTitle>Telegram accounts</CardTitle>
        </CardHeader>
        <CardContent>
          <AccountCreateForm />
        </CardContent>
      </Card>

      {accounts.length === 0 ? (
        <EmptyState
          title="No Telegram accounts configured"
          description="Create an account above to start the Telegram login flow, test connectivity, and cache available dialogs."
        >
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">Start with the account form at the top of this page.</p>
        </EmptyState>
      ) : null}

      {accounts.map((account) => {
        return (
          <Card key={account.id} className="surface-glass surface-panel border-border/70 shadow-[0_28px_64px_-38px_color-mix(in_oklab,var(--foreground)_18%,transparent)]">
            <CardHeader className="gap-3">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="max-w-2xl space-y-2">
                  <div className="flex flex-wrap items-center gap-3">
                    <CardTitle>{account.label}</CardTitle>
                    <Badge variant={loginStateVariant(account.login_state)}>{account.login_state}</Badge>
                  </div>
                  <CardDescription className="leading-5">{account.phone_number}</CardDescription>
                </div>
                <div className="surface-glass grid gap-2.5 rounded-(--radius-xl) border border-border/70 bg-white/55 p-3.5 text-sm text-muted-foreground sm:grid-cols-2 xl:min-w-[380px]">
                  <div>
                    <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">API ID</p>
                    <p className="mt-1 font-medium text-foreground">{account.api_id_override || "env default"}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">API hash</p>
                    <p className="mt-1 font-medium text-foreground">{account.api_hash_override_encrypted ? redactSecret("configured") : "env default"}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Telegram user</p>
                    <p className="mt-1 font-medium text-foreground">{account.telegram_user_id || "—"}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Last connected</p>
                    <p className="mt-1 font-medium text-foreground">{account.last_connected_at || "never"}</p>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="surface-glass rounded-(--radius-xl) border border-border/70 bg-white/55 p-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-foreground">Account actions</p>
                    <p className="text-sm leading-5 text-muted-foreground">Drive login, verify readiness, and refresh dialogs for future job setup.</p>
                  </div>
                </div>
                <AccountActionButtons accountId={account.id} />
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
