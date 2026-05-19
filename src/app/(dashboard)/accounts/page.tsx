import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AccountActionButtons, AccountCreateForm } from "@/components/dashboard/forms";
import { accountRepository, dialogRepository } from "@/lib/db/repositories";
import { redactSecret } from "@/lib/utils";

export default function AccountsPage() {
  const accounts = accountRepository.list();

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Telegram accounts</CardTitle>
        </CardHeader>
        <CardContent>
          <AccountCreateForm />
        </CardContent>
      </Card>

      {accounts.map((account) => {
        const dialogs = dialogRepository.listForAccount(account.id);
        return (
          <Card key={account.id}>
            <CardHeader>
              <CardTitle>{account.label}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-2 text-sm text-slate-600 md:grid-cols-2">
                <p><strong>Phone:</strong> {account.phone_number}</p>
                <p><strong>Login state:</strong> {account.login_state}</p>
                <p><strong>API ID override:</strong> {account.api_id_override || "env default"}</p>
                <p><strong>API hash override:</strong> {account.api_hash_override_encrypted ? redactSecret("configured") : "env default"}</p>
                <p><strong>Telegram user id:</strong> {account.telegram_user_id || "—"}</p>
                <p><strong>Last connected:</strong> {account.last_connected_at || "never"}</p>
              </div>
              <AccountActionButtons accountId={account.id} />
              <div>
                <h3 className="mb-2 text-sm font-semibold text-slate-950">Cached dialogs</h3>
                <table>
                  <thead>
                    <tr>
                      <th>Title</th>
                      <th>Peer ID</th>
                      <th>Type</th>
                      <th>Public</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dialogs.map((dialog) => (
                      <tr key={dialog.id}>
                        <td>{dialog.title}</td>
                        <td><code>{dialog.peer_id}</code></td>
                        <td>{dialog.entity_type}</td>
                        <td>{dialog.is_public ? "yes" : "no"}</td>
                      </tr>
                    ))}
                    {dialogs.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="text-sm text-slate-500">No dialogs cached yet.</td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        );
      })}
      {accounts.length === 0 ? <p className="text-sm text-slate-500">No Telegram accounts configured yet.</p> : null}
    </div>
  );
}
