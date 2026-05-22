import { loginSchema } from "@/lib/validation/forms";
import { createAdminSession, verifyAdminPassword, assertCsrf } from "@/lib/auth";
import { fail, ok } from "@/lib/http";
import { getClientMeta } from "@/lib/server";
import { loginAttemptRepository } from "@/lib/db/repositories";

export async function POST(request: Request) {
  try {
    await assertCsrf();
    const meta = await getClientMeta();
    loginAttemptRepository.assertNotRateLimited(meta.ipAddress);
    const payload = loginSchema.parse(await request.json());
    const valid = await verifyAdminPassword(payload.password);

    if (!valid) {
      loginAttemptRepository.record({
        status: "failure",
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
        reason: "Invalid admin password",
      });
      return fail("Wrong login password", 401);
    }

    await createAdminSession();
    loginAttemptRepository.record({
      status: "success",
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
      reason: "Admin login success",
    });
    return ok({ authenticated: true });
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Login failed", 400);
  }
}
