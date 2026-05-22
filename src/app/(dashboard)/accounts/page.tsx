import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AccountActionButtons, AccountCreateForm } from "@/components/dashboard/forms";
import { accountRepository, dialogRepository } from "@/lib/db/repositories";
import { redactSecret } from "@/lib/utils";
import {
  DataTable,
  DataTableBody,
  DataTableCell,
  DataTableHead,
  DataTableHeader,
  DataTableRow,
} from "@/components/ui/data-table";
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
      <Card>
        <CardHeader>
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
          description="Create an account to start the Telegram login flow, test connectivity, and cache available dialogs."
        />
      ) : null}

      {accounts.map((account) => {
        const dialogs = dialogRepository.listForAccount(account.id);
        return (
          <Card key={account.id}>
            <CardHeader className="gap-4">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-3">
                    <CardTitle>{account.label}</CardTitle>
                    <Badge variant={loginStateVariant(account.login_state)}>{account.login_state}</Badge>
                  </div>
                  <CardDescription>{account.phone_number}</CardDescription>
                </div>
                <div className="grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600 sm:grid-cols-2 xl:min-w-[460px]">
                  <div>
                    <p className="text-xs uppercase tracking-[0.18em] text-slate-400">API ID</p>
                    <p className="mt-1 font-medium text-slate-900">{account.api_id_override || "env default"}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.18em] text-slate-400">API hash</p>
                    <p className="mt-1 font-medium text-slate-900">{account.api_hash_override_encrypted ? redactSecret("configured") : "env default"}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Telegram user</p>
                    <p className="mt-1 font-medium text-slate-900">{account.telegram_user_id || "—"}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Last connected</p>
                    <p className="mt-1 font-medium text-slate-900">{account.last_connected_at || "never"}</p>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-slate-900">Account actions</p>
                    <p className="text-sm text-slate-500">Drive the login flow and refresh cached dialogs for this account.</p>
                  </div>
                </div>
                <AccountActionButtons accountId={account.id} />
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">Cached dialogs</h3>
                    <p className="mt-1 text-sm text-slate-500">Dialogs discovered from the most recent refresh for this account.</p>
                  </div>
                  <Badge variant="slate">{dialogs.length} cached</Badge>
                </div>
                {dialogs.length === 0 ? (
                  <EmptyState
                    title="No dialogs cached yet"
                    description="Use Refresh dialogs after the account is authenticated to pull channel and chat metadata into the dashboard."
                  />
                ) : (
                  <DataTable>
                    <DataTableHead>
                      <DataTableRow>
                        <DataTableHeader>Title</DataTableHeader>
                        <DataTableHeader>Peer ID</DataTableHeader>
                        <DataTableHeader>Type</DataTableHeader>
                        <DataTableHeader>Visibility</DataTableHeader>
                      </DataTableRow>
                    </DataTableHead>
                    <DataTableBody>
                      {dialogs.map((dialog) => (
                        <DataTableRow key={dialog.id}>
                          <DataTableCell className="font-medium text-slate-900">{dialog.title}</DataTableCell>
                          <DataTableCell>
                            <code className="rounded-md bg-slate-100 px-2 py-1 text-xs text-slate-700">{dialog.peer_id}</code>
                          </DataTableCell>
                          <DataTableCell>{dialog.entity_type}</DataTableCell>
                          <DataTableCell>
                            <Badge variant={dialog.is_public ? "green" : "amber"}>{dialog.is_public ? "public" : "private"}</Badge>
                          </DataTableCell>
                        </DataTableRow>
                      ))}
                    </DataTableBody>
                  </DataTable>
                )}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
