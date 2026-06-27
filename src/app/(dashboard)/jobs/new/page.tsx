import { PageHeader } from "@/components/dashboard/page-header";
import { JobCreateForm } from "@/components/dashboard/forms";
import { LinkButton } from "@/components/ui/link-button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { accountRepository, dialogRepository } from "@/lib/db/repositories";

export default function NewJobPage() {
  const accounts = accountRepository.list();
  const readyAccounts = accounts
    .filter((account) => account.login_state === "ready")
    .map((account) => ({
      id: account.id,
      label: account.label,
      phoneNumber: account.phone_number,
      dialogs: dialogRepository.listForAccount(account.id).map((dialog) => ({
        peerId: dialog.peer_id,
        title: dialog.title,
        username: dialog.username,
        entityType: dialog.entity_type,
        isPublic: Boolean(dialog.is_public),
      })),
    }));

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Create"
        title="New transfer job"
        description="Pick a ready account, source and target channels, and a message ID range."
        actions={
          <>
            <LinkButton href="/jobs" variant="secondary">
              All jobs
            </LinkButton>
            <LinkButton href="/accounts" variant="secondary">
              Accounts
            </LinkButton>
          </>
        }
      />

      <Card>
        <CardContent className="p-6">
          {readyAccounts.length === 0 ? (
            <EmptyState
              title="No ready accounts"
              description="Add an account, complete Telegram login, and refresh dialogs before creating a job."
            >
              <LinkButton href="/accounts">Go to accounts</LinkButton>
            </EmptyState>
          ) : (
            <JobCreateForm accounts={readyAccounts} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}