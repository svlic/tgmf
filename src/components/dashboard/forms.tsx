"use client";

import { useEffect, useId, useRef, useState } from "react";
import { notifyAccountsMutated, notifyJobsMutated } from "@/lib/client-events";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Field, FieldDescription, FieldLabel, FieldMessage } from "@/components/ui/field";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CSRF_HEADER_NAME } from "@/lib/constants";
import { ALLOWED_MEDIA_TYPES } from "@/lib/types";
import type { SyncJobRow, TelegramLoginState } from "@/lib/types";

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
    throw new Error(`Unexpected response format (${response.status})`);
  }

  const result: JsonResult<TData> = await response.json();

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

export function AccountCreateForm({ onCreated }: { onCreated?: (accountId: string) => void }) {
  const [state, setState] = useState<FormState>({ error: null, success: null });
  return (
    <form
      className="grid gap-5 md:grid-cols-2 items-start"
      onSubmit={async (event) => {
        event.preventDefault();
        const form = event.currentTarget;
        setState({ error: null, success: null });
        const formData = new FormData(form);
        const payload = {
          label: String(formData.get("label") || ""),
          phoneNumber: String(formData.get("phoneNumber") || ""),
          apiIdOverride: String(formData.get("apiIdOverride") || ""),
          apiHashOverride: String(formData.get("apiHashOverride") || ""),
        };
        const result = await submitJson<{ account: { id: string } }>("/api/accounts", payload);
        if (!result.ok) {
          setState({ error: result.error, success: null });
          return;
        }
        setState({ error: null, success: "Account created. Continue with Telegram login below." });
        form.reset();
        onCreated?.(result.data.account.id);
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
      <details className="md:col-span-2 rounded-lg border border-border/70 p-4">
        <summary className="cursor-pointer text-sm font-medium">Custom API credentials (optional)</summary>
        <div className="mt-4 grid gap-5 md:grid-cols-2">
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
        </div>
      </details>
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
  const [selection, setSelection] = useState<"range" | "search">("range");
  const [mode, setMode] = useState<"forward" | "copy">("forward");
  const hasAccounts = accounts.length > 0;
  const selectedAccount = accounts.find((account) => account.id === selectedAccountId) ?? accounts[0] ?? null;

  return (
    <form
      className="space-y-6"
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
          sourceChannelRef: String(formData.get("sourceChannelRef") || "").trim(),
          targetChannelRef: String(formData.get("targetChannelRef") || "").trim(),
          startMessageId: String(formData.get("startMessageId") || ""),
          endMessageId: String(formData.get("endMessageId") || ""),
          selection: String(formData.get("selection") || "range"),
          searchQuery: String(formData.get("searchQuery") || "").trim(),
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
      <fieldset className="space-y-6" disabled={!hasAccounts} aria-disabled={!hasAccounts}>
        <fieldset className="grid gap-5 rounded-lg border border-border/70 p-5 md:grid-cols-2">
          <legend className="px-2 text-lg font-semibold">1. Account and channels</legend>
          <p className="text-sm text-muted-foreground md:col-span-2">Choose the account that can access both the source and target.</p>
          <Field className="md:col-span-2">
            <FieldLabel htmlFor="accountId">Telegram account</FieldLabel>
            <Select id="accountId" name="accountId" value={selectedAccountId} onChange={(event) => setSelectedAccountId(event.target.value)} required>
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.label} · {account.phoneNumber} · {account.dialogs.length} dialogs
                </option>
              ))}
            </Select>
            <FieldDescription>
              Source and target suggestions below come from cached dialogs for the selected account. You can still type a username, peer ID, or invite ref
              manually.
            </FieldDescription>
          </Field>
          <Field>
            <FieldLabel htmlFor="sourceChannelRef">Source channel</FieldLabel>
            <Input id="sourceChannelRef" name="sourceChannelRef" list="selected-account-dialogs" placeholder="username, peer ID, or invite ref" required />
            <FieldDescription>
              {selectedAccount
                ? `${selectedAccount.dialogs.length} cached dialogs available for ${selectedAccount.label}.`
                : "Select an account to use cached dialog suggestions."}
            </FieldDescription>
          </Field>
          <Field>
            <FieldLabel htmlFor="targetChannelRef">Target channel</FieldLabel>
            <Input id="targetChannelRef" name="targetChannelRef" list="selected-account-dialogs" placeholder="username, peer ID, or invite ref" required />
            <datalist id="selected-account-dialogs">
              {selectedAccount?.dialogs.map((dialog) => (
                <option
                  key={`${dialog.peerId}-${dialog.title}`}
                  value={getDialogRef(dialog)}
                  label={`${dialog.title} · ${dialog.entityType}${dialog.isPublic ? " · public" : " · private"}`}
                />
              ))}
            </datalist>
          </Field>
        </fieldset>
        <fieldset className="grid gap-5 rounded-lg border border-border/70 p-5 md:grid-cols-2">
          <legend className="px-2 text-lg font-semibold">2. Message selection</legend>
          <Field className="md:col-span-2">
            <FieldLabel htmlFor="selection">Message selection</FieldLabel>
            <Select id="selection" name="selection" value={selection} onChange={(event) => setSelection(event.target.value === "search" ? "search" : "range")}>
              <option value="range">ID range</option>
              <option value="search">Telegram search</option>
            </Select>
            <FieldDescription>
              Search uses Telegram&apos;s server-side query to pick candidates; keyword/regex and media filters still apply afterward.
            </FieldDescription>
          </Field>
          <Field className="md:col-span-2" hidden={selection !== "search"}>
            <FieldLabel htmlFor="searchQuery">Search query</FieldLabel>
            <Input
              id="searchQuery"
              name="searchQuery"
              maxLength={512}
              placeholder="Keywords Telegram should match"
              disabled={selection !== "search"}
              required={selection === "search"}
            />
            <FieldDescription>Required for search selection. Independent from keyword whitelist filters below.</FieldDescription>
          </Field>
          <Field>
            <FieldLabel htmlFor="startMessageId">Start message ID</FieldLabel>
            <Input
              id="startMessageId"
              name="startMessageId"
              type="number"
              min={1}
              placeholder="1"
              required={selection === "range"}
              aria-describedby="startMessageId-description"
            />
            <FieldDescription id="startMessageId-description">
              {selection === "search" ? "Optional bounds for search results (inclusive min ID)." : "First message ID in the transfer range (inclusive)."}
            </FieldDescription>
          </Field>
          <Field>
            <FieldLabel htmlFor="endMessageId">End message ID</FieldLabel>
            <Input
              id="endMessageId"
              name="endMessageId"
              type="number"
              min={1}
              placeholder="100"
              required={selection === "range"}
              aria-describedby="endMessageId-description"
            />
            <FieldDescription id="endMessageId-description">
              {selection === "search" ? "Optional bounds for search results (inclusive max ID)." : "Last message ID in the transfer range (inclusive)."}
            </FieldDescription>
          </Field>
        </fieldset>
        <fieldset className="grid gap-5 rounded-lg border border-border/70 p-5 md:grid-cols-2">
          <legend className="px-2 text-lg font-semibold">3. Transfer settings</legend>
          <Field>
            <FieldLabel htmlFor="mode">Transfer mode</FieldLabel>
            <Select id="mode" name="mode" value={mode} onChange={(event) => setMode(event.target.value === "copy" ? "copy" : "forward")}>
              <option value="forward">Forward</option>
              <option value="copy">Copy</option>
            </Select>
            <FieldDescription>
              {mode === "forward"
                ? "Forward messages with their original source attribution."
                : "Send new copies without source attribution. Album members are copied individually."}
            </FieldDescription>
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
              <option value="full_group">All eligible album members</option>
              <option value="captioned_only">Only the member with a caption</option>
            </Select>
            <FieldDescription>
              {mode === "forward"
                ? "Forward selected album members together, within the message bounds and filters."
                : "Copy selected album members separately; album grouping is not preserved."}{" "}
              Caption selection only affects albums, not standalone messages.
            </FieldDescription>
          </Field>
          <Field>
            <FieldLabel htmlFor="delaySeconds">Delay between messages</FieldLabel>
            <Input id="delaySeconds" name="delaySeconds" type="number" min={0} defaultValue={2} placeholder="2" required />
            <FieldDescription>Throttle sends when the target channel is rate sensitive.</FieldDescription>
          </Field>
        </fieldset>
        <fieldset className="space-y-4 rounded-lg border border-border/70 p-5">
          <legend className="px-2 text-lg font-semibold">4. Filters (optional)</legend>
          <p className="text-sm text-muted-foreground">
            No filters are applied by default. Expand a section to configure filters; collapsing it keeps your values active.
          </p>
          <details className="rounded-lg border border-border/70 p-4">
            <summary className="cursor-pointer text-sm font-medium">Media types</summary>
            <div className="mt-4">
              <Field className="md:col-span-2">
                <FieldLabel>Allowed media types</FieldLabel>
                <div className="grid gap-2 rounded-lg border border-border/70 bg-muted/40 p-3 sm:grid-cols-2 lg:grid-cols-3">
                  {ALLOWED_MEDIA_TYPES.map((mediaType) => (
                    <label key={mediaType} className="flex items-center gap-2 rounded-md border border-border/60 bg-card px-3 py-2 text-sm text-foreground">
                      <input
                        type="checkbox"
                        name="allowedMediaTypes"
                        value={mediaType}
                        className="size-4 rounded border-border text-foreground accent-foreground"
                      />
                      <span>{mediaType}</span>
                    </label>
                  ))}
                </div>
                <FieldDescription>Leave all media types unchecked to allow every supported type with no filtering.</FieldDescription>
              </Field>
            </div>
          </details>
          <details className="rounded-lg border border-border/70 p-4">
            <summary className="cursor-pointer text-sm font-medium">Keywords and regular expressions</summary>
            <div className="mt-4 grid gap-5 lg:grid-cols-2">
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
          </details>
        </fieldset>
        <div className="flex flex-wrap items-center justify-between gap-4 pt-2">
          <div className="space-y-2">
            <Button type="submit" disabled={!hasAccounts}>
              Create draft
            </Button>
            <p className="text-xs text-muted-foreground">Review the job details before starting the transfer.</p>
          </div>
          <FormFeedback state={state} />
        </div>
      </fieldset>
    </form>
  );
}

