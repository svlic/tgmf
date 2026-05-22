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

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="gap-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-3">
                <CardTitle>Job details</CardTitle>
                <Badge variant={statusVariant(job.status)}>{job.status}</Badge>
              </div>
              <CardDescription>Inspect the selected transfer job, its source/target mapping, and recovery actions.</CardDescription>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
              <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Job ID</p>
              <p className="mt-1 font-medium text-slate-900">{job.id}</p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Source</p>
              <p className="mt-2 font-medium text-slate-900">{job.source_channel_ref}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Target</p>
              <p className="mt-2 font-medium text-slate-900">{job.target_channel_ref}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Range</p>
              <p className="mt-2 font-medium text-slate-900">{job.start_message_id} - {job.end_message_id}</p>
              <p className="mt-1 text-sm text-slate-500">{job.job_order}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Progress</p>
              <p className="mt-2 font-medium text-slate-900">{job.processed_messages}/{job.total_messages}</p>
              <p className="mt-1 text-sm text-slate-500">Mode: {job.mode} · Album: {job.album_strategy}</p>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
            <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-medium text-slate-900">Recovery and control actions</p>
                <p className="text-sm text-slate-500">Pause, resume, cancel, or retry failed messages without leaving this page.</p>
              </div>
              <Badge variant={statusVariant(job.status)}>{job.status}</Badge>
            </div>
            <JobActionButtons jobId={job.id} status={job.status} />
            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Account ID</p>
                <p className="mt-2 font-medium text-slate-900">{job.account_id}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Last error</p>
                <p className="mt-2 text-sm text-slate-600">{job.last_error_message || "No error recorded."}</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardDescription>Per-message execution log</CardDescription>
          <CardTitle>Message transfer records</CardTitle>
        </CardHeader>
        <CardContent>
          {records.length === 0 ? (
            <EmptyState
              title="No message records yet"
              description="Once the worker begins processing this job, every transfer attempt will appear here with status and error details."
            />
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
                    <DataTableCell className="font-medium text-slate-900">{record.source_message_id}</DataTableCell>
                    <DataTableCell>{record.target_message_id ?? "—"}</DataTableCell>
                    <DataTableCell>{record.media_group_id ?? "—"}</DataTableCell>
                    <DataTableCell>
                      <Badge variant={statusVariant(record.status)}>{record.status}</Badge>
                    </DataTableCell>
                    <DataTableCell>{record.error_reason ?? "—"}</DataTableCell>
                    <DataTableCell>{record.processed_at ?? "—"}</DataTableCell>
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
