import { headers } from "next/headers";

export async function getClientMeta() {
  const requestHeaders = await headers();
  return {
    ipAddress: requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown",
    userAgent: requestHeaders.get("user-agent") || "unknown",
  };
}
