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
        <Card className="bg-slate-950 text-white shadow-lg shadow-slate-950/10">
          <CardHeader className="border-b border-white/10">
            <CardDescription className="text-slate-300">Worker health</CardDescription>
            <CardTitle className="text-3xl text-white">{workerStatus}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-slate-300">
            <div className="flex items-center justify-between gap-3">
              <span>Freshness</span>
              <Badge variant={workerFreshness === "healthy" ? "green" : "amber"}>{workerFreshness}</Badge>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span>Current job</span>
              <span className="font-medium text-white">{dashboard.latestWorker?.current_job_id ?? "—"}</span>
            </div>
            <p className="text-xs text-slate-400">Last heartbeat: {dashboard.latestWorker?.heartbeat_at ?? "never"}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Accounts ready to run</CardDescription>
            <CardTitle className="text-3xl">{readyAccounts}</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-slate-500">
            {dashboard.accounts.length} total accounts configured for Telegram login and dialog refresh.
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Active jobs</CardDescription>
            <CardTitle className="text-3xl">{activeJobs}</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-slate-500">
            Jobs currently pending, running, or claimed by the worker.
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Failed jobs</CardDescription>
            <CardTitle className="text-3xl">{failedJobs}</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-slate-500">
            Retry or inspect failed work from the recent jobs table below.
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.3fr_0.9fr]">
        <Card>
          <CardHeader>
            <CardDescription>Queue new work</CardDescription>
            <CardTitle>Create sync job</CardTitle>
          </CardHeader>
          <CardContent>
            <JobCreateForm accounts={dashboard.accounts.map((account) => ({ id: account.id, label: account.label }))} />
          </CardContent>
        </Card>
        <Card>
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
        <Card>
          <CardHeader className="gap-2">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <CardDescription>Operational timeline</CardDescription>
                <CardTitle>Recent jobs</CardTitle>
              </div>
              <p className="text-sm text-slate-500">Open a job to inspect detailed transfer records and error history.</p>
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
                        <Link href={`/jobs/${job.id}`} className="font-medium text-sky-700 hover:text-sky-800 hover:underline">
                          {job.id}
                        </Link>
                        <div className="mt-1 text-xs text-slate-500">
                          {job.source_channel_ref} → {job.target_channel_ref}
                        </div>
                      </DataTableCell>
                      <DataTableCell>
                        {job.start_message_id} - {job.end_message_id}
                        <div className="mt-1 text-xs text-slate-500">{job.job_order}</div>
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
                        <span className="font-medium text-slate-900">{job.processed_messages}</span>
                        <span className="text-slate-400"> / {job.total_messages}</span>
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

        <Card>
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
