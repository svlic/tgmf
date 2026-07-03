export function loginStateVariant(status: string) {
  if (status === "ready") {
    return "green" as const;
  }

  if (status === "reauth_required" || status === "logged_out") {
    return "red" as const;
  }

  return "amber" as const;
}