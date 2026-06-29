import { JobsLiveDashboard } from "@/components/dashboard/jobs-live-dashboard";
import { buildJobsOverviewSnapshot } from "@/lib/jobs-dashboard";

export default function JobsPage() {
  const initial = buildJobsOverviewSnapshot();

  return <JobsLiveDashboard initial={initial} />;
}