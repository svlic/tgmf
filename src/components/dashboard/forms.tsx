"use client";

import { useId, useState } from "react";
import { notifyAccountsMutated } from "@/lib/accounts-client-events";
import { notifyJobsMutated } from "@/lib/jobs-client-events";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Field, FieldDescription, FieldLabel, FieldMessage } from "@/components/ui/field";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CSRF_HEADER_NAME } from "@/lib/constants";
import { ALLOWED_MEDIA_TYPES } from "@/lib/types";
import type { SyncJobRow } from "@/lib/types";

type FormState = {
  error: string | null;
  success: string | null;
};

type FeedbackTone = "default" | "error" | "success";

type JsonResult<TData = unknown> =
  | {
      ok: true;
      data: TData;
    }
  | {
      ok: false;
      error: string;
    };

function parseFilterLines(value: FormDataEntryValue | null) {
  return String(value || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

async function submitJson<TData = unknown>(url: string, body: unknown, method = "POST"): Promise<JsonResult<TData>> {
  const response = await fetch(url, {
    method,
    headers: {
      "content-type": "application/json",
      [CSRF_HEADER_NAME]: window.location.host,
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

function ActionFeedback({ feedback }: { feedback: { message: string; tone: FeedbackTone } | null }) {
  if (!feedback) {
    return null;
  }

  return (
    <FieldMessage tone={feedback.tone} className="basis-full">
      {feedback.message}
    </FieldMessage>
  );
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

        try {
          const result = await submitJson("/api/auth/login", {
            password: String(formData.get("password") || ""),
          });
          if (!result.ok) {
            setState({ error: result.error, success: null });
            return;
          }
          window.location.replace("/");
        } catch (error) {
          const message = error instanceof Error ? error.message : "Login failed";
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
      variant="ghost"
      size="sm"
      className="w-full justify-start text-muted-foreground hover:text-foreground"
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
      className="grid gap-5 md:grid-cols-2 items-start"
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
        notifyAccountsMutated();
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
      <div className="md:col-span-2 flex flex-wrap items-center justify-between gap-4 pt-2">
        <Button type="submit">Add account</Button>
        <FormFeedback state={state} />
      </div>
    </form>
  );
}

type JobAccountOption = {
  id: string;
  label: string;
  phoneNumber: string;
  dialogs: Array<{
    peerId: string;
    title: string;
    username: string | null;
    entityType: string;
    isPublic: boolean;
  }>;
};

function getDialogRef(dialog: JobAccountOption["dialogs"][number]) {
  return dialog.username ? `@${dialog.username}` : dialog.peerId;
}

export function JobCreateForm({ accounts }: { accounts: JobAccountOption[] }) {
  const [state, setState] = useState<FormState>({ error: null, success: null });
  const [selectedAccountId, setSelectedAccountId] = useState(accounts[0]?.id ?? "");
  const hasAccounts = accounts.length > 0;
  const selectedAccount = accounts.find((account) => account.id === selectedAccountId) ?? accounts[0] ?? null;

  return (
    <form
      className="grid gap-5 md:grid-cols-2"
      onSubmit={async (event) => {
        event.preventDefault();
        setState({ error: null, success: null });

        if (!hasAccounts) {
          setState({ error: "Add and authenticate a Telegram account before creating a job.", success: null });
          return;
        }
        const formData = new FormData(event.currentTarget);
        const payload = {
          accountId: selectedAccountId,
          sourceChannelRef: String(formData.get("sourceChannelRef") || ""),
          targetChannelRef: String(formData.get("targetChannelRef") || ""),
          startMessageId: Number(formData.get("startMessageId") || 0),
          endMessageId: Number(formData.get("endMessageId") || 0),
          jobOrder: String(formData.get("jobOrder") || "asc"),
          mode: String(formData.get("mode") || "forward"),
          albumStrategy: String(formData.get("albumStrategy") || "full_group"),
          delaySeconds: Number(formData.get("delaySeconds") || 2),
          allowedMediaTypes: formData.getAll("allowedMediaTypes").map(String),
          keywordWhitelist: parseFilterLines(formData.get("keywordWhitelist")),
          keywordBlacklist: parseFilterLines(formData.get("keywordBlacklist")),
          regexWhitelist: parseFilterLines(formData.get("regexWhitelist")),
          regexBlacklist: parseFilterLines(formData.get("regexBlacklist")),
        };
        const result = await submitJson<{ job: SyncJobRow | null }>("/api/jobs", payload);
        if (!result.ok) {
          setState({ error: result.error, success: null });
          return;
        }

        if (!result.data.job) {
          setState({ error: "Job was created, but the server did not return its details.", success: null });
          return;
        }

        setState({ error: null, success: "Job created" });
        window.location.replace(`/jobs/${result.data.job.id}`);
      }}
    >
      <fieldset className="contents" disabled={!hasAccounts} aria-disabled={!hasAccounts}>
        <Field>
          <FieldLabel htmlFor="accountId">Telegram account</FieldLabel>
          <Select
            id="accountId"
            name="accountId"
            value={selectedAccountId}
            onChange={(event) => setSelectedAccountId(event.target.value)}
            required
          >
            {accounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.label} · {account.phoneNumber} · {account.dialogs.length} dialogs
              </option>
            ))}
          </Select>
          <FieldDescription>
            Source and target suggestions below come from cached dialogs for the selected account. You can still type a username, peer ID, or invite ref manually.
          </FieldDescription>
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
          <Input id="sourceChannelRef" name="sourceChannelRef" list="selected-account-dialogs" placeholder="username, peer ID, or invite ref" required />
          <FieldDescription>
            {selectedAccount ? `${selectedAccount.dialogs.length} cached dialogs available for ${selectedAccount.label}.` : "Select an account to use cached dialog suggestions."}
          </FieldDescription>
        </Field>
        <Field>
          <FieldLabel htmlFor="targetChannelRef">Target channel</FieldLabel>
          <Input id="targetChannelRef" name="targetChannelRef" list="selected-account-dialogs" placeholder="username, peer ID, or invite ref" required />
          <datalist id="selected-account-dialogs">
            {selectedAccount?.dialogs.map((dialog) => (
              <option key={`${dialog.peerId}-${dialog.title}`} value={getDialogRef(dialog)} label={`${dialog.title} · ${dialog.entityType}${dialog.isPublic ? " · public" : " · private"}`} />
            ))}
          </datalist>
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
          <FieldDescription>
            full_group is not fully implemented yet—album media may be incomplete. captioned_only applies only inside Telegram albums; single messages are unaffected.
          </FieldDescription>
        </Field>
        <Field className="md:col-span-2">
          <FieldLabel htmlFor="delaySeconds">Delay between messages</FieldLabel>
          <Input id="delaySeconds" name="delaySeconds" type="number" min={0} defaultValue={2} placeholder="2" required />
          <FieldDescription>Throttle sends when the target channel is rate sensitive.</FieldDescription>
        </Field>
        <Field className="md:col-span-2">
          <FieldLabel>Allowed media types</FieldLabel>
          <div className="grid gap-2 rounded-lg border border-border/70 bg-muted/40 p-3 sm:grid-cols-2 lg:grid-cols-3">
            {ALLOWED_MEDIA_TYPES.map((mediaType) => (
              <label key={mediaType} className="flex items-center gap-2 rounded-md border border-border/60 bg-card px-3 py-2 text-sm text-foreground">
                <input type="checkbox" name="allowedMediaTypes" value={mediaType} className="size-4 rounded border-border text-foreground accent-foreground" />
                <span>{mediaType}</span>
              </label>
            ))}
          </div>
          <FieldDescription>Leave all media types unchecked to allow every supported type with no filtering.</FieldDescription>
        </Field>
        <div className="md:col-span-2 grid gap-5 lg:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="keywordWhitelist">Keyword whitelist</FieldLabel>
            <Textarea id="keywordWhitelist" name="keywordWhitelist" placeholder="One keyword per line" />
            <FieldDescription>If set, a message must contain at least one keyword or whitelist regex to be transferred.</FieldDescription>
          </Field>
          <Field>
            <FieldLabel htmlFor="keywordBlacklist">Keyword blacklist</FieldLabel>
            <Textarea id="keywordBlacklist" name="keywordBlacklist" placeholder="One keyword per line" />
            <FieldDescription>Messages containing any blacklist keyword are skipped before whitelist checks.</FieldDescription>
          </Field>
          <Field>
            <FieldLabel htmlFor="regexWhitelist">Regex whitelist</FieldLabel>
            <Textarea id="regexWhitelist" name="regexWhitelist" placeholder="One regular expression per line" />
            <FieldDescription>Regular expressions are matched against message text and captions.</FieldDescription>
          </Field>
          <Field>
            <FieldLabel htmlFor="regexBlacklist">Regex blacklist</FieldLabel>
            <Textarea id="regexBlacklist" name="regexBlacklist" placeholder="One regular expression per line" />
            <FieldDescription>Blacklist regex matches take priority over whitelist matches.</FieldDescription>
          </Field>
        </div>
        <div className="md:col-span-2 flex flex-wrap items-center justify-between gap-4 pt-2">
          <Button type="submit" disabled={!hasAccounts}>Create job</Button>
          <FormFeedback state={state} />
        </div>
      </fieldset>
    </form>
  );
}

export function AccountActionButtons({ accountId }: { accountId: string }) {
  const phoneCodeId = useId();
  const passwordId = useId();
  const [feedback, setFeedback] = useState<{ message: string; tone: FeedbackTone } | null>(null);
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [phoneCode, setPhoneCode] = useState("");
  const [password, setPassword] = useState("");
  const disabled = pendingAction !== null;

  async function runAccountAction<TData>(action: string, loadingMessage: string, request: () => Promise<JsonResult<TData>>, onSuccess: (data: TData) => string) {
    setPendingAction(action);
    setFeedback({ message: loadingMessage, tone: "default" });
    try {
      const result = await request();
      if (!result.ok) {
        setFeedback({ message: result.error, tone: "error" });
        return false;
      }

      setFeedback({ message: onSuccess(result.data), tone: "success" });
      return true;
    } catch (error) {
      setFeedback({ message: error instanceof Error ? error.message : "Account action failed", tone: "error" });
      return false;
    } finally {
      setPendingAction(null);
    }
  }

  return (
    <div className="grid gap-3 rounded-lg border border-border/70 bg-background/75 p-3">
      <div className="flex flex-wrap gap-2">
        <Button
          variant="secondary"
          size="sm"
          disabled={disabled}
          onClick={() => {
            void runAccountAction(
              "connectivity",
              "Checking connectivity...",
              () => submitJson(`/api/accounts/${accountId}/connectivity`, {}),
              () => {
                notifyAccountsMutated();
                return "Connectivity checked";
              },
            );
          }}
        >
          {pendingAction === "connectivity" ? "Testing..." : "Test connection"}
        </Button>
        <Button
          variant="secondary"
          size="sm"
          disabled={disabled}
          onClick={() => {
            void runAccountAction(
              "start-login",
              "Requesting Telegram verification code...",
              () => submitJson<{ loginState: string }>(`/api/accounts/${accountId}/start-login`, {}),
              () => {
                notifyAccountsMutated();
                return "Verification code requested. Enter the code from Telegram below.";
              },
            );
          }}
        >
          {pendingAction === "start-login" ? "Requesting code..." : "Start login"}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          disabled={disabled}
          onClick={async () => {
            const refreshed = await runAccountAction(
              "refresh-dialogs",
              "Refreshing dialogs...",
              () => submitJson<{ dialogs: unknown[] }>(`/api/accounts/${accountId}/dialogs`, {}),
              (data) => `Fetched ${data.dialogs.length} dialogs`,
            );

            if (refreshed) {
              notifyAccountsMutated();
            }
          }}
        >
          {pendingAction === "refresh-dialogs" ? "Refreshing..." : "Refresh dialogs"}
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <form
          className="rounded-lg border border-border/60 bg-card p-3"
          onSubmit={(event) => {
            event.preventDefault();
            const trimmedCode = phoneCode.trim();
            if (!trimmedCode) {
              setFeedback({ message: "Enter the Telegram verification code first.", tone: "error" });
              return;
            }

            void runAccountAction(
              "verify-code",
              "Verifying Telegram code...",
              () => submitJson<{ loginState: string }>(`/api/accounts/${accountId}/verify-code`, { phoneCode: trimmedCode }),
              (data) => {
                setPhoneCode("");
                notifyAccountsMutated();
                return `Login state: ${data.loginState}`;
              },
            );
          }}
        >
          <Field>
            <FieldLabel htmlFor={phoneCodeId}>Verification code</FieldLabel>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input
                id={phoneCodeId}
                value={phoneCode}
                onChange={(event) => setPhoneCode(event.target.value)}
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="Code from Telegram"
                disabled={disabled}
              />
              <Button type="submit" size="sm" variant="secondary" disabled={disabled} className="h-11 shrink-0">
                {pendingAction === "verify-code" ? "Verifying..." : "Verify code"}
              </Button>
            </div>
            <FieldDescription>Use this after Start login sends a Telegram code.</FieldDescription>
          </Field>
        </form>

        <form
          className="rounded-lg border border-border/60 bg-card p-3"
          onSubmit={(event) => {
            event.preventDefault();
            if (!password) {
              setFeedback({ message: "Enter the Telegram 2FA password first.", tone: "error" });
              return;
            }

            void runAccountAction(
              "verify-password",
              "Verifying Telegram 2FA password...",
              () => submitJson<{ loginState: string }>(`/api/accounts/${accountId}/verify-password`, { password }),
              (data) => {
                setPassword("");
                notifyAccountsMutated();
                return `Login state: ${data.loginState}`;
              },
            );
          }}
        >
          <Field>
            <FieldLabel htmlFor={passwordId}>Two-factor password</FieldLabel>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input
                id={passwordId}
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="current-password"
                placeholder="Telegram 2FA password"
                disabled={disabled}
              />
              <Button type="submit" size="sm" variant="secondary" disabled={disabled} className="h-11 shrink-0">
                {pendingAction === "verify-password" ? "Verifying 2FA..." : "Verify 2FA"}
              </Button>
            </div>
            <FieldDescription>Only needed when Telegram requests cloud password verification.</FieldDescription>
          </Field>
        </form>
      </div>

      <ActionFeedback feedback={feedback} />
    </div>
  );
}

export function JobActionButtons({ jobId, status }: { jobId: string; status: string }) {
  const [feedback, setFeedback] = useState<{ message: string; tone: FeedbackTone } | null>(null);
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const disabled = pendingAction !== null;

  async function runAction(action: string, path: string, loadingMessage: string, successMessage: string) {
    setPendingAction(action);
    setFeedback({ message: loadingMessage, tone: "default" });
    try {
      const result = await submitJson(path, {});
      if (!result.ok) {
        setFeedback({ message: result.error, tone: "error" });
        return;
      }

      setFeedback({ message: successMessage, tone: "success" });
      notifyJobsMutated();
    } catch (error) {
      setFeedback({ message: error instanceof Error ? error.message : "Job action failed", tone: "error" });
    } finally {
      setPendingAction(null);
    }
  }

  return (
    <div className="flex flex-wrap gap-2 rounded-lg border border-border/70 bg-background/75 p-3">
      <Button
        variant="secondary"
        size="sm"
        onClick={() => {
          void runAction("pause", `/api/jobs/${jobId}/pause`, "Pausing job...", "Job paused");
        }}
        disabled={disabled || !["pending", "running"].includes(status)}
      >
        {pendingAction === "pause" ? "Pausing..." : "Pause"}
      </Button>
      <Button
        variant="secondary"
        size="sm"
        onClick={() => {
          void runAction("resume", `/api/jobs/${jobId}/resume`, "Resuming job...", "Job resumed");
        }}
        disabled={disabled || status !== "paused"}
      >
        {pendingAction === "resume" ? "Resuming..." : "Resume"}
      </Button>
      <Button
        variant="danger"
        size="sm"
        onClick={() => {
          void runAction("cancel", `/api/jobs/${jobId}/cancel`, "Cancelling job...", "Job cancelled");
        }}
        disabled={disabled || status === "completed" || status === "cancelled"}
      >
        {pendingAction === "cancel" ? "Cancelling..." : "Cancel"}
      </Button>
      <ActionFeedback feedback={feedback} />
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
    <Card>
      <CardHeader className="gap-3 pb-2">
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
