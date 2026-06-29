"use client";

import { PageHeader } from "@/components/dashboard/page-header";
import { StatTile } from "@/components/dashboard/stat-tile";
import { JobActionButtons } from "@/components/dashboard/forms";
import { LinkButton } from "@/components/ui/link-button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  DataTable,
  DataTableBody,
  DataTableCell,
  DataTableHead,
  DataTableHeader,
  DataTableRow,
} from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { PollRefreshBanner } from "@/components/dashboard/poll-refresh-banner";
import { usePollJson } from "@/hooks/use-poll-json";
import {
  JOBS_MUTATED_EVENT,
  JOBS_POLL_INTERVAL_MS,
  type JobDetailSnapshot,
} from "@/lib/jobs-snapshots";
import { jobStatusVariant } from "@/lib/job-ui";
import { ALLOWED_MEDIA_TYPES } from "@/lib/types";
import type { AllowedMediaType } from "@/lib/types";

function normalizeAllowedMediaType(value: unknown): AllowedMediaType | null {
  if (typeof value !== "string") {
    return null;
  }
  if (ALLOWED_MEDIA_TYPES.includes(value as AllowedMediaType)) {
    return value as AllowedMediaType;
  }
  if (["video_note", "sticker", "animation"].includes(value)) {
    return "other";
  }

  return null;
}

function parseJsonStringArray(value: string) {
  try {
    const parsed: unknown = JSON.parse(value);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .filter((item): item is string => typeof item === "string")
      .map((item) => item.trim())
      .filter((item) => item.length > 0);
  } catch {
    return [];
  }
}

function parseAllowedMediaTypes(value: string): AllowedMediaType[] {
  return parseJsonStringArray(value)
    .map(normalizeAllowedMediaType)
    .filter((mediaType): mediaType is AllowedMediaType => mediaType !== null);
}

function FilterList({ label, values }: { label: string; values: string[] }) {
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">{label}</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {values.length === 0 ? (
          <span className="text-sm text-muted-foreground">None</span>
        ) : (
          values.map((value) => (
            <Badge key={value} variant="blue">
              {value}
            </Badge>
          ))
        )}
      </div>
    </div>
  );
}

type JobDetailLiveProps = {
  initial: JobDetailSnapshot;
};

export function JobDetailLive({ initial }: JobDetailLiveProps) {
  const { data, fetchError } = usePollJson({
    url: `/api/jobs/${initial.job.id}/snapshot`,
    intervalMs: JOBS_POLL_INTERVAL_MS,
    initialData: initial,
    mutateEventName: JOBS_MUTATED_EVENT,
    shouldPoll: (snapshot) => snapshot.needs_polling,
  });

  const job = data.job;
  const allowedMediaTypes = parseAllowedMediaTypes(job.allowed_media_types);
  const keywordWhitelist = parseJsonStringArray(job.keyword_whitelist);
  const keywordBlacklist = parseJsonStringArray(job.keyword_blacklist);
  const regexWhitelist = parseJsonStringArray(job.regex_whitelist);
  const regexBlacklist = parseJsonStringArray(job.regex_blacklist);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Job"
        title={`${job.source_channel_ref} → ${job.target_channel_ref}`}
        description={`ID ${job.id} · ${job.mode} · ${job.job_order}`}
        actions={
          <>
            <Badge variant={jobStatusVariant(job.status)}>{job.status}</Badge>
            <LinkButton href="/jobs" variant="secondary" size="sm">
              All jobs
            </LinkButton>
          </>
        }
      />

      <PollRefreshBanner message={fetchError} />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          label="Progress"
          value={`${data.progress_percent}%`}
          hint={`${job.processed_messages} / ${job.total_messages} messages`}
        />
        <StatTile label="Range" value={`${job.start_message_id}–${job.end_message_id}`} hint={job.album_strategy} />
        <StatTile label="Account" value={data.account_label ?? "Deleted"} hint={data.account_phone ?? undefined} />
        <StatTile
          label="Outcomes"
          value={`${job.succeeded_messages} ok`}
          hint={`${job.failed_messages} failed · ${job.skipped_messages} skipped`}
        />
      </div>

      <div className="h-2 overflow-hidden rounded-full bg-secondary">
        <div
          className="h-full rounded-full bg-primary transition-[width] duration-500"
          style={{ width: `${data.progress_percent}%` }}
        />
      </div>

      <Card>
        <CardContent className="space-y-4 p-5">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm font-medium text-foreground">Lifecycle actions</p>
            <Badge variant={jobStatusVariant(job.status)}>{job.status}</Badge>
          </div>
          <JobActionButtons jobId={job.id} status={job.status} />
          {job.last_error_message ? (
            <p className="rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive">
              {job.last_error_message}
            </p>
          ) : null}
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-lg border border-border/60 p-4">
              <FilterList label="Keyword whitelist" values={keywordWhitelist} />
            </div>
            <div className="rounded-lg border border-border/60 p-4">
              <FilterList label="Keyword blacklist" values={keywordBlacklist} />
            </div>
            <div className="rounded-lg border border-border/60 p-4">
              <FilterList label="Regex whitelist" values={regexWhitelist} />
            </div>
            <div className="rounded-lg border border-border/60 p-4">
              <FilterList label="Regex blacklist" values={regexBlacklist} />
            </div>
          </div>
          <div className="rounded-lg border border-border/60 p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Media filter</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {allowedMediaTypes.length === 0 ? (
                <span className="text-sm text-muted-foreground">All supported types</span>
              ) : (
                allowedMediaTypes.map((mediaType) => (
                  <Badge key={mediaType} variant="blue">
                    {mediaType}
                  </Badge>
                ))
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardDescription>Per-message log</CardDescription>
          <CardTitle>Transfer records</CardTitle>
        </CardHeader>
        <CardContent>
          {data.records.length === 0 ? (
            <EmptyState
              title="No records yet"
              description="Transfer attempts will appear here once the worker processes this job."
            />
          ) : (
            <DataTable>
              <DataTableHead>
                <DataTableRow>
                  <DataTableHeader>Source</DataTableHeader>
                  <DataTableHeader>Target</DataTableHeader>
                  <DataTableHeader>Group</DataTableHeader>
                  <DataTableHeader>Status</DataTableHeader>
                  <DataTableHeader>Error</DataTableHeader>
                  <DataTableHeader>Processed</DataTableHeader>
                </DataTableRow>
              </DataTableHead>
              <DataTableBody>
                {data.records.map((record) => (
                  <DataTableRow key={record.id}>
                    <DataTableCell className="whitespace-nowrap font-medium">{record.source_message_id}</DataTableCell>
                    <DataTableCell className="whitespace-nowrap">{record.target_message_id ?? "—"}</DataTableCell>
                    <DataTableCell className="max-w-[12rem] break-all font-mono text-xs">
                      {record.media_group_id ?? "—"}
                    </DataTableCell>
                    <DataTableCell>
                      <Badge variant={jobStatusVariant(record.status)}>{record.status}</Badge>
                    </DataTableCell>
                    <DataTableCell className="max-w-[22rem] break-words">{record.error_reason ?? "—"}</DataTableCell>
                    <DataTableCell className="whitespace-nowrap font-mono text-xs">
                      {record.processed_at ?? "—"}
                    </DataTableCell>
                  </DataTableRow>
                ))}
              </DataTableBody>
            </DataTable>
          )}
        </CardContent>
      </Card>
    </div>
  );
}