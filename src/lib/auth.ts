import bcrypt from "bcryptjs";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { AUTH_COOKIE_NAME, CSRF_HEADER_NAME } from "@/lib/constants";
import { getSecretEnv } from "@/lib/env";
import { signAdminSession, verifyAdminSession } from "@/lib/crypto";

export async function verifyAdminPassword(password: string) {
  const { ADMIN_PASSWORD: configured } = getSecretEnv();

  if (configured.startsWith("$2a$") || configured.startsWith("$2b$") || configured.startsWith("$2y$")) {
    return bcrypt.compare(password, configured);
  }

  return password === configured;
}

export async function createAdminSession() {
  const token = await signAdminSession({ authenticated: true, issuedAt: Date.now() });
  const cookieStore = await cookies();

  cookieStore.set(AUTH_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
}

export async function clearAdminSession() {
  const cookieStore = await cookies();
  cookieStore.delete(AUTH_COOKIE_NAME);
}

export async function getAdminSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_COOKIE_NAME)?.value;

  if (!token) {
    return null;
  }

  try {
    return await verifyAdminSession(token);
  } catch {
    return null;
  }
}

export async function requireAdminSession() {
  const session = await getAdminSession();

  if (!session?.authenticated) {
    redirect("/login");
  }

  return session;
}

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
