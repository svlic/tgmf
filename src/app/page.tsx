import { redirect } from "next/navigation";
import { getAdminSession } from "@/lib/auth";

export default async function HomePage() {
  const session = await getAdminSession();

  if (!session?.authenticated) {
    console.info("[admin-login] root redirect", { authenticated: false, target: "/login" });
    redirect("/login");
  }

  console.info("[admin-login] root redirect", { authenticated: true, target: "/accounts" });
  redirect("/accounts");
}
