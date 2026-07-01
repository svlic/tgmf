import { redirect } from "next/navigation";
import { LoginForm } from "@/components/dashboard/forms";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getAdminSession } from "@/lib/auth";

export default async function LoginPage() {
  const session = await getAdminSession();
  if (session?.authenticated) {
    redirect("/");
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6 py-12">
      <Card className="w-full max-w-md">
        <CardHeader className="gap-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Secure access</p>
          <CardTitle className="text-2xl text-balance">Admin login</CardTitle>
          <CardDescription>
            Use the admin password from your server environment to manage accounts and jobs.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <LoginForm />
        </CardContent>
      </Card>
    </div>
  );
}