import { connection } from "next/server";
import { DashboardLayoutShell } from "@/components/dashboard/layout";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  // Keep database-backed pages request-time rendered without a session cookie.
  await connection();
  return <DashboardLayoutShell>{children}</DashboardLayoutShell>;
}
