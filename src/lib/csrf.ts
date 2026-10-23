import { headers } from "next/headers";
import { CSRF_HEADER_NAME } from "@/lib/constants";

export async function assertCsrf() {
  const requestHeaders = await headers();
  const origin = requestHeaders.get("origin");
  const host = requestHeaders.get("host");

  if (!origin || !host) {
    throw new Error("Missing CSRF headers");
  }

  const originUrl = new URL(origin);
  if (originUrl.host !== host) {
    throw new Error("Invalid CSRF origin");
  }

  const csrfHeader = requestHeaders.get(CSRF_HEADER_NAME);
  if (csrfHeader !== host) {
    throw new Error("Invalid CSRF token");
  }
}
