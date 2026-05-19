"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";

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

export function LoginForm() {
  const [state, setState] = useState<FormState>({ error: null, success: null });
  const [loading, setLoading] = useState(false);

  return (
    <form
      className="space-y-4"
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
      <Input type="password" name="password" placeholder="Admin password" required />
      {state.error ? <p className="text-sm text-red-600">{state.error}</p> : null}
      <Button type="submit" disabled={loading} className="w-full">
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
      className="grid gap-3 md:grid-cols-2"
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
      <Input name="label" placeholder="Account label" required />
      <Input name="phoneNumber" placeholder="Phone number" required />
      <Input name="apiIdOverride" placeholder="API ID override (optional)" />
      <Input name="apiHashOverride" placeholder="API hash override (optional)" />
      <div className="md:col-span-2 flex items-center gap-3">
        <Button type="submit">Add account</Button>
        {state.error ? <p className="text-sm text-red-600">{state.error}</p> : null}
        {state.success ? <p className="text-sm text-emerald-600">{state.success}</p> : null}
      </div>
    </form>
  );
}

export function JobCreateForm({ accounts }: { accounts: Array<{ id: string; label: string }> }) {
  const [state, setState] = useState<FormState>({ error: null, success: null });
  return (
    <form
      className="grid gap-3 md:grid-cols-2"
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
      <Select name="accountId" required>
        <option value="">Select account</option>
        {accounts.map((account) => (
          <option key={account.id} value={account.id}>
            {account.label}
          </option>
        ))}
      </Select>
      <Input name="sourceChannelRef" placeholder="Source channel username / ID / invite ref" required />
      <Input name="targetChannelRef" placeholder="Target channel username / ID / invite ref" required />
      <Input name="startMessageId" type="number" min={1} placeholder="Start message ID" required />
      <Input name="endMessageId" type="number" min={1} placeholder="End message ID" required />
      <Select name="jobOrder" defaultValue="asc">
        <option value="asc">Ascending</option>
        <option value="desc">Descending</option>
      </Select>
      <Select name="mode" defaultValue="forward">
        <option value="forward">Forward</option>
        <option value="copy">Copy</option>
      </Select>
      <Select name="albumStrategy" defaultValue="full_group">
        <option value="full_group">full_group</option>
        <option value="captioned_only">captioned_only</option>
      </Select>
      <Input name="delaySeconds" type="number" min={0} defaultValue={2} placeholder="Delay seconds" required />
      <div className="md:col-span-2 flex items-center gap-3">
        <Button type="submit">Create job</Button>
        {state.error ? <p className="text-sm text-red-600">{state.error}</p> : null}
        {state.success ? <p className="text-sm text-emerald-600">{state.success}</p> : null}
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
        onClick={async () => {
          const result = await submitJson(`/api/accounts/${accountId}/connectivity`, {});
          setMessage(result.ok ? "Connectivity checked" : result.error);
        }}
      >
        Test connection
      </Button>
      <Button
        variant="secondary"
        onClick={async () => {
          const result = await submitJson(`/api/accounts/${accountId}/start-login`, {});
          setMessage(result.ok ? `Code requested: ${result.data.phoneCodeHash}` : result.error);
        }}
      >
        Start login
      </Button>
      <Button
        variant="secondary"
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
        variant="secondary"
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
      {message ? <p className="basis-full text-sm text-slate-600">{message}</p> : null}
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
      <Button variant="secondary" onClick={() => runAction(`/api/jobs/${jobId}/pause`)} disabled={status !== "running" && status !== "pending"}>
        Pause
      </Button>
      <Button variant="secondary" onClick={() => runAction(`/api/jobs/${jobId}/resume`)} disabled={status !== "paused" && status !== "failed"}>
        Resume
      </Button>
      <Button variant="danger" onClick={() => runAction(`/api/jobs/${jobId}/cancel`)} disabled={status === "completed" || status === "cancelled"}>
        Cancel
      </Button>
      <Button variant="secondary" onClick={() => runAction(`/api/jobs/${jobId}/retry-failed`)}>
        Retry failed
      </Button>
      {message ? <p className="basis-full text-sm text-slate-600">{message}</p> : null}
    </div>
  );
}
