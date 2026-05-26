import bcrypt from "bcryptjs";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { AUTH_COOKIE_NAME, CSRF_HEADER_NAME } from "@/lib/constants";
import { getAdminPassword } from "@/lib/env";
import { signAdminSession, verifyAdminSession } from "@/lib/crypto";

const AUTH_LOG_PREFIX = "[admin-auth]";

function logAuthEvent(message: string, details?: Record<string, unknown>) {
  console.info(AUTH_LOG_PREFIX, message, details ?? {});
}

function logAuthWarning(message: string, details?: Record<string, unknown>) {
  console.warn(AUTH_LOG_PREFIX, message, details ?? {});
}

async function isHttpsRequest() {
  const requestHeaders = await headers();
  const forwardedProto = requestHeaders.get("x-forwarded-proto")?.split(",")[0]?.trim();
  if (forwardedProto) {
    return forwardedProto === "https";
  }

  const origin = requestHeaders.get("origin");
  return origin ? new URL(origin).protocol === "https:" : false;
}

export async function verifyAdminPassword(password: string) {
  const configured = getAdminPassword();

  if (configured.startsWith("$2a$") || configured.startsWith("$2b$") || configured.startsWith("$2y$")) {
    return bcrypt.compare(password, configured);
  }

  return password === configured;
}

export async function createAdminSession() {
  const token = await signAdminSession({ authenticated: true, issuedAt: Date.now() });
  const cookieStore = await cookies();
  const secure = await isHttpsRequest();

  cookieStore.set(AUTH_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure,
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
  logAuthEvent("admin session cookie scheduled", { secure, sameSite: "lax", path: "/" });
}

export async function clearAdminSession() {
  const cookieStore = await cookies();
  cookieStore.delete(AUTH_COOKIE_NAME);
}

export async function getAdminSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_COOKIE_NAME)?.value;

  if (!token) {
    logAuthEvent("admin session cookie missing");
    return null;
  }

  try {
    const session = await verifyAdminSession(token);
    logAuthEvent("admin session verified", { authenticated: session.authenticated });
    return session;
  } catch (error) {
    logAuthWarning("admin session verification failed", {
      message: error instanceof Error ? error.message : "Unknown error",
    });
    return null;
  }
}

export async function requireAdminSession() {
  const session = await getAdminSession();

  if (!session?.authenticated) {
    logAuthWarning("admin session required, redirecting to login");
    redirect("/login");
  }

  return session;
}

export async function assertCsrf() {
  const requestHeaders = await headers();
  const origin = requestHeaders.get("origin");
  const host = requestHeaders.get("host");

  if (!origin || !host) {
    logAuthWarning("csrf rejected: missing headers", { hasOrigin: Boolean(origin), hasHost: Boolean(host) });
    throw new Error("Missing CSRF headers");
  }

  const originUrl = new URL(origin);
  if (originUrl.host !== host) {
    logAuthWarning("csrf rejected: origin mismatch", { originHost: originUrl.host, host });
    throw new Error("Invalid CSRF origin");
  }

  const csrfHeader = requestHeaders.get(CSRF_HEADER_NAME);
  if (csrfHeader !== host) {
    logAuthWarning("csrf rejected: token mismatch", { csrfHeader, host });
    throw new Error("Invalid CSRF token");
  }

  logAuthEvent("csrf accepted", { host });
}
