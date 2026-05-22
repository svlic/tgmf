import { requireAdminSession, assertCsrf } from "@/lib/auth";
import { accountRepository } from "@/lib/db/repositories";
import { fail, ok } from "@/lib/http";
import { rethrowNextError } from "@/lib/next";
import { completePhoneCodeLogin } from "@/lib/telegram/service";
import { verifyCodeSchema } from "@/lib/validation/forms";

export async function POST(
  request: Request,
  context: { params: Promise<{ accountId: string }> },
) {
  try {
    await requireAdminSession();
    await assertCsrf();
    const { accountId } = await context.params;
    const account = accountRepository.getById(accountId);
    if (!account) {
      return fail("Account not found", 404);
    }

    const payload = verifyCodeSchema.parse(await request.json());
    const result = await completePhoneCodeLogin(accountId, payload.phoneCode, payload.phoneCodeHash);
    return ok(result);
  } catch (error) {
    rethrowNextError(error);
    return fail(error instanceof Error ? error.message : "Failed to verify code", 400);
  }
}
