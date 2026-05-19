import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AccountCreateForm, AccountActionButtons, JobActionButtons, JobCreateForm } from "@/components/dashboard/forms";
import { getDashboardData } from "@/lib/server";

export default async function HomePage() {
  const dashboard = getDashboardData();

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Worker status</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-slate-600">
            <p>Current state: <strong>{dashboard.latestWorker?.status ?? "offline"}</strong></p>
            <p>Current job: <strong>{dashboard.latestWorker?.current_job_id ?? "—"}</strong></p>
            <p>Heartbeat: <strong>{dashboard.latestWorker?.heartbeat_at ?? "never"}</strong></p>
            <p>Freshness: <strong>{dashboard.isWorkerStale ? "stale" : "healthy"}</strong></p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Accounts</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-slate-600">
            <p>Total accounts: <strong>{dashboard.accounts.length}</strong></p>
            <p>Ready accounts: <strong>{dashboard.accounts.filter((account) => account.login_state === "ready").length}</strong></p>
            <p>
              Manage login state and dialogs on the <Link href="/accounts" className="text-sky-700 underline">Accounts page</Link>.
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Jobs</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-slate-600">
            <p>Total jobs: <strong>{dashboard.jobs.length}</strong></p>
            <p>Active jobs: <strong>{dashboard.jobs.filter((job) => ["pending", "running", "claimed"].includes(job.status)).length}</strong></p>
            <p>Failed jobs: <strong>{dashboard.jobs.filter((job) => job.status === "failed").length}</strong></p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Create Telegram account</CardTitle>
        </CardHeader>
        <CardContent>
          <AccountCreateForm />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Create sync job</CardTitle>
        </CardHeader>
        <CardContent>
          <JobCreateForm accounts={dashboard.accounts.map((account) => ({ id: account.id, label: account.label }))} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recent jobs</CardTitle>
        </CardHeader>
        <CardContent>
          <table>
            <thead>
              <tr>
                <th>Job</th>
                <th>Range</th>
                <th>Mode</th>
                <th>Status</th>
                <th>Progress</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {dashboard.jobs.map((job) => (
                <tr key={job.id}>
                  <td>
                    <Link href={`/jobs/${job.id}`} className="font-medium text-sky-700 underline">
                      {job.id}
                    </Link>
                    <div className="text-xs text-slate-500">{job.source_channel_ref} → {job.target_channel_ref}</div>
                  </td>
                  <td>{job.start_message_id} - {job.end_message_id} ({job.job_order})</td>
                  <td>{job.mode} / {job.album_strategy}</td>
                  <td>{job.status}</td>
                  <td>{job.processed_messages}/{job.total_messages}</td>
                  <td><JobActionButtons jobId={job.id} status={job.status} /></td>
                </tr>
              ))}
              {dashboard.jobs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-sm text-slate-500">No jobs created yet.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Accounts quick actions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {dashboard.accounts.map((account) => (
            <div key={account.id} className="rounded-lg border border-slate-200 p-4">
              <div className="mb-3">
                <p className="font-medium text-slate-950">{account.label}</p>
                <p className="text-sm text-slate-600">{account.phone_number} · {account.login_state}</p>
              </div>
              <AccountActionButtons accountId={account.id} />
            </div>
          ))}
          {dashboard.accounts.length === 0 ? <p className="text-sm text-slate-500">Add an account to begin Telegram login.</p> : null}
        </CardContent>
      </Card>
    </div>
  );
}
