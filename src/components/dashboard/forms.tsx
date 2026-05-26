"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Field, FieldDescription, FieldLabel, FieldMessage } from "@/components/ui/field";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type FormState = {
  error: string | null;
  success: string | null;
};

type JsonResult<TData = unknown> =
  | {
      ok: true;
      data: TData;
    }
  | {
      ok: false;
      error: string;
    };

function createClientAttemptId() {
  return globalThis.crypto?.randomUUID?.() ?? `login-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

async function submitJson<TData = unknown>(url: string, body: unknown, method = "POST"): Promise<JsonResult<TData>> {
  const response = await fetch(url, {
    method,
    headers: {
      "content-type": "application/json",
      "x-tgmf-csrf": window.location.host,
    },
    body: JSON.stringify(body),
    credentials: "same-origin",
  });

  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) {
    if (response.redirected) {
      window.location.replace(response.url);
      return { ok: false, error: "Redirecting to login" };
    }

    if (response.status === 401 || response.status === 403) {
      window.location.replace("/login");
      return { ok: false, error: "Redirecting to login" };
    }

    throw new Error(`Unexpected response format (${response.status})`);
  }

  const result: JsonResult<TData> = await response.json();

  if ((response.status === 401 || response.status === 403) && !result.ok) {
    window.location.replace("/login");
  }

  return result;
}

function FormFeedback({ state }: { state: FormState }) {
  if (!state.error && !state.success) {
    return null;
  }

  return (
    <div className="space-y-2">
      {state.error ? <FieldMessage tone="error">{state.error}</FieldMessage> : null}
      {state.success ? <FieldMessage tone="success">{state.success}</FieldMessage> : null}
    </div>
  );
}

function ActionFeedback({ message }: { message: string | null }) {
  if (!message) {
    return null;
  }

  return <FieldMessage className="basis-full">{message}</FieldMessage>;
}

export function LoginForm() {
  const [state, setState] = useState<FormState>({ error: null, success: null });
  const [loading, setLoading] = useState(false);

  return (
    <form
      className="space-y-5"
      onSubmit={async (event) => {
        event.preventDefault();
        setLoading(true);
        setState({ error: null, success: null });
        const attemptId = createClientAttemptId();
        const formData = new FormData(event.currentTarget);

        try {
          console.info("[admin-login-ui] submitting login request", {
            attemptId,
            path: window.location.pathname,
            host: window.location.host,
          });
          const result = await submitJson("/api/auth/login", {
            password: String(formData.get("password") || ""),
          });
          if (!result.ok) {
            console.warn("[admin-login-ui] login request rejected", { attemptId, error: result.error });
            setState({ error: result.error, success: null });
            return;
          }
          console.info("[admin-login-ui] login accepted, redirecting", { attemptId, target: "/" });
          window.location.replace("/");
        } catch (error) {
          const message = error instanceof Error ? error.message : "Login failed";
          console.error("[admin-login-ui] login request failed", { attemptId, message });
          setState({ error: message, success: null });
        } finally {
          setLoading(false);
        }
      }}
    >
      <Field>
        <FieldLabel htmlFor="password">Login password</FieldLabel>
        <Input id="password" type="password" name="password" placeholder="Enter your login password" required />
        <FieldDescription>This password is checked against ADMIN_PASSWORD in the server environment.</FieldDescription>
      </Field>
      <FormFeedback state={state} />
      <Button type="submit" disabled={loading} size="lg" className="w-full">
        {loading ? "Signing in..." : "Sign in"}
      </Button>
    </form>
  );
}

export function LogoutButton() {
  return (
    <Button
      variant="secondary"
      onClick={async () => {
        await submitJson("/api/auth/logout", {});
        window.location.replace("/login");
      }}
    >
      Logout
    </Button>
  );
}

export function AccountCreateForm() {
  const [state, setState] = useState<FormState>({ error: null, success: null });
  return (
    <form
      className="grid gap-5 md:grid-cols-2"
      onSubmit={async (event) => {
        event.preventDefault();
        setState({ error: null, success: null });
        const formData = new FormData(event.currentTarget);
        const payload = {
          label: String(formData.get("label") || ""),
          phoneNumber: String(formData.get("phoneNumber") || ""),
          apiIdOverride: String(formData.get("apiIdOverride") || ""),
          apiHashOverride: String(formData.get("apiHashOverride") || ""),
        };
        const result = await submitJson("/api/accounts", payload);
        if (!result.ok) {
          setState({ error: result.error, success: null });
          return;
        }
        setState({ error: null, success: "Account created" });
        event.currentTarget.reset();
        window.location.reload();
      }}
    >
      <Field>
        <FieldLabel htmlFor="label">Account label</FieldLabel>
        <Input id="label" name="label" placeholder="Primary migration account" required />
      </Field>
      <Field>
        <FieldLabel htmlFor="phoneNumber">Phone number</FieldLabel>
        <Input id="phoneNumber" name="phoneNumber" placeholder="+1 555 123 4567" required />
      </Field>
      <Field>
        <FieldLabel htmlFor="apiIdOverride">API ID override</FieldLabel>
        <Input id="apiIdOverride" name="apiIdOverride" placeholder="Optional project-specific API ID" />
        <FieldDescription>Leave blank to use the shared environment default.</FieldDescription>
      </Field>
      <Field>
        <FieldLabel htmlFor="apiHashOverride">API hash override</FieldLabel>
        <Input id="apiHashOverride" name="apiHashOverride" placeholder="Optional API hash override" />
        <FieldDescription>Useful when isolating one account from the default app credentials.</FieldDescription>
      </Field>
      <div className="md:col-span-2 flex flex-col gap-3 rounded-(--radius-xl) border border-border/70 bg-muted/40 p-4 sm:flex-row sm:items-center sm:justify-between">
        <Button type="submit">Add account</Button>
        <FormFeedback state={state} />
      </div>
    </form>
  );
}

export function JobCreateForm({ accounts }: { accounts: Array<{ id: string; label: string }> }) {
  const [state, setState] = useState<FormState>({ error: null, success: null });
  return (
    <form
      className="grid gap-5 md:grid-cols-2"
      onSubmit={async (event) => {
        event.preventDefault();
        setState({ error: null, success: null });
        const formData = new FormData(event.currentTarget);
        const payload = {
          accountId: String(formData.get("accountId") || ""),
          sourceChannelRef: String(formData.get("sourceChannelRef") || ""),
          targetChannelRef: String(formData.get("targetChannelRef") || ""),
          startMessageId: Number(formData.get("startMessageId") || 0),
          endMessageId: Number(formData.get("endMessageId") || 0),
          jobOrder: String(formData.get("jobOrder") || "asc"),
          mode: String(formData.get("mode") || "forward"),
          albumStrategy: String(formData.get("albumStrategy") || "full_group"),
          delaySeconds: Number(formData.get("delaySeconds") || 2),
        };
        const result = await submitJson("/api/jobs", payload);
        if (!result.ok) {
          setState({ error: result.error, success: null });
          return;
        }
        setState({ error: null, success: "Job created" });
        event.currentTarget.reset();
        window.location.reload();
      }}
    >
      <Field>
        <FieldLabel htmlFor="accountId">Account</FieldLabel>
        <Select id="accountId" name="accountId" required>
          <option value="">Select account</option>
          {accounts.map((account) => (
            <option key={account.id} value={account.id}>
              {account.label}
            </option>
          ))}
        </Select>
      </Field>
      <Field>
        <FieldLabel htmlFor="mode">Transfer mode</FieldLabel>
        <Select id="mode" name="mode" defaultValue="forward">
          <option value="forward">Forward</option>
          <option value="copy">Copy</option>
        </Select>
      </Field>
      <Field>
        <FieldLabel htmlFor="sourceChannelRef">Source channel</FieldLabel>
        <Input id="sourceChannelRef" name="sourceChannelRef" placeholder="username, peer ID, or invite ref" required />
      </Field>
      <Field>
        <FieldLabel htmlFor="targetChannelRef">Target channel</FieldLabel>
        <Input id="targetChannelRef" name="targetChannelRef" placeholder="username, peer ID, or invite ref" required />
      </Field>
      <Field>
        <FieldLabel htmlFor="startMessageId">Start message ID</FieldLabel>
        <Input id="startMessageId" name="startMessageId" type="number" min={1} placeholder="1" required />
      </Field>
      <Field>
        <FieldLabel htmlFor="endMessageId">End message ID</FieldLabel>
        <Input id="endMessageId" name="endMessageId" type="number" min={1} placeholder="100" required />
      </Field>
      <Field>
        <FieldLabel htmlFor="jobOrder">Message order</FieldLabel>
        <Select id="jobOrder" name="jobOrder" defaultValue="asc">
          <option value="asc">Ascending</option>
          <option value="desc">Descending</option>
        </Select>
      </Field>
      <Field>
        <FieldLabel htmlFor="albumStrategy">Album strategy</FieldLabel>
        <Select id="albumStrategy" name="albumStrategy" defaultValue="full_group">
          <option value="full_group">full_group</option>
          <option value="captioned_only">captioned_only</option>
        </Select>
      </Field>
      <Field className="md:col-span-2">
        <FieldLabel htmlFor="delaySeconds">Delay between messages</FieldLabel>
        <Input id="delaySeconds" name="delaySeconds" type="number" min={0} defaultValue={2} placeholder="2" required />
        <FieldDescription>Throttle sends when the target channel is rate sensitive.</FieldDescription>
      </Field>
      <div className="md:col-span-2 flex flex-col gap-3 rounded-(--radius-xl) border border-border/70 bg-muted/40 p-4 sm:flex-row sm:items-center sm:justify-between">
        <Button type="submit">Create job</Button>
        <FormFeedback state={state} />
      </div>
    </form>
  );
}

export function AccountActionButtons({ accountId }: { accountId: string }) {
  const [message, setMessage] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<string | null>(null);

  return (
    <div className="flex flex-wrap gap-2 rounded-(--radius-xl) border border-border/70 bg-background/75 p-3">
      <Button
        variant="secondary"
        size="sm"
        disabled={pendingAction !== null}
        onClick={async () => {
          setPendingAction("connectivity");
          setMessage("Checking connectivity...");
          try {
            const result = await submitJson(`/api/accounts/${accountId}/connectivity`, {});
            setMessage(result.ok ? "Connectivity checked" : result.error);
          } catch (error) {
            setMessage(error instanceof Error ? error.message : "Connectivity check failed");
          } finally {
            setPendingAction(null);
          }
        }}
      >
        {pendingAction === "connectivity" ? "Testing..." : "Test connection"}
      </Button>
      <Button
        variant="secondary"
        size="sm"
        disabled={pendingAction !== null}
        onClick={async () => {
          setPendingAction("start-login");
          setMessage("Requesting Telegram verification code...");
          try {
            const result = await submitJson<{ loginState: string }>(`/api/accounts/${accountId}/start-login`, {});
            setMessage(result.ok ? "Verification code requested. Check Telegram, then click Verify code." : result.error);
          } catch (error) {
            setMessage(error instanceof Error ? error.message : "Failed to start login");
          } finally {
            setPendingAction(null);
          }
        }}
      >
        {pendingAction === "start-login" ? "Requesting code..." : "Start login"}
      </Button>
      <Button
        variant="secondary"
        size="sm"
        disabled={pendingAction !== null}
        onClick={async () => {
          const phoneCode = window.prompt("Enter Telegram verification code");
          if (!phoneCode) {
            return;
          }

          setPendingAction("verify-code");
          setMessage("Verifying Telegram code...");
          try {
            const result = await submitJson<{ loginState: string }>(`/api/accounts/${accountId}/verify-code`, { phoneCode });
            setMessage(result.ok ? `Login state: ${result.data.loginState}` : result.error);
          } catch (error) {
            setMessage(error instanceof Error ? error.message : "Failed to verify code");
          } finally {
            setPendingAction(null);
          }
        }}
      >
        {pendingAction === "verify-code" ? "Verifying..." : "Verify code"}
      </Button>
      <Button
        variant="secondary"
        size="sm"
        disabled={pendingAction !== null}
        onClick={async () => {
          const password = window.prompt("Enter Telegram 2FA password");
          if (!password) {
            return;
          }

          setPendingAction("verify-password");
          setMessage("Verifying Telegram 2FA password...");
          try {
            const result = await submitJson<{ loginState: string }>(`/api/accounts/${accountId}/verify-password`, { password });
            setMessage(result.ok ? `Login state: ${result.data.loginState}` : result.error);
          } catch (error) {
            setMessage(error instanceof Error ? error.message : "Failed to verify 2FA password");
          } finally {
            setPendingAction(null);
          }
        }}
      >
        {pendingAction === "verify-password" ? "Verifying 2FA..." : "Verify 2FA"}
      </Button>
      <Button
        variant="ghost"
        size="sm"
        disabled={pendingAction !== null}
        onClick={async () => {
          setPendingAction("refresh-dialogs");
          setMessage("Refreshing dialogs...");
          try {
            const result = await fetch(`/api/accounts/${accountId}/dialogs`);
            const json = await result.json();
            setMessage(json.ok ? `Fetched ${json.data.length} dialogs` : json.error);
            if (json.ok) {
              window.location.reload();
            }
          } catch (error) {
            setMessage(error instanceof Error ? error.message : "Failed to refresh dialogs");
          } finally {
            setPendingAction(null);
          }
        }}
      >
        {pendingAction === "refresh-dialogs" ? "Refreshing..." : "Refresh dialogs"}
      </Button>
      <ActionFeedback message={message} />
    </div>
  );
}

export function JobActionButtons({ jobId, status }: { jobId: string; status: string }) {
  const [message, setMessage] = useState<string | null>(null);

  async function runAction(path: string) {
    const result = await submitJson(path, {});
    setMessage(result.ok ? "Updated" : result.error);
    if (result.ok) {
      window.location.reload();
    }
  }

  return (
    <div className="flex flex-wrap gap-2 rounded-(--radius-xl) border border-border/70 bg-background/75 p-3">
      <Button variant="secondary" size="sm" onClick={() => runAction(`/api/jobs/${jobId}/pause`)} disabled={status !== "running" && status !== "pending"}>
        Pause
      </Button>
      <Button variant="secondary" size="sm" onClick={() => runAction(`/api/jobs/${jobId}/resume`)} disabled={status !== "paused" && status !== "failed"}>
        Resume
      </Button>
      <Button variant="danger" size="sm" onClick={() => runAction(`/api/jobs/${jobId}/cancel`)} disabled={status === "completed" || status === "cancelled"}>
        Cancel
      </Button>
      <Button variant="ghost" size="sm" onClick={() => runAction(`/api/jobs/${jobId}/retry-failed`)}>
        Retry failed
      </Button>
      <ActionFeedback message={message} />
    </div>
  );
}

export function AccountActionPanel({
  accountId,
  accountLabel,
  loginState,
  phoneNumber,
}: {
  accountId: string;
  accountLabel: string;
  loginState: string;
  phoneNumber: string;
}) {
  return (
    <Card className="surface-glass border-border/70 bg-white/60 shadow-[0_20px_48px_-32px_color-mix(in_oklab,var(--foreground)_16%,transparent)]">
      <CardHeader className="gap-3 border-b-0 pb-2">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="text-base text-foreground">{accountLabel}</CardTitle>
            <CardDescription>{phoneNumber}</CardDescription>
          </div>
          <Badge variant={loginState === "ready" ? "green" : "amber"}>{loginState}</Badge>
        </div>
      </CardHeader>
      <CardContent>
        <AccountActionButtons accountId={accountId} />
      </CardContent>
    </Card>
  );
}
