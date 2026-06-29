"use client";

import Link from "next/link";
import { PageHeader } from "@/components/dashboard/page-header";
import { SectionHeading } from "@/components/ui/section-heading";
import { StatTile } from "@/components/dashboard/stat-tile";
import { JobActionButtons } from "@/components/dashboard/forms";
import { LinkButton } from "@/components/ui/link-button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { PollRefreshBanner } from "@/components/dashboard/poll-refresh-banner";
import { usePollJson } from "@/hooks/use-poll-json";
import {
  JOBS_MUTATED_EVENT,
  JOBS_POLL_INTERVAL_MS,
  type JobsOverviewSnapshot,
} from "@/lib/jobs-snapshots";
import { formatJobDateTime, jobStatusVariant } from "@/lib/job-ui";

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

type JobsLiveDashboardProps = {
  initial: JobsOverviewSnapshot;
};

export function JobsLiveDashboard({ initial }: JobsLiveDashboardProps) {
  const { data, fetchError } = usePollJson({
    url: "/api/jobs/overview",
    intervalMs: JOBS_POLL_INTERVAL_MS,
    initialData: initial,
    mutateEventName: JOBS_MUTATED_EVENT,
    shouldPoll: (snapshot) => snapshot.needs_polling,
  });

  const hasJobs = data.stats.total > 0;

  return (
    <div className="space-y-6">
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

      <PollRefreshBanner message={fetchError} />

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label="Total" value={data.stats.total} />
        <StatTile label="Active" value={data.stats.active} />
        <StatTile label="Queued" value={data.stats.queued} />
        <StatTile label="Completed" value={data.stats.completed} />
      </section>

      <Card>
        <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
          <div className="space-y-1">
            <p className="text-sm font-medium text-foreground">Worker</p>
            <p className="text-xs leading-5 text-muted-foreground">
              Single-worker deployment. Heartbeat: {data.worker_heartbeat_label}.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Badge variant={workerBadgeVariant(data.worker, data.worker_is_stale)}>
              {workerLabel(data.worker, data.worker_is_stale)}
            </Badge>
            <span className="text-xs text-muted-foreground">
              Ready accounts {data.ready_accounts}/{data.total_accounts}
            </span>
            {data.stats.failed > 0 ? (
              <span className="text-xs font-medium text-destructive">{data.stats.failed} failed</span>
            ) : null}
            <span className="font-mono text-xs text-muted-foreground">
              Job: {data.worker?.current_job_id ?? "idle"}
            </span>
          </div>
        </CardContent>
      </Card>

      {!hasJobs ? (
        <EmptyState
          title="No jobs yet"
          description="Create a transfer job to start syncing messages between channels."
        >
          <LinkButton href="/jobs/new">Create first job</LinkButton>
        </EmptyState>
      ) : (
        <div className="space-y-8">
          <section className="space-y-3">
            <SectionHeading title="Active queue" />
            {data.active_jobs.length === 0 ? (
              <p className="text-sm text-muted-foreground">No active jobs. Queued work will appear here.</p>
            ) : (
              <ul className="divide-y divide-border/70 overflow-hidden rounded-[var(--radius-xl)] border border-border/70 bg-card shadow-[var(--shadow-panel)]">
                {data.active_jobs.map((job) => (
                  <li key={job.id} className="px-4 py-4 sm:px-5">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div className="min-w-0 space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <Link href={`/jobs/${job.id}`} className="font-medium text-foreground hover:text-primary">
                            {job.source_channel_ref} → {job.target_channel_ref}
                          </Link>
                          <Badge variant={jobStatusVariant(job.status)}>{job.status}</Badge>
                          <Badge variant="slate">{job.mode}</Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {job.account_label ?? "Deleted account"} · {job.start_message_id}–{job.end_message_id} ·{" "}
                          {job.processed_messages}/{job.total_messages} ({job.progress_percent}%)
                        </p>
                        <div className="h-1.5 max-w-md overflow-hidden rounded-full bg-secondary">
                          <div
                            className="h-full rounded-full bg-primary transition-[width] duration-500"
                            style={{ width: `${job.progress_percent}%` }}
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
                ))}
              </ul>
            )}
          </section>

          {data.archived_jobs.length > 0 ? (
            <section className="space-y-3">
              <SectionHeading title="History" />
              <ul className="divide-y divide-border/70 overflow-hidden rounded-[var(--radius-xl)] border border-border/70 bg-card shadow-[var(--shadow-panel)]">
                {data.archived_jobs.map((job) => (
                  <li
                    key={job.id}
                    className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <Link
                          href={`/jobs/${job.id}`}
                          className="truncate text-sm font-medium text-foreground hover:text-primary"
                        >
                          {job.source_channel_ref} → {job.target_channel_ref}
                        </Link>
                        <Badge variant={jobStatusVariant(job.status)}>{job.status}</Badge>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {job.account_label ?? "—"} · Finished {formatJobDateTime(job.finished_at)}
                      </p>
                    </div>
                    <LinkButton href={`/jobs/${job.id}`} variant="secondary" size="sm">
                      Open
                    </LinkButton>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>
      )}
    </div>
  );
}