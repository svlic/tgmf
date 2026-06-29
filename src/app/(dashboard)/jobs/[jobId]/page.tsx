import { notFound } from "next/navigation";
import { JobDetailLive } from "@/components/dashboard/job-detail-live";
import { buildJobDetailSnapshot } from "@/lib/jobs-dashboard";

export default async function JobDetailPage({ params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await params;
  const initial = buildJobDetailSnapshot(jobId);

  if (!initial) {
    notFound();
  }

  return <JobDetailLive initial={initial} />;
}