import { requireAdminSession } from "@/lib/auth";
import { DashboardLayoutShell } from "@/components/dashboard/layout";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  await requireAdminSession();
  return <DashboardLayoutShell>{children}</DashboardLayoutShell>;
}
