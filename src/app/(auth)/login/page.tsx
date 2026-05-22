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
    console.info("[admin-login] login page redirect", { authenticated: true, target: "/" });
    redirect("/");
  }

  console.info("[admin-login] login page rendered", { authenticated: false });
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-6 py-12">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_color-mix(in_oklab,var(--primary)_18%,transparent),_transparent_36%),radial-gradient(circle_at_bottom_right,_color-mix(in_oklab,var(--accent)_40%,transparent),_transparent_28%)]" />
      <div className="grid-noise pointer-events-none absolute inset-0 opacity-70" />
      <div className="relative w-full max-w-md">
        <Card className="surface-glass surface-panel overflow-hidden border-border/70 bg-card/88 shadow-[0_34px_90px_-42px_color-mix(in_oklab,var(--foreground)_30%,transparent)] backdrop-blur-xl">
          <CardHeader className="gap-4 border-b border-border/60">
            <Badge variant="blue" className="w-fit">Secure access</Badge>
            <div className="space-y-2">
              <CardTitle className="text-2xl text-balance text-foreground">Admin login</CardTitle>
              <CardDescription className="leading-6 text-muted-foreground">
                Sign in with the admin login password configured in the server environment to manage Telegram accounts and sync jobs.
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            <LoginForm />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
