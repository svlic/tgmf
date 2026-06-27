import { redirect } from "next/navigation";
import { getAdminSession } from "@/lib/auth";

export default async function HomePage() {
  const session = await getAdminSession();

  if (!session?.authenticated) {
    redirect("/login");
  }

  redirect("/jobs/new");
}