export function AccountActionButtons({
  accountId,
  accountLabel,
  loginState,
  focusLogin = false,
}: {
  accountId: string;
  accountLabel: string;
  loginState: TelegramLoginState;
  focusLogin?: boolean;
}) {
  const phoneCodeId = useId();
  const passwordId = useId();
  const [feedback, setFeedback] = useState<{ message: string; tone: FeedbackTone } | null>(null);
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [phoneCode, setPhoneCode] = useState("");
  const [password, setPassword] = useState("");
  const loginPanelRef = useRef<HTMLDivElement>(null);
  const disabled = pendingAction !== null;
  const ready = loginState === "ready";

  useEffect(() => {
    if (focusLogin) {
      loginPanelRef.current?.querySelector("button")?.focus();
      loginPanelRef.current?.scrollIntoView({ block: "center", behavior: "smooth" });
    }
  }, [focusLogin]);

  async function runAccountAction<TData>(
    action: string,
    loadingMessage: string,
    request: () => Promise<JsonResult<TData>>,
    onSuccess: (data: TData) => string,
  ) {
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
    <div ref={loginPanelRef} className="grid gap-3 rounded-lg border border-border/70 bg-background/75 p-3">
      <p className="text-sm text-muted-foreground">
        {ready
          ? "Telegram login complete. Refresh dialogs to choose channels for a transfer job."
          : loginState === "awaiting_code"
            ? "Step 2 of 3 · Enter the verification code sent to your Telegram app."
            : loginState === "awaiting_password"
              ? "Step 3 of 3 · Telegram requires your two-factor password."
              : loginState === "reauth_required"
                ? "Your session needs renewal. Request a new verification code to log in again."
                : "Step 1 of 3 · Request a Telegram verification code. Two-factor verification is only shown if required."}
      </p>
      <div className="flex flex-wrap gap-2">
        {ready ? (
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
        ) : null}
        {!ready ? (
          <Button
            variant={loginState === "awaiting_code" || loginState === "awaiting_password" ? "secondary" : "default"}
            size="sm"
            disabled={disabled}
            onClick={() => {
              void runAccountAction(
                "start-login",
                "Requesting Telegram verification code...",
                () => submitJson<{ loginState: string }>(`/api/accounts/${accountId}/start-login`, {}),
                () => {
                  setPhoneCode("");
                  setPassword("");
                  notifyAccountsMutated();
                  return "Verification code requested. Enter the code from Telegram below.";
                },
              );
            }}
          >
            {pendingAction === "start-login"
              ? "Requesting code..."
              : loginState === "awaiting_code" || loginState === "awaiting_password"
                ? "Restart login"
                : "Send verification code"}
          </Button>
        ) : null}
        {ready ? (
          <Button
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
        ) : null}
      </div>

      {loginState === "awaiting_code" ? (
        <div>
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
                  return data.loginState === "ready" ? "Telegram login complete." : "Code accepted. Enter your two-factor password.";
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
                  autoFocus
                />
                <Button type="submit" size="sm" disabled={disabled} className="h-11 shrink-0">
                  {pendingAction === "verify-code" ? "Verifying..." : "Verify code"}
                </Button>
              </div>
            </Field>
          </form>
        </div>
      ) : null}

      {loginState === "awaiting_password" ? (
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
              () => submitJson(`/api/accounts/${accountId}/verify-password`, { password }),
              () => {
                setPassword("");
                notifyAccountsMutated();
                return "Telegram login complete.";
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
                autoFocus
              />
              <Button type="submit" size="sm" disabled={disabled} className="h-11 shrink-0">
                {pendingAction === "verify-password" ? "Verifying 2FA..." : "Verify 2FA"}
              </Button>
            </div>
          </Field>
        </form>
      ) : null}

      <details className="rounded-lg border border-border/60 p-3">
        <summary className="cursor-pointer text-sm text-muted-foreground">Account management</summary>
        <div className="mt-3 flex flex-wrap gap-2">
          {ready ? (
            <Button
              variant="secondary"
              size="sm"
              disabled={disabled}
              onClick={() => {
                void runAccountAction(
                  "start-login",
                  "Requesting Telegram verification code...",
                  () => submitJson(`/api/accounts/${accountId}/start-login`, {}),
                  () => {
                    setPhoneCode("");
                    setPassword("");
                    notifyAccountsMutated();
                    return "Verification code requested.";
                  },
                );
              }}
            >
              Log in again
            </Button>
          ) : null}
          <Button
            variant="danger"
            size="sm"
            disabled={disabled}
            onClick={() => {
              const confirmed = window.confirm(`Delete account "${accountLabel}"? This removes its saved login session and cached dialogs.`);
              if (!confirmed) {
                return;
              }

              void runAccountAction(
                "delete-account",
                "Deleting account...",
                () => submitJson<{ deleted: boolean }>(`/api/accounts/${accountId}`, {}, "DELETE"),
                () => {
                  notifyAccountsMutated();
                  return "Account deleted";
                },
              );
            }}
          >
            {pendingAction === "delete-account" ? "Deleting..." : "Delete"}
          </Button>
        </div>
      </details>

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
      {status === "draft" ? (
        <Button
          size="sm"
          onClick={() => {
            void runAction("start", `/api/jobs/${jobId}/start`, "Starting job...", "Job started");
          }}
          disabled={disabled}
        >
          {pendingAction === "start" ? "Starting..." : "Start"}
        </Button>
      ) : null}
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
  loginState: TelegramLoginState;
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
        <AccountActionButtons accountId={accountId} accountLabel={accountLabel} loginState={loginState} />
      </CardContent>
    </Card>
  );
}
