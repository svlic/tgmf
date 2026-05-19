import { redirect } from "next/navigation";
import { LoginForm } from "@/components/dashboard/forms";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getAdminSession } from "@/lib/auth";

export default async function LoginPage() {
  const session = await getAdminSession();
  if (session?.authenticated) {
    redirect("/");
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-6 py-12">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Admin login</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-slate-600">Sign in with the administrator password from the server environment.</p>
          <LoginForm />
        </CardContent>
      </Card>
    </div>
  );
}
