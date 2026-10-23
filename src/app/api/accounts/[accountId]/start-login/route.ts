import { assertCsrf } from "@/lib/csrf";
import { accountRepository } from "@/lib/db/repositories";
import { fail, ok } from "@/lib/http";
import { rethrowNextError } from "@/lib/next";
import { beginPhoneLogin } from "@/lib/telegram/service";
import { startLoginSchema } from "@/lib/validation/forms";

export async function POST(
  request: Request,
  context: { params: Promise<{ accountId: string }> },
) {
  try {
    await assertCsrf();
    const { accountId } = await context.params;
    const account = accountRepository.getById(accountId);
    if (!account) {
      return fail("Account not found", 404);
    }

    const payload = startLoginSchema.parse(await request.json());
    const result = await beginPhoneLogin(accountId, payload.phoneNumber);
    return ok(result);
  } catch (error) {
    rethrowNextError(error);
    return fail(error instanceof Error ? error.message : "Failed to start login", 400);
  }
}
