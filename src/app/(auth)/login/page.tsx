import { redirect } from "next/navigation";
import { LoginForm } from "@/components/dashboard/forms";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getAdminSession } from "@/lib/auth";

export default async function LoginPage() {
  const session = await getAdminSession();
  if (session?.authenticated) {
    redirect("/");
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-slate-100 px-6 py-12">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(14,165,233,0.14),_transparent_42%),radial-gradient(circle_at_bottom_right,_rgba(15,23,42,0.08),_transparent_30%)]" />
      <div className="relative w-full max-w-md">
        <Card className="border-slate-200/80 bg-white/95 shadow-xl shadow-slate-950/10 backdrop-blur">
          <CardHeader className="gap-4">
            <Badge variant="blue" className="w-fit">Secure access</Badge>
            <div className="space-y-2">
              <CardTitle className="text-2xl">Admin login</CardTitle>
              <CardDescription>
                Sign in with the administrator password from the server environment to manage Telegram accounts and sync jobs.
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <LoginForm />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
