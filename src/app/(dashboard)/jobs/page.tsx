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
import { JobActionButtons } from "@/components/dashboard/forms";
import { JobProgressRefresh } from "@/components/dashboard/job-progress-refresh";
import { accountRepository, jobRepository, workerRepository } from "@/lib/db/repositories";
import { WORKER_HEARTBEAT_STALE_MS } from "@/lib/constants";

function statusVariant(status: string) {
  if (["completed", "ready"].includes(status)) {
    return "green" as const;
  }

  if (["running", "pending", "claimed"].includes(status)) {
    return "blue" as const;
  }

  if (["failed", "cancelled", "logged_out", "reauth_required"].includes(status)) {
    return "red" as const;
  }

  return "amber" as const;
}

function formatDateTime(value: string | null) {
  if (!value) {
    return "—";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function getProgressPercent(processed: number, total: number) {
  if (total <= 0) {
    return 0;
  }

  return Math.min(100, Math.round((processed / total) * 100));
}

export default function JobsPage() {
  const jobs = jobRepository.list();
  const accounts = accountRepository.list();
  const worker = workerRepository.getLatest() ?? null;
  const workerIsStale = worker
    ? Date.now() - new Date(worker.heartbeat_at).getTime() > WORKER_HEARTBEAT_STALE_MS
    : true;
  const activeRefresh = jobs.some((job) => ["pending", "running"].includes(job.status));
  const activeJobs = jobs.filter((job) => ["pending", "claimed", "running", "paused", "failed"].includes(job.status));
  const completedJobs = jobs.filter((job) => job.status === "completed");
  const failedJobs = jobs.filter((job) => job.status === "failed");
  const archivedJobs = jobs.filter((job) => !activeJobs.some((activeJob) => activeJob.id === job.id));
  const readyAccounts = accounts.filter((account) => account.login_state === "ready");
  const queuedJobs = jobs.filter((job) => ["pending", "claimed", "paused"].includes(job.status));

  return (
    <div className="space-y-8">
      <JobProgressRefresh active={activeRefresh} />

      <section className="grid gap-4 xl:grid-cols-[1fr_320px]">
        <Card className="border-border/60 bg-white/72 shadow-[0_24px_58px_-36px_color-mix(in_oklab,var(--foreground)_14%,transparent)]">
          <CardContent className="space-y-6 p-6">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
              <div className="max-w-2xl space-y-3">
                <div className="flex flex-wrap items-center gap-3">
                  <Badge variant="blue" className="w-fit">Jobs workspace</Badge>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Operations overview</p>
                </div>
                <div className="space-y-2">
                  <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">Transfer operations</h1>
                  <p className="max-w-xl text-sm leading-6 text-muted-foreground sm:text-base">
                    Watch what is active now, recover what is blocked, and push completed history into a quieter secondary lane.
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-3">
                <Link
                  href="/jobs/new"
                  className="inline-flex h-10 items-center justify-center rounded-[calc(var(--radius)-0.125rem)] border border-primary/90 bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-[0_16px_36px_-18px_color-mix(in_oklab,var(--primary)_70%,transparent)] transition-all duration-200 ease-out hover:-translate-y-0.5 hover:border-primary hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/70 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                >
                  Create job
                </Link>
                <Link
                  href="/accounts"
                  className="inline-flex h-10 items-center justify-center rounded-[calc(var(--radius)-0.125rem)] border border-border/70 bg-white/72 px-4 py-2 text-sm font-medium text-secondary-foreground transition-all duration-200 ease-out hover:-translate-y-0.5 hover:border-primary/18 hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/70 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                >
                  Manage accounts
                </Link>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-lg border border-border/55 bg-background/80 px-4 py-4 hover:border-primary/30 transition-colors">
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Total jobs</p>
                <p className="mt-2 text-2xl font-semibold text-foreground">{jobs.length}</p>
              </div>
              <div className="rounded-lg border border-border/55 bg-background/80 px-4 py-4 hover:border-primary/30 transition-colors">
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Active</p>
                <p className="mt-2 text-2xl font-semibold text-foreground">{activeJobs.length}</p>
              </div>
              <div className="rounded-lg border border-border/55 bg-background/80 px-4 py-4 hover:border-primary/30 transition-colors">
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Queued</p>
                <p className="mt-2 text-2xl font-semibold text-foreground">{queuedJobs.length}</p>
              </div>
              <div className="rounded-lg border border-border/55 bg-background/80 px-4 py-4 hover:border-primary/30 transition-colors">
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Completed</p>
                <p className="mt-2 text-2xl font-semibold text-foreground">{completedJobs.length}</p>
              </div>
            </div>

            <div className="rounded-lg border border-border/55 bg-background/78 p-4 sm:p-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="space-y-2">
                  <p className="text-sm font-semibold text-foreground">Execution model</p>
                  <p className="max-w-2xl text-xs leading-5 text-muted-foreground">
                    You can manage multiple queued jobs here, but this deployment still executes them through the active worker loop. The page now separates immediate operations from passive history so the layout stops feeling top-heavy.
                  </p>
                </div>
                <div className="grid gap-3 sm:grid-cols-3 lg:min-w-[420px] lg:max-w-[460px] lg:flex-1">
                  <div className="rounded-lg border border-border/55 bg-white/54 p-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Current job</p>
                    <p className="mt-1 break-all text-xs font-semibold text-foreground font-mono">{worker?.current_job_id ?? "Idle"}</p>
                  </div>
                  <div className="rounded-lg border border-border/55 bg-white/54 p-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Worker</p>
                    <div className="mt-1 flex items-center gap-2">
                      <Badge variant={worker && !workerIsStale ? "green" : "red"}>
                        {worker ? (workerIsStale ? "stale" : worker.status) : "offline"}
                      </Badge>
                    </div>
                  </div>
                  <div className="rounded-lg border border-border/55 bg-white/54 p-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Ready accounts</p>
                    <p className="mt-1 text-sm font-medium text-foreground">{readyAccounts.length} / {accounts.length}</p>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/60 bg-background/84 shadow-[0_22px_52px_-36px_color-mix(in_oklab,var(--foreground)_14%,transparent)]">
          <CardHeader className="gap-2">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1">
                <CardDescription className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Worker pulse</CardDescription>
                <CardTitle className="text-base">Deployment readiness</CardTitle>
              </div>
              <Badge variant={worker && !workerIsStale ? "green" : "red"}>
                {worker ? (workerIsStale ? "stale" : worker.status) : "offline"}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4 pt-0">
            <div className="rounded-lg border border-border/55 bg-white/46 p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Last heartbeat</p>
              <p className="mt-2 text-base font-semibold text-foreground">{worker ? formatDateTime(worker.heartbeat_at) : "Never"}</p>
            </div>
            <div className="rounded-lg border border-border/55 bg-white/46 p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Failed jobs</p>
              <p className="mt-2 text-base font-semibold text-foreground">{failedJobs.length}</p>
            </div>
            <div className="rounded-lg border border-border/55 bg-white/46 p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Attention state</p>
              <p className="mt-2 text-xs leading-5 text-muted-foreground">
                {failedJobs.length > 0
                  ? `${failedJobs.length} failed job${failedJobs.length === 1 ? "" : "s"} currently need inspection.`
                  : activeJobs.length > 0
                    ? `${activeJobs.length} active job${activeJobs.length === 1 ? "" : "s"} currently in motion.`
                    : "No active incidents right now."}
              </p>
            </div>
          </CardContent>
        </Card>
      </section>

      {jobs.length === 0 ? (
        <EmptyState
          title="No jobs created yet"
          description="Create your first transfer job to start tracking lifecycle, progress, and recovery actions here."
        >
          <Link
            href="/jobs/new"
            className="inline-flex h-10 items-center justify-center rounded-[calc(var(--radius)-0.125rem)] border border-primary/90 bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-[0_16px_36px_-18px_color-mix(in_oklab,var(--primary)_70%,transparent)] transition-all duration-200 ease-out hover:-translate-y-0.5 hover:border-primary hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/70 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            Create first job
          </Link>
        </EmptyState>
      ) : (
        <div className="space-y-6">
          <section className="space-y-4">
            <div className="flex flex-col gap-2 border-b border-border/50 pb-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">Active queue</p>
                <h2 className="mt-1 text-xl font-semibold tracking-tight text-foreground">Jobs that need attention now</h2>
              </div>
              <p className="max-w-2xl text-sm leading-5 text-muted-foreground">
                Running, paused, pending, claimed, and failed work stays in the primary lane so the page reads like an operations surface instead of a report dump.
              </p>
            </div>

            {activeJobs.length === 0 ? (
              <Card className="border-border/55 bg-white/68 shadow-none">
                <CardContent className="py-6 text-sm text-muted-foreground">No active jobs right now. New work will appear here once queued.</CardContent>
              </Card>
            ) : (
              <div className="grid gap-4">
                {activeJobs.map((job) => {
                  const account = accountRepository.getById(job.account_id);
                  const progressPercent = getProgressPercent(job.processed_messages, job.total_messages);

                  return (
                    <Card key={job.id} className="border-border/60 bg-white/74 shadow-[0_24px_54px_-36px_color-mix(in_oklab,var(--foreground)_14%,transparent)]">
                      <CardContent className="space-y-5 p-5 sm:p-6">
                        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                          <div className="min-w-0 space-y-3">
                            <div className="flex flex-wrap items-center gap-2.5">
                              <h2 className="text-lg font-semibold tracking-tight text-foreground">{job.source_channel_ref} → {job.target_channel_ref}</h2>
                              <Badge variant={statusVariant(job.status)}>{job.status}</Badge>
                              <Badge variant="slate">{job.mode}</Badge>
                            </div>
                            <div className="grid gap-2 sm:grid-cols-3">
                              <div className="rounded-(--radius-lg) border border-border/55 bg-background/78 px-3 py-2.5">
                                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Account</p>
                                <p className="mt-1 text-sm font-medium text-foreground">{account?.label ?? "Deleted account"}</p>
                              </div>
                              <div className="rounded-(--radius-lg) border border-border/55 bg-background/78 px-3 py-2.5">
                                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Range</p>
                                <p className="mt-1 text-sm font-medium text-foreground">{job.start_message_id} - {job.end_message_id}</p>
                              </div>
                              <div className="rounded-(--radius-lg) border border-border/55 bg-background/78 px-3 py-2.5">
                                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Order</p>
                                <p className="mt-1 text-sm font-medium text-foreground">{job.job_order}</p>
                              </div>
                            </div>
                          </div>
                          <div className="flex flex-wrap gap-3">
                            <Link
                              href={`/jobs/${job.id}`}
                              className="inline-flex h-10 items-center justify-center rounded-[calc(var(--radius)-0.125rem)] border border-border/70 bg-white/70 px-4 py-2 text-sm font-medium text-secondary-foreground transition-all duration-200 ease-out hover:-translate-y-0.5 hover:border-primary/18 hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/70 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                            >
                              Open details
                            </Link>
                          </div>
                        </div>

                        <div className="grid gap-4 xl:grid-cols-[1fr_320px]">
                          <div className="space-y-4 rounded-lg border border-border/55 bg-background/78 p-4 sm:p-5">
                            <div className="flex items-end justify-between gap-3">
                              <div>
                                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Progress</p>
                                <p className="mt-1 text-sm leading-5 text-muted-foreground">Processed {job.processed_messages} of {job.total_messages} messages.</p>
                              </div>
                              <span className="text-2xl font-semibold tracking-tight text-primary">{progressPercent}%</span>
                            </div>
                            <div className="h-2.5 overflow-hidden rounded-full border border-primary/10 bg-secondary/80">
                              <div
                                className="h-full rounded-full bg-primary shadow-[0_8px_18px_-10px_color-mix(in_oklab,var(--primary)_80%,transparent)] transition-[width] duration-500"
                                style={{ width: `${progressPercent}%` }}
                              />
                            </div>
                            <div className="grid gap-3 border-t border-border/55 pt-4 sm:grid-cols-3">
                              <div>
                                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Succeeded</p>
                                <p className="mt-1 text-lg font-semibold text-foreground">{job.succeeded_messages}</p>
                              </div>
                              <div>
                                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Skipped</p>
                                <p className="mt-1 text-lg font-medium text-foreground/80">{job.skipped_messages}</p>
                              </div>
                              <div>
                                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Failed</p>
                                <p className="mt-1 text-lg font-medium text-foreground/80">{job.failed_messages}</p>
                              </div>
                            </div>
                          </div>

                          <div className="space-y-4 rounded-lg border border-border/55 bg-white/50 p-4 sm:p-5">
                            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                              <div>
                                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Created</p>
                                <p className="mt-1 text-xs font-medium leading-5 text-foreground">{formatDateTime(job.created_at)}</p>
                              </div>
                              <div>
                                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Updated</p>
                                <p className="mt-1 text-xs font-medium leading-5 text-foreground">{formatDateTime(job.updated_at)}</p>
                              </div>
                              <div>
                                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Started</p>
                                <p className="mt-1 text-xs font-medium leading-5 text-foreground">{formatDateTime(job.started_at)}</p>
                              </div>
                              <div>
                                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Finished</p>
                                <p className="mt-1 text-xs font-medium leading-5 text-foreground">{formatDateTime(job.finished_at)}</p>
                              </div>
                            </div>
                            <div className="rounded-lg border border-border/55 bg-background/78 p-3.5">
                              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Last error</p>
                              <p className="mt-1 break-words text-xs leading-5 text-muted-foreground">{job.last_error_message || "No error recorded."}</p>
                            </div>
                            <div className="rounded-lg border border-border/55 bg-background/78 p-3.5">
                              <div className="mb-3 flex items-center justify-between gap-3">
                                <p className="text-sm font-medium text-foreground">Lifecycle actions</p>
                                <Badge variant={statusVariant(job.status)}>{job.status}</Badge>
                              </div>
                              <JobActionButtons jobId={job.id} status={job.status} />
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </section>

          {archivedJobs.length > 0 ? (
            <section className="space-y-4">
              <div className="flex flex-col gap-2 border-b border-border/50 pb-4 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">History</p>
                  <h2 className="mt-1 text-xl font-semibold tracking-tight text-foreground">Completed and lower-priority runs</h2>
                </div>
                <p className="max-w-2xl text-sm leading-5 text-muted-foreground">
                  Historical entries are compressed into a lighter lane so they stop dominating the dashboard rhythm.
                </p>
              </div>

              <div className="grid gap-3 xl:grid-cols-2">
                {archivedJobs.map((job) => {
                  const account = accountRepository.getById(job.account_id);
                  const progressPercent = getProgressPercent(job.processed_messages, job.total_messages);

                  return (
                    <Card key={job.id} className="border-border/55 bg-white/62 shadow-none">
                      <CardContent className="flex flex-col gap-4 p-4 lg:flex-row lg:items-center lg:justify-between">
                        <div className="min-w-0 space-y-2">
                          <div className="flex flex-wrap items-center gap-2.5">
                            <h3 className="truncate text-base font-semibold text-foreground">{job.source_channel_ref} → {job.target_channel_ref}</h3>
                            <Badge variant={statusVariant(job.status)}>{job.status}</Badge>
                            <Badge variant="slate">{job.mode}</Badge>
                          </div>
                          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                            <span>Account: <span className="font-semibold text-foreground">{account?.label ?? "Deleted account"}</span></span>
                            <span>Progress: <span className="font-semibold text-foreground">{job.processed_messages}/{job.total_messages}</span></span>
                            <span>Finished: <span className="font-semibold text-foreground">{formatDateTime(job.finished_at)}</span></span>
                            <span>Success: <span className="font-semibold text-foreground">{progressPercent}%</span></span>
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-3">
                          <Link
                            href={`/jobs/${job.id}`}
                            className="inline-flex h-10 items-center justify-center rounded-[calc(var(--radius)-0.125rem)] border border-border/70 bg-white/75 px-4 py-2 text-sm font-medium text-secondary-foreground transition-all duration-200 ease-out hover:-translate-y-0.5 hover:border-primary/18 hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/70 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                          >
                            Open details
                          </Link>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </section>
          ) : null}
        </div>
      )}
    </div>
  );
}
