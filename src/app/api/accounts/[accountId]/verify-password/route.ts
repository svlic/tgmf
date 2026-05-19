import { requireAdminSession, assertCsrf } from "@/lib/auth";
import { accountRepository } from "@/lib/db/repositories";
import { fail, ok } from "@/lib/http";
import { completePasswordLogin } from "@/lib/telegram/service";
import { verifyPasswordSchema } from "@/lib/validation/forms";

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

    const payload = verifyPasswordSchema.parse(await request.json());
    const result = await completePasswordLogin(accountId, payload.password);
    return ok(result);
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Failed to verify password", 400);
  }
}
