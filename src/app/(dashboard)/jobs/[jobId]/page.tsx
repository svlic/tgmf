import { notFound } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { JobActionButtons } from "@/components/dashboard/forms";
import { JobProgressRefresh } from "@/components/dashboard/job-progress-refresh";
import { jobRepository, transferRecordRepository } from "@/lib/db/repositories";
import {
  DataTable,
  DataTableBody,
  DataTableCell,
  DataTableHead,
  DataTableHeader,
  DataTableRow,
} from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
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

function parseAllowedMediaTypes(value: string): AllowedMediaType[] {
  try {
    const parsed: unknown = JSON.parse(value);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .map(normalizeAllowedMediaType)
      .filter((mediaType): mediaType is AllowedMediaType => mediaType !== null);
  } catch {
    return [];
  }
}

function statusVariant(status: string) {
  if (["completed"].includes(status)) {
    return "green" as const;
  }

  if (["running", "pending", "claimed"].includes(status)) {
    return "blue" as const;
  }

  if (["failed", "cancelled"].includes(status)) {
    return "red" as const;
  }

  return "amber" as const;
}

export default async function JobDetailPage({ params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await params;
  const job = jobRepository.getById(jobId);

  if (!job) {
    notFound();
  }

  const records = transferRecordRepository.listForJob(jobId);
  const allowedMediaTypes = parseAllowedMediaTypes(job.allowed_media_types);
  const progressPercent = job.total_messages > 0 ? Math.min(100, Math.round((job.processed_messages / job.total_messages) * 100)) : 0;
  const shouldRefreshProgress = ["pending", "running"].includes(job.status);

  return (
    <div className="space-y-6">
      <JobProgressRefresh active={shouldRefreshProgress} />
      <Card className="surface-glass surface-panel border-border/70 shadow-[0_28px_64px_-38px_color-mix(in_oklab,var(--foreground)_18%,transparent)]">
        <CardHeader className="gap-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-3">
                <CardTitle>Job details</CardTitle>
                <Badge variant={statusVariant(job.status)}>{job.status}</Badge>
              </div>
              <CardDescription>Inspect the selected transfer job, its source/target mapping, and recovery actions.</CardDescription>
            </div>
            <div className="surface-glass rounded-(--radius-xl) border border-border/70 bg-white/55 px-4 py-3 text-sm text-muted-foreground">
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Job ID</p>
              <p className="mt-1 max-w-[18rem] truncate font-mono text-xs font-medium text-foreground" title={job.id}>{job.id}</p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div className="surface-glass rounded-(--radius-xl) border border-border/70 bg-white/55 p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Source</p>
              <p className="mt-2 break-all font-medium text-foreground">{job.source_channel_ref}</p>
            </div>
            <div className="surface-glass rounded-(--radius-xl) border border-border/70 bg-white/55 p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Target</p>
              <p className="mt-2 break-all font-medium text-foreground">{job.target_channel_ref}</p>
            </div>
            <div className="surface-glass rounded-(--radius-xl) border border-border/70 bg-white/55 p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Range</p>
              <p className="mt-2 font-medium text-foreground">{job.start_message_id} - {job.end_message_id}</p>
              <p className="mt-1 text-sm text-muted-foreground">{job.job_order}</p>
            </div>
            <div className="surface-glass rounded-(--radius-xl) border border-border/70 bg-white/55 p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Progress</p>
                <span className="text-sm font-semibold text-primary">{progressPercent}%</span>
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full border border-primary/10 bg-secondary/80">
                <div
                  className="h-full rounded-full bg-primary shadow-[0_8px_18px_-10px_color-mix(in_oklab,var(--primary)_80%,transparent)] transition-[width] duration-500"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
              <p className="mt-2 font-medium text-foreground">{job.processed_messages}/{job.total_messages}</p>
              <p className="mt-1 break-words text-sm text-muted-foreground">Mode: {job.mode} · Album: {job.album_strategy}</p>
            </div>
          </div>

          <div className="surface-glass rounded-(--radius-xl) border border-border/70 bg-white/55 p-4">
            <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-medium text-foreground">Recovery and control actions</p>
                <p className="text-sm leading-6 text-muted-foreground">Pause, resume, cancel, or retry failed messages without leaving this page.</p>
              </div>
              <Badge variant={statusVariant(job.status)}>{job.status}</Badge>
            </div>
            <JobActionButtons jobId={job.id} status={job.status} />
            <div className="mt-4 grid gap-4 lg:grid-cols-3">
              <div className="rounded-(--radius-xl) border border-border/70 bg-background/90 p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Account ID</p>
                <p className="mt-2 truncate font-mono text-xs font-medium text-foreground" title={job.account_id}>{job.account_id}</p>
              </div>
              <div className="rounded-(--radius-xl) border border-border/70 bg-background/90 p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Media filter</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {allowedMediaTypes.length === 0 ? (
                    <span className="text-sm leading-6 text-muted-foreground">All supported media types</span>
                  ) : (
                    allowedMediaTypes.map((mediaType) => (
                      <Badge key={mediaType} variant="blue">{mediaType}</Badge>
                    ))
                  )}
                </div>
              </div>
              <div className="rounded-(--radius-xl) border border-border/70 bg-background/90 p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Last error</p>
                <p className="mt-2 break-words text-sm leading-6 text-muted-foreground">{job.last_error_message || "No error recorded."}</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="surface-glass surface-panel border-border/70 shadow-[0_28px_64px_-38px_color-mix(in_oklab,var(--foreground)_18%,transparent)]">
        <CardHeader>
          <CardDescription>Per-message execution log</CardDescription>
          <CardTitle>Message transfer records</CardTitle>
        </CardHeader>
        <CardContent>
          {records.length === 0 ? (
            <EmptyState
              title="No message records yet"
              description="Once the worker begins processing this job, every transfer attempt will appear here with status and error details."
            >
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">Use the controls above to resume or retry work if the job is paused.</p>
            </EmptyState>
          ) : (
            <DataTable>
              <DataTableHead>
                <DataTableRow>
                  <DataTableHeader>Source message</DataTableHeader>
                  <DataTableHeader>Target message</DataTableHeader>
                  <DataTableHeader>Group</DataTableHeader>
                  <DataTableHeader>Status</DataTableHeader>
                  <DataTableHeader>Error</DataTableHeader>
                  <DataTableHeader>Processed at</DataTableHeader>
                </DataTableRow>
              </DataTableHead>
              <DataTableBody>
                {records.map((record) => (
                  <DataTableRow key={record.id}>
                    <DataTableCell className="whitespace-nowrap font-medium text-foreground">{record.source_message_id}</DataTableCell>
                    <DataTableCell className="whitespace-nowrap">{record.target_message_id ?? "—"}</DataTableCell>
                    <DataTableCell className="max-w-[12rem] break-all font-mono text-xs">{record.media_group_id ?? "—"}</DataTableCell>
                    <DataTableCell>
                      <Badge variant={statusVariant(record.status)}>{record.status}</Badge>
                    </DataTableCell>
                    <DataTableCell className="max-w-[22rem] break-words">{record.error_reason ?? "—"}</DataTableCell>
                    <DataTableCell className="whitespace-nowrap font-mono text-xs">{record.processed_at ?? "—"}</DataTableCell>
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
