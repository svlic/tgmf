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

async function submitJson(url: string, body: unknown, method = "POST") {
  const response = await fetch(url, {
    method,
    headers: {
      "content-type": "application/json",
      "x-tgmf-csrf": window.location.host,
    },
    body: JSON.stringify(body),
  });

  return response.json();
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
        const formData = new FormData(event.currentTarget);
        const result = await submitJson("/api/auth/login", {
          password: String(formData.get("password") || ""),
        });
        setLoading(false);
        if (!result.ok) {
          setState({ error: result.error, success: null });
          return;
        }
        window.location.href = "/";
      }}
    >
      <Field>
        <FieldLabel htmlFor="password">Administrator password</FieldLabel>
        <Input id="password" type="password" name="password" placeholder="Enter the server password" required />
        <FieldDescription>The password is validated against the runtime server environment.</FieldDescription>
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
        window.location.href = "/login";
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
      <div className="md:col-span-2 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
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
      <div className="md:col-span-2 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Button type="submit">Create job</Button>
        <FormFeedback state={state} />
      </div>
    </form>
  );
}

export function AccountActionButtons({ accountId }: { accountId: string }) {
  const [message, setMessage] = useState<string | null>(null);

  return (
    <div className="flex flex-wrap gap-2">
      <Button
        variant="secondary"
        size="sm"
        onClick={async () => {
          const result = await submitJson(`/api/accounts/${accountId}/connectivity`, {});
          setMessage(result.ok ? "Connectivity checked" : result.error);
        }}
      >
        Test connection
      </Button>
      <Button
        variant="secondary"
        size="sm"
        onClick={async () => {
          const result = await submitJson(`/api/accounts/${accountId}/start-login`, {});
          setMessage(result.ok ? `Code requested: ${result.data.phoneCodeHash}` : result.error);
        }}
      >
        Start login
      </Button>
      <Button
        variant="secondary"
        size="sm"
        onClick={async () => {
          const phoneCode = window.prompt("Enter Telegram verification code");
          const phoneCodeHash = window.prompt("Enter phoneCodeHash from start login result");
          if (!phoneCode || !phoneCodeHash) {
            return;
          }
          const result = await submitJson(`/api/accounts/${accountId}/verify-code`, { phoneCode, phoneCodeHash });
          setMessage(result.ok ? `Login state: ${result.data.loginState}` : result.error);
        }}
      >
        Verify code
      </Button>
      <Button
        variant="secondary"
        size="sm"
        onClick={async () => {
          const password = window.prompt("Enter Telegram 2FA password");
          if (!password) {
            return;
          }
          const result = await submitJson(`/api/accounts/${accountId}/verify-password`, { password });
          setMessage(result.ok ? `Login state: ${result.data.loginState}` : result.error);
        }}
      >
        Verify 2FA
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={async () => {
          const result = await fetch(`/api/accounts/${accountId}/dialogs`);
          const json = await result.json();
          setMessage(json.ok ? `Fetched ${json.data.length} dialogs` : json.error);
          if (json.ok) {
            window.location.reload();
          }
        }}
      >
        Refresh dialogs
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
    <div className="flex flex-wrap gap-2">
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
    <Card className="border-slate-200/80 bg-slate-50/80">
      <CardHeader className="gap-3 border-b-0 pb-2">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="text-base">{accountLabel}</CardTitle>
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
