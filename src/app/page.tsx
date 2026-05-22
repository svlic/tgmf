import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  AccountActionPanel,
  AccountCreateForm,
  JobActionButtons,
  JobCreateForm,
} from "@/components/dashboard/forms";
import {
  DataTable,
  DataTableBody,
  DataTableCell,
  DataTableHead,
  DataTableHeader,
  DataTableRow,
} from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { getDashboardData } from "@/lib/server";

function statusVariant(status: string) {
  if (["ready", "healthy", "completed"].includes(status)) {
    return "green" as const;
  }

  if (["running", "pending", "claimed", "forward", "copy"].includes(status)) {
    return "blue" as const;
  }

  if (["failed", "offline", "cancelled"].includes(status)) {
    return "red" as const;
  }

  return "amber" as const;
}

export default async function HomePage() {
  const dashboard = getDashboardData();
  const activeJobs = dashboard.jobs.filter((job) => ["pending", "running", "claimed"].includes(job.status)).length;
  const readyAccounts = dashboard.accounts.filter((account) => account.login_state === "ready").length;
  const failedJobs = dashboard.jobs.filter((job) => job.status === "failed").length;
  const workerStatus = dashboard.latestWorker?.status ?? "offline";
  const workerFreshness = dashboard.isWorkerStale ? "stale" : "healthy";

  return (
    <div className="space-y-6">
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card className="surface-hero relative overflow-hidden border-border/20 text-primary-foreground shadow-[0_28px_70px_-34px_color-mix(in_oklab,var(--foreground)_36%,transparent)]">
          <CardHeader className="border-b border-white/10">
            <CardDescription className="text-primary-foreground/72">Worker health</CardDescription>
            <CardTitle className="text-3xl text-primary-foreground">{workerStatus}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-primary-foreground/76">
            <div className="flex items-center justify-between gap-3 rounded-[calc(var(--radius)-0.125rem)] border border-white/10 bg-white/6 px-3 py-2 backdrop-blur-sm">
              <span>Freshness</span>
              <Badge variant={workerFreshness === "healthy" ? "green" : "amber"}>{workerFreshness}</Badge>
            </div>
            <div className="flex items-center justify-between gap-3 rounded-[calc(var(--radius)-0.125rem)] border border-white/10 bg-white/6 px-3 py-2 backdrop-blur-sm">
              <span>Current job</span>
              <span className="font-medium text-primary-foreground">{dashboard.latestWorker?.current_job_id ?? "—"}</span>
            </div>
            <p className="text-xs text-primary-foreground/58">Last heartbeat: {dashboard.latestWorker?.heartbeat_at ?? "never"}</p>
          </CardContent>
        </Card>
        <Card className="surface-glass surface-panel border-border/70 shadow-[0_22px_54px_-34px_color-mix(in_oklab,var(--foreground)_18%,transparent)]">
          <CardHeader>
            <CardDescription>Accounts ready to run</CardDescription>
            <CardTitle className="text-3xl text-foreground">{readyAccounts}</CardTitle>
          </CardHeader>
          <CardContent className="text-sm leading-6 text-muted-foreground">
            {dashboard.accounts.length} total accounts configured for Telegram login and dialog refresh.
          </CardContent>
        </Card>
        <Card className="surface-glass surface-panel border-border/70 shadow-[0_22px_54px_-34px_color-mix(in_oklab,var(--foreground)_18%,transparent)]">
          <CardHeader>
            <CardDescription>Active jobs</CardDescription>
            <CardTitle className="text-3xl text-foreground">{activeJobs}</CardTitle>
          </CardHeader>
          <CardContent className="text-sm leading-6 text-muted-foreground">
            Jobs currently pending, running, or claimed by the worker.
          </CardContent>
        </Card>
        <Card className="surface-glass surface-panel border-border/70 shadow-[0_22px_54px_-34px_color-mix(in_oklab,var(--foreground)_18%,transparent)]">
          <CardHeader>
            <CardDescription>Failed jobs</CardDescription>
            <CardTitle className="text-3xl text-foreground">{failedJobs}</CardTitle>
          </CardHeader>
          <CardContent className="text-sm leading-6 text-muted-foreground">
            Retry or inspect failed work from the recent jobs table below.
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.3fr_0.9fr]">
        <Card className="surface-glass surface-panel border-border/70 shadow-[0_28px_64px_-38px_color-mix(in_oklab,var(--foreground)_18%,transparent)]">
          <CardHeader>
            <CardDescription>Queue new work</CardDescription>
            <CardTitle>Create sync job</CardTitle>
          </CardHeader>
          <CardContent>
            <JobCreateForm accounts={dashboard.accounts.map((account) => ({ id: account.id, label: account.label }))} />
          </CardContent>
        </Card>
        <Card className="surface-glass surface-panel border-border/70 shadow-[0_28px_64px_-38px_color-mix(in_oklab,var(--foreground)_18%,transparent)]">
          <CardHeader>
            <CardDescription>Add operator credentials</CardDescription>
            <CardTitle>Create Telegram account</CardTitle>
          </CardHeader>
          <CardContent>
            <AccountCreateForm />
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.35fr_0.65fr]">
        <Card className="surface-glass surface-panel border-border/70 shadow-[0_28px_64px_-38px_color-mix(in_oklab,var(--foreground)_18%,transparent)]">
          <CardHeader className="gap-2">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <CardDescription>Operational timeline</CardDescription>
                <CardTitle>Recent jobs</CardTitle>
              </div>
              <p className="text-sm leading-6 text-muted-foreground">Open a job to inspect detailed transfer records and error history.</p>
            </div>
          </CardHeader>
          <CardContent>
            {dashboard.jobs.length === 0 ? (
              <EmptyState
                title="No jobs created yet"
                description="Create your first sync job to start moving messages between Telegram channels."
              />
            ) : (
              <DataTable>
                <DataTableHead>
                  <DataTableRow>
                    <DataTableHeader>Job</DataTableHeader>
                    <DataTableHeader>Range</DataTableHeader>
                    <DataTableHeader>Mode</DataTableHeader>
                    <DataTableHeader>Status</DataTableHeader>
                    <DataTableHeader>Progress</DataTableHeader>
                    <DataTableHeader className="min-w-[220px]">Actions</DataTableHeader>
                  </DataTableRow>
                </DataTableHead>
                <DataTableBody>
                  {dashboard.jobs.map((job) => (
                    <DataTableRow key={job.id}>
                      <DataTableCell>
                        <Link href={`/jobs/${job.id}`} className="font-medium text-primary transition hover:text-primary/80 hover:underline">
                          {job.id}
                        </Link>
                        <div className="mt-1 text-xs text-muted-foreground">
                          {job.source_channel_ref} → {job.target_channel_ref}
                        </div>
                      </DataTableCell>
                      <DataTableCell>
                        {job.start_message_id} - {job.end_message_id}
                        <div className="mt-1 text-xs text-muted-foreground">{job.job_order}</div>
                      </DataTableCell>
                      <DataTableCell>
                        <div className="flex flex-wrap gap-2">
                          <Badge variant="blue">{job.mode}</Badge>
                          <Badge variant="slate">{job.album_strategy}</Badge>
                        </div>
                      </DataTableCell>
                      <DataTableCell>
                        <Badge variant={statusVariant(job.status)}>{job.status}</Badge>
                      </DataTableCell>
                      <DataTableCell>
                        <span className="font-medium text-foreground">{job.processed_messages}</span>
                        <span className="text-muted-foreground"> / {job.total_messages}</span>
                      </DataTableCell>
                      <DataTableCell>
                        <JobActionButtons jobId={job.id} status={job.status} />
                      </DataTableCell>
                    </DataTableRow>
                  ))}
                </DataTableBody>
              </DataTable>
            )}
          </CardContent>
        </Card>

        <Card className="surface-glass surface-panel border-border/70 shadow-[0_28px_64px_-38px_color-mix(in_oklab,var(--foreground)_18%,transparent)]">
          <CardHeader>
            <CardDescription>Fast account actions</CardDescription>
            <CardTitle>Operator quick actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {dashboard.accounts.length === 0 ? (
              <EmptyState
                title="No accounts yet"
                description="Add a Telegram account first so you can request login codes, verify sessions, and refresh dialogs."
              />
            ) : (
              dashboard.accounts.map((account) => (
                <AccountActionPanel
                  key={account.id}
                  accountId={account.id}
                  accountLabel={account.label}
                  loginState={account.login_state}
                  phoneNumber={account.phone_number}
                />
              ))
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
