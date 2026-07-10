"use client";

import { AccountActionButtons, AccountCreateForm } from "@/components/dashboard/forms";
import { PollRefreshBanner } from "@/components/dashboard/poll-refresh-banner";
import { PageHeader } from "@/components/dashboard/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { usePollJson } from "@/hooks/use-poll-json";
import {
  ACCOUNTS_MUTATED_EVENT,
  ACCOUNTS_POLL_INTERVAL_MS,
  type AccountsOverviewSnapshot,
} from "@/lib/accounts-snapshots";
import { loginStateVariant } from "@/lib/accounts-ui";

type AccountsLiveListProps = {
  initial: AccountsOverviewSnapshot;
};

export function AccountsLiveList({ initial }: AccountsLiveListProps) {
  const { data, fetchError } = usePollJson({
    url: "/api/accounts/overview",
    intervalMs: ACCOUNTS_POLL_INTERVAL_MS,
    initialData: initial,
    mutateEventName: ACCOUNTS_MUTATED_EVENT,
    shouldPoll: (snapshot) => snapshot.needs_polling,
  });

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Telegram"
        title="Accounts"
        description="Onboard identities, run login flows, and refresh channel dialogs."
      />

      <PollRefreshBanner message={fetchError} />

      <Card>
        <CardContent className="p-6">
          <AccountCreateForm />
        </CardContent>
      </Card>

      {data.accounts.length === 0 ? (
        <EmptyState
          title="No accounts"
          description="Use the form above to add a phone number and start the Telegram login flow."
        />
      ) : (
        <ul className="space-y-4">
          {data.accounts.map((account) => (
            <li key={account.id}>
              <Card>
                <CardContent className="space-y-4 p-5">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-lg font-semibold text-foreground">{account.label}</h2>
                        <Badge variant={loginStateVariant(account.login_state)}>{account.login_state}</Badge>
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">{account.phone_number}</p>
                    </div>
                    <dl className="grid gap-2 text-xs sm:grid-cols-2 sm:gap-x-6">
                      <div>
                        <dt className="text-muted-foreground">API ID</dt>
                        <dd className="font-medium text-foreground">{account.api_id_override || "env default"}</dd>
                      </div>
                      <div>
                        <dt className="text-muted-foreground">API hash</dt>
                        <dd className="font-medium text-foreground">
                          {account.api_hash_configured ? "configured" : "env default"}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-muted-foreground">Telegram user</dt>
                        <dd className="font-medium text-foreground">{account.telegram_user_id || "—"}</dd>
                      </div>
                      <div>
                        <dt className="text-muted-foreground">Last connected</dt>
                        <dd className="font-medium text-foreground">{account.last_connected_at || "never"}</dd>
                      </div>
                    </dl>
                  </div>
                  <AccountActionButtons accountId={account.id} accountLabel={account.label} />
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}