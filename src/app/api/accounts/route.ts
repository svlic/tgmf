import { requireAdminSession, assertCsrf } from "@/lib/auth";
import { accountRepository, withRepositoryError } from "@/lib/db/repositories";
import { fail, ok } from "@/lib/http";
import { rethrowNextError } from "@/lib/next";
import { accountSchema } from "@/lib/validation/forms";

export async function POST(request: Request) {
  try {
    await requireAdminSession();
    await assertCsrf();
    const payload = accountSchema.parse(await request.json());
    const account = withRepositoryError(() =>
      accountRepository.create({
        label: payload.label,
        phoneNumber: payload.phoneNumber,
        apiIdOverride: payload.apiIdOverride || null,
        apiHashOverride: payload.apiHashOverride || null,
      }),
    );

    return ok({ account });
  } catch (error) {
    rethrowNextError(error);
    return fail(error instanceof Error ? error.message : "Failed to create account", 400);
  }
}
