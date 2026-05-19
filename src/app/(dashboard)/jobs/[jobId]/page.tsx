import { notFound } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { JobActionButtons } from "@/components/dashboard/forms";
import { jobRepository, transferRecordRepository } from "@/lib/db/repositories";

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
        <CardHeader>
          <CardTitle>Job details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-slate-600">
          <p><strong>Job ID:</strong> {job.id}</p>
          <p><strong>Account ID:</strong> {job.account_id}</p>
          <p><strong>Source:</strong> {job.source_channel_ref}</p>
          <p><strong>Target:</strong> {job.target_channel_ref}</p>
          <p><strong>Range:</strong> {job.start_message_id} - {job.end_message_id} ({job.job_order})</p>
          <p><strong>Mode:</strong> {job.mode}</p>
          <p><strong>Album strategy:</strong> {job.album_strategy}</p>
          <p><strong>Status:</strong> {job.status}</p>
          <p><strong>Progress:</strong> {job.processed_messages}/{job.total_messages}</p>
          <p><strong>Last error:</strong> {job.last_error_message || "—"}</p>
          <JobActionButtons jobId={job.id} status={job.status} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Message transfer records</CardTitle>
        </CardHeader>
        <CardContent>
          <table>
            <thead>
              <tr>
                <th>Source message</th>
                <th>Target message</th>
                <th>Group</th>
                <th>Status</th>
                <th>Error</th>
                <th>Processed at</th>
              </tr>
            </thead>
            <tbody>
              {records.map((record) => (
                <tr key={record.id}>
                  <td>{record.source_message_id}</td>
                  <td>{record.target_message_id ?? "—"}</td>
                  <td>{record.media_group_id ?? "—"}</td>
                  <td>{record.status}</td>
                  <td>{record.error_reason ?? "—"}</td>
                  <td>{record.processed_at ?? "—"}</td>
                </tr>
              ))}
              {records.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-sm text-slate-500">No message records yet.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
