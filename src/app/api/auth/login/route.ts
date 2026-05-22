import { loginSchema } from "@/lib/validation/forms";
import { createAdminSession, verifyAdminPassword, assertCsrf } from "@/lib/auth";
import { fail, ok } from "@/lib/http";
import { getClientMeta } from "@/lib/server";
import { loginAttemptRepository } from "@/lib/db/repositories";

const LOGIN_LOG_PREFIX = "[admin-login]";

type LoginMeta = Awaited<ReturnType<typeof getClientMeta>>;

function logLoginEvent(message: string, details: Record<string, unknown>) {
  console.info(LOGIN_LOG_PREFIX, message, details);
}

function logLoginWarning(message: string, details: Record<string, unknown>) {
  console.warn(LOGIN_LOG_PREFIX, message, details);
}

function logLoginError(message: string, details: Record<string, unknown>) {
  console.error(LOGIN_LOG_PREFIX, message, details);
}

export async function POST(request: Request) {
  const attemptId = crypto.randomUUID();
  let stage = "start";
  let meta: LoginMeta | null = null;

  try {
    logLoginEvent("request received", { attemptId, path: new URL(request.url).pathname });

    stage = "csrf";
    await assertCsrf();

    stage = "client-meta";
    meta = await getClientMeta();
    logLoginEvent("client accepted", {
      attemptId,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    stage = "rate-limit";
    loginAttemptRepository.assertNotRateLimited(meta.ipAddress);

    stage = "parse-payload";
    const payload = loginSchema.parse(await request.json());

    stage = "verify-password";
    const valid = await verifyAdminPassword(payload.password);

    if (!valid) {
      loginAttemptRepository.record({
        status: "failure",
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
        reason: "Invalid admin password",
      });
      logLoginWarning("password rejected", {
        attemptId,
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
      });
      return fail("Wrong login password", 401);
    }

    stage = "create-session";
    await createAdminSession();
    logLoginEvent("session cookie set", { attemptId, ipAddress: meta.ipAddress });

    stage = "record-success";
    loginAttemptRepository.record({
      status: "success",
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
      reason: "Admin login success",
    });
    logLoginEvent("login succeeded", { attemptId, ipAddress: meta.ipAddress });
    return ok({ authenticated: true });
  } catch (error) {
    logLoginError("login failed", {
      attemptId,
      stage,
      ipAddress: meta?.ipAddress,
      message: error instanceof Error ? error.message : "Unknown error",
    });
    return fail(error instanceof Error ? error.message : "Login failed", 400);
  }
}
