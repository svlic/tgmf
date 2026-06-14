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
  const activeJobs = jobs.filter((job) => ["pending", "claimed", "running", "paused"].includes(job.status));
  const completedJobs = jobs.filter((job) => job.status === "completed");
  const failedJobs = jobs.filter((job) => job.status === "failed");
  const readyAccounts = accounts.filter((account) => account.login_state === "ready");

  return (
    <div className="space-y-6">
      <JobProgressRefresh active={activeRefresh} />

      <Card className="border-border/70 shadow-[0_28px_64px_-38px_color-mix(in_oklab,var(--foreground)_18%,transparent)]">
        <CardHeader className="gap-2.5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-2xl space-y-1.5">
              <CardDescription className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">Operational overview</CardDescription>
              <div className="flex flex-wrap items-center gap-3">
                <CardTitle>Job lifecycle management</CardTitle>
                <Badge variant="blue" className="w-fit">Jobs</Badge>
              </div>
              <CardDescription className="max-w-xl leading-5">
                Review transfer progress, worker activity, and recovery actions from a single operational queue.
              </CardDescription>
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
                className="inline-flex h-10 items-center justify-center rounded-[calc(var(--radius)-0.125rem)] border border-border/80 bg-white/75 px-4 py-2 text-sm font-medium text-secondary-foreground shadow-sm shadow-black/5 backdrop-blur transition-all duration-200 ease-out hover:-translate-y-0.5 hover:border-primary/20 hover:bg-white hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/70 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              >
                Manage accounts
              </Link>
            </div>
          </div>
        </CardHeader>
        <CardContent className="grid gap-4 lg:grid-cols-[1.35fr_1fr] xl:grid-cols-[1.4fr_0.95fr]">
          <div className="grid gap-3.5 sm:grid-cols-2 2xl:grid-cols-4">
            <div className="rounded-(--radius-xl) border border-border/65 bg-white/45 p-4">
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">Total jobs</p>
              <p className="mt-1.5 text-2xl font-semibold text-foreground">{jobs.length}</p>
              <p className="mt-0.5 text-sm leading-5 text-muted-foreground">Queue and history at a glance.</p>
            </div>
            <div className="rounded-(--radius-xl) border border-border/65 bg-white/45 p-4">
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">Active lifecycle</p>
              <p className="mt-1.5 text-2xl font-semibold text-foreground">{activeJobs.length}</p>
              <p className="mt-0.5 text-sm leading-5 text-muted-foreground">Pending, running, claimed, or paused.</p>
            </div>
            <div className="rounded-(--radius-xl) border border-border/65 bg-white/45 p-4">
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">Completed</p>
              <p className="mt-1.5 text-2xl font-semibold text-foreground">{completedJobs.length}</p>
              <p className="mt-0.5 text-sm leading-5 text-muted-foreground">Finished transfer runs.</p>
            </div>
            <div className="rounded-(--radius-xl) border border-border/65 bg-white/45 p-4">
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">Failed</p>
              <p className="mt-1.5 text-2xl font-semibold text-foreground">{failedJobs.length}</p>
              <p className="mt-0.5 text-sm leading-5 text-muted-foreground">Needs resume or retry attention.</p>
            </div>
          </div>

          <div className="rounded-(--radius-xl) border border-border/65 bg-background/82 p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="space-y-1">
                <p className="text-sm font-medium text-foreground">Worker health</p>
                <p className="text-sm leading-5 text-muted-foreground">Current execution capacity for this deployment.</p>
              </div>
              <Badge variant={worker && !workerIsStale ? "green" : "red"}>
                {worker ? (workerIsStale ? "stale" : worker.status) : "offline"}
              </Badge>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Current job</p>
                <p className="mt-1 break-all text-sm font-medium text-foreground">{worker?.current_job_id ?? "Idle"}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Last heartbeat</p>
                <p className="mt-1 text-sm font-medium text-foreground">{worker ? formatDateTime(worker.heartbeat_at) : "Never"}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Ready accounts</p>
                <p className="mt-1 text-sm font-medium text-foreground">{readyAccounts.length} / {accounts.length}</p>
              </div>
              <div className="sm:col-span-2 rounded-(--radius-lg) border border-border/60 bg-white/35 p-3">
                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Execution model</p>
                <p className="mt-1 text-sm leading-5 text-muted-foreground">Multiple jobs can be queued and managed here. This deployment currently processes them through the active worker heartbeat.</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

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
          <div className="grid gap-5">
          {jobs.map((job) => {
            const account = accountRepository.getById(job.account_id);
            const progressPercent = getProgressPercent(job.processed_messages, job.total_messages);

            return (
              <Card key={job.id} className="border-border/70 shadow-[0_28px_64px_-38px_color-mix(in_oklab,var(--foreground)_18%,transparent)]">
                <CardHeader className="gap-3">
                  <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                    <div className="max-w-3xl space-y-3">
                      <div className="flex flex-wrap items-center gap-3">
                        <CardTitle className="text-base sm:text-lg">{job.source_channel_ref} → {job.target_channel_ref}</CardTitle>
                        <Badge variant={statusVariant(job.status)}>{job.status}</Badge>
                        <Badge variant="slate">{job.mode}</Badge>
                      </div>
                      <div className="grid gap-2 text-sm text-muted-foreground sm:grid-cols-3">
                        <div className="rounded-(--radius-lg) border border-border/60 bg-white/35 px-3 py-2">
                          <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Account</p>
                          <p className="mt-1 font-medium text-foreground">{account?.label ?? "Deleted account"}</p>
                        </div>
                        <div className="rounded-(--radius-lg) border border-border/60 bg-white/35 px-3 py-2">
                          <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Range</p>
                          <p className="mt-1 font-medium text-foreground">{job.start_message_id} - {job.end_message_id}</p>
                        </div>
                        <div className="rounded-(--radius-lg) border border-border/60 bg-white/35 px-3 py-2">
                          <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Order</p>
                          <p className="mt-1 font-medium text-foreground">{job.job_order}</p>
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-3">
                      <Link
                        href={`/jobs/${job.id}`}
                        className="inline-flex h-10 items-center justify-center rounded-[calc(var(--radius)-0.125rem)] border border-border/80 bg-white/70 px-4 py-2 text-sm font-medium text-secondary-foreground shadow-sm shadow-black/5 backdrop-blur transition-all duration-200 ease-out hover:-translate-y-0.5 hover:border-primary/18 hover:bg-white hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/70 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                      >
                        Open details
                      </Link>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4 lg:grid-cols-[1.35fr_0.95fr]">
                    <div className="rounded-(--radius-xl) border border-border/65 bg-white/52 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div className="space-y-1">
                          <p className="text-sm font-medium text-foreground">Progress</p>
                          <p className="text-sm leading-5 text-muted-foreground">Processed {job.processed_messages} of {job.total_messages} messages.</p>
                        </div>
                        <span className="text-sm font-semibold text-primary">{progressPercent}%</span>
                      </div>
                      <div className="mt-3 h-2 overflow-hidden rounded-full border border-primary/10 bg-secondary/80">
                        <div
                          className="h-full rounded-full bg-primary shadow-[0_8px_18px_-10px_color-mix(in_oklab,var(--primary)_80%,transparent)] transition-[width] duration-500"
                          style={{ width: `${progressPercent}%` }}
                        />
                      </div>
                      <div className="mt-4 border-t border-border/60 pt-4">
                        <div className="grid grid-cols-3 gap-3 text-center sm:text-left">
                          <div>
                            <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Succeeded</p>
                            <p className="mt-1 font-semibold text-foreground">{job.succeeded_messages}</p>
                          </div>
                          <div>
                            <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Skipped</p>
                            <p className="mt-1 font-medium text-foreground/80">{job.skipped_messages}</p>
                          </div>
                          <div>
                            <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Failed</p>
                            <p className="mt-1 font-medium text-foreground/80">{job.failed_messages}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="rounded-(--radius-xl) border border-border/65 bg-background/82 p-4 text-sm text-muted-foreground">
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div>
                          <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Created</p>
                          <p className="mt-1 text-sm font-medium leading-5 text-foreground">{formatDateTime(job.created_at)}</p>
                        </div>
                        <div>
                          <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Updated</p>
                          <p className="mt-1 text-sm font-medium leading-5 text-foreground">{formatDateTime(job.updated_at)}</p>
                        </div>
                        <div>
                          <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Started</p>
                          <p className="mt-1 text-sm font-medium leading-5 text-foreground">{formatDateTime(job.started_at)}</p>
                        </div>
                        <div>
                          <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Finished</p>
                          <p className="mt-1 text-sm font-medium leading-5 text-foreground">{formatDateTime(job.finished_at)}</p>
                        </div>
                      </div>
                      <div className="mt-4 rounded-(--radius-lg) border border-border/60 bg-white/35 p-3">
                        <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Last error</p>
                        <p className="mt-1 break-words text-sm leading-5 text-muted-foreground">{job.last_error_message || "No error recorded."}</p>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-(--radius-xl) border border-border/65 bg-background/82 p-4">
                    <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <p className="text-sm font-medium text-foreground">Lifecycle actions</p>
                      <Badge variant={statusVariant(job.status)}>{job.status}</Badge>
                    </div>
                    <JobActionButtons jobId={job.id} status={job.status} />
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
