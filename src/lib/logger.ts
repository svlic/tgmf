type LogFields = Record<string, string | number | boolean | readonly (number | null)[] | null | undefined>;

// Callers supply diagnostic metadata only, never raw errors, credentials or message content.
export function systemLog(level: "info" | "warn" | "error", event: string, fields: LogFields = {}) {
  console[level](JSON.stringify({ timestamp: new Date().toISOString(), level, event, ...fields }));
}

export function systemErrorFields(error: unknown): LogFields {
  const candidate = error as { name?: unknown; code?: unknown; errorMessage?: unknown } | null;
  const code = candidate?.code ?? candidate?.errorMessage;
  return {
    errorName: error instanceof Error ? error.name : "UnknownError",
    errorCode: typeof code === "string" && /^[A-Z0-9_]+$/.test(code) ? code : undefined,
  };
}
