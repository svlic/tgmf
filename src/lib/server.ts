import { headers } from "next/headers";
import { accountRepository, jobRepository, transferRecordRepository, workerRepository } from "@/lib/db/repositories";
import { WORKER_HEARTBEAT_STALE_MS } from "@/lib/constants";

export async function getClientMeta() {
  const requestHeaders = await headers();
  return {
    ipAddress: requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown",
    userAgent: requestHeaders.get("user-agent") || "unknown",
  };
}

export function getDashboardData() {
  const accounts = accountRepository.list();
  const jobs = jobRepository.list();
  const latestWorker = workerRepository.getLatest();
  const records = jobs[0] ? transferRecordRepository.listForJob(jobs[0].id) : [];
  const isWorkerStale = latestWorker
    ? Date.now() - new Date(latestWorker.heartbeat_at).getTime() > WORKER_HEARTBEAT_STALE_MS
    : true;

  return {
    accounts,
    jobs,
    latestWorker,
    latestJobRecords: records,
    isWorkerStale,
  };
}
