import Link from "next/link";
import { PageHeader } from "@/components/dashboard/page-header";
import { StatTile } from "@/components/dashboard/stat-tile";
import { JobActionButtons } from "@/components/dashboard/forms";
import { JobProgressRefresh } from "@/components/dashboard/job-progress-refresh";
import { LinkButton } from "@/components/ui/link-button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { accountRepository, jobRepository, workerRepository } from "@/lib/db/repositories";
import { formatJobDateTime, jobProgressPercent, jobStatusVariant } from "@/lib/job-ui";
import type { JobStatus } from "@/lib/types";

const ACTIVE_JOB_STATUSES: readonly JobStatus[] = ["pending", "claimed", "running", "paused", "failed"];
const QUEUED_JOB_STATUSES: readonly JobStatus[] = ["pending", "claimed", "paused"];
const REFRESHING_JOB_STATUSES: readonly JobStatus[] = ["pending", "running"];

function workerBadgeVariant(worker: { status: string } | null, stale: boolean) {
  if (!worker || stale) {
    return "red" as const;
  }

  return "green" as const;
}

function workerLabel(worker: { status: string } | null, stale: boolean) {
  if (!worker) {
    return "offline";
  }

  return stale ? "stale" : worker.status;
}

export default function JobsPage() {
  const jobs = jobRepository.list();
  const accounts = accountRepository.list();
  const worker = workerRepository.getLatest() ?? null;
  const workerIsStale = worker ? worker.status === "stale" : true;
  const activeRefresh = jobs.some((job) => REFRESHING_JOB_STATUSES.includes(job.status));
  const activeJobs = jobs.filter((job) => ACTIVE_JOB_STATUSES.includes(job.status));
  const completedJobs = jobs.filter((job) => job.status === "completed");
  const archivedJobs = jobs.filter((job) => !activeJobs.some((activeJob) => activeJob.id === job.id));
  const readyAccounts = accounts.filter((account) => account.login_state === "ready");
  const queuedJobs = jobs.filter((job) => QUEUED_JOB_STATUSES.includes(job.status));
  const failedJobs = jobs.filter((job) => job.status === "failed");

  return (
    <div className="space-y-6">
      <JobProgressRefresh active={activeRefresh} />

      <PageHeader
        eyebrow="Operations"
        title="Transfer jobs"
        description="Monitor the worker, scan active work, and open job details for recovery actions."
        actions={
          <>
            <LinkButton href="/jobs/new">Create job</LinkButton>
            <LinkButton href="/accounts" variant="secondary">
              Accounts
            </LinkButton>
          </>
        }
      />

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label="Total" value={jobs.length} />
        <StatTile label="Active" value={activeJobs.length} />
        <StatTile label="Queued" value={queuedJobs.length} />
        <StatTile label="Completed" value={completedJobs.length} />
      </section>

      <Card>
        <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
          <div className="space-y-1">
            <p className="text-sm font-medium text-foreground">Worker</p>
            <p className="text-xs leading-5 text-muted-foreground">
              Single-worker deployment. Heartbeat: {worker ? formatJobDateTime(worker.heartbeat_at) : "never"}.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Badge variant={workerBadgeVariant(worker, workerIsStale)}>{workerLabel(worker, workerIsStale)}</Badge>
            <span className="text-xs text-muted-foreground">
              Ready accounts {readyAccounts.length}/{accounts.length}
            </span>
            {failedJobs.length > 0 ? (
              <span className="text-xs font-medium text-destructive">{failedJobs.length} failed</span>
            ) : null}
            <span className="font-mono text-xs text-muted-foreground">Job: {worker?.current_job_id ?? "idle"}</span>
          </div>
        </CardContent>
      </Card>

      {jobs.length === 0 ? (
        <EmptyState
          title="No jobs yet"
          description="Create a transfer job to start syncing messages between channels."
        >
          <LinkButton href="/jobs/new">Create first job</LinkButton>
        </EmptyState>
      ) : (
        <div className="space-y-8">
          <section className="space-y-3">
            <h2 className="text-lg font-semibold tracking-tight text-foreground">Active queue</h2>
            {activeJobs.length === 0 ? (
              <p className="text-sm text-muted-foreground">No active jobs. Queued work will appear here.</p>
            ) : (
              <ul className="divide-y divide-border/70 rounded-[var(--radius-xl)] border border-border/65 bg-card">
                {activeJobs.map((job) => {
                  const account = accountRepository.getById(job.account_id);
                  const progressPercent = jobProgressPercent(job.processed_messages, job.total_messages);

                  return (
                    <li key={job.id} className="px-4 py-4 sm:px-5">
                      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                        <div className="min-w-0 space-y-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <Link
                              href={`/jobs/${job.id}`}
                              className="font-medium text-foreground hover:text-primary"
                            >
                              {job.source_channel_ref} → {job.target_channel_ref}
                            </Link>
                            <Badge variant={jobStatusVariant(job.status)}>{job.status}</Badge>
                            <Badge variant="slate">{job.mode}</Badge>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {account?.label ?? "Deleted account"} · {job.start_message_id}–{job.end_message_id} ·{" "}
                            {job.processed_messages}/{job.total_messages} ({progressPercent}%)
                          </p>
                          <div className="h-1.5 max-w-md overflow-hidden rounded-full bg-secondary">
                            <div
                              className="h-full rounded-full bg-primary transition-[width] duration-500"
                              style={{ width: `${progressPercent}%` }}
                            />
                          </div>
                          {job.last_error_message ? (
                            <p className="text-xs leading-5 text-destructive/90">{job.last_error_message}</p>
                          ) : null}
                        </div>
                        <div className="flex shrink-0 flex-col gap-3 sm:items-end">
                          <LinkButton href={`/jobs/${job.id}`} variant="secondary" size="sm">
                            Details
                          </LinkButton>
                          <JobActionButtons jobId={job.id} status={job.status} />
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          {archivedJobs.length > 0 ? (
            <section className="space-y-3">
              <h2 className="text-lg font-semibold tracking-tight text-foreground">History</h2>
              <ul className="divide-y divide-border/70 rounded-[var(--radius-xl)] border border-border/65 bg-card/80">
                {archivedJobs.map((job) => {
                  const account = accountRepository.getById(job.account_id);

                  return (
                    <li key={job.id} className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="truncate text-sm font-medium text-foreground">
                            {job.source_channel_ref} → {job.target_channel_ref}
                          </span>
                          <Badge variant={jobStatusVariant(job.status)}>{job.status}</Badge>
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {account?.label ?? "—"} · Finished {formatJobDateTime(job.finished_at)}
                        </p>
                      </div>
                      <LinkButton href={`/jobs/${job.id}`} variant="ghost" size="sm">
                        Open
                      </LinkButton>
                    </li>
                  );
                })}
              </ul>
            </section>
          ) : null}
        </div>
      )}
    </div>
  );
}