import { requireAdminSession, assertCsrf } from "@/lib/auth";
import { accountRepository } from "@/lib/db/repositories";
import { fail, ok } from "@/lib/http";
import { rethrowNextError } from "@/lib/next";
import { testAccountConnectivity } from "@/lib/telegram/service";

export async function POST(
  _request: Request,
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

    const result = await testAccountConnectivity(accountId);
    return ok({ accountId, ...result });
  } catch (error) {
    rethrowNextError(error);
    return fail(error instanceof Error ? error.message : "Connectivity test failed", 400);
  }
}
