import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { JobCreateForm } from "@/components/dashboard/forms";
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
      <Card className="surface-glass surface-panel border-border/70 shadow-[0_28px_64px_-38px_color-mix(in_oklab,var(--foreground)_18%,transparent)]">
        <CardHeader className="gap-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-3">
                <CardTitle>Create transfer job</CardTitle>
                <Badge variant="blue">New job</Badge>
              </div>
              <CardDescription>
                Queue a Telegram message transfer by choosing a logged-in account, source and target channels, and a message ID range.
              </CardDescription>
            </div>
            <Link
              href="/accounts"
              className="inline-flex h-10 items-center justify-center rounded-[calc(var(--radius)-0.125rem)] border border-border/80 bg-white/75 px-4 py-2 text-sm font-medium text-secondary-foreground shadow-sm shadow-black/5 backdrop-blur transition-all duration-200 ease-out hover:-translate-y-0.5 hover:border-primary/20 hover:bg-white hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/70 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              Manage accounts
            </Link>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          {readyAccounts.length === 0 ? (
            <EmptyState
              className="border-warning/45 bg-[color:color-mix(in_oklab,var(--warning)_14%,white)]"
              title="Authenticate an account before creating a job"
              description="A transfer job needs a ready Telegram account. Add an account, complete login, then refresh dialogs to unlock this form."
            >
              <Link
                href="/accounts"
                className="inline-flex h-10 items-center justify-center rounded-[calc(var(--radius)-0.125rem)] border border-primary/20 bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-[0_16px_36px_-18px_color-mix(in_oklab,var(--primary)_70%,transparent)] transition-all duration-200 ease-out hover:-translate-y-0.5 hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/70 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              >
                Manage accounts
              </Link>
            </EmptyState>
          ) : (
            <JobCreateForm accounts={readyAccounts} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
