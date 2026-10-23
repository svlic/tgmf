import { assertCsrf } from "@/lib/csrf";
import { accountRepository } from "@/lib/db/repositories";
import { fail, ok } from "@/lib/http";
import { rethrowNextError } from "@/lib/next";
import { refreshDialogs } from "@/lib/telegram/service";

export async function GET(
  _request: Request,
  context: { params: Promise<{ accountId: string }> },
) {
  try {
    const { accountId } = await context.params;
    const account = accountRepository.getById(accountId);
    if (!account) {
      return fail("Account not found", 404);
    }

    const dialogs = await refreshDialogs(accountId);
    return ok({ dialogs });
  } catch (error) {
    rethrowNextError(error);
    return fail(error instanceof Error ? error.message : "Failed to load dialogs", 400);
  }
}

export async function POST(
  _request: Request,
  context: { params: Promise<{ accountId: string }> },
) {
  try {
    await assertCsrf();
    const { accountId } = await context.params;
    const account = accountRepository.getById(accountId);
    if (!account) {
      return fail("Account not found", 404);
    }

    const dialogs = await refreshDialogs(accountId);
    return ok({ dialogs });
  } catch (error) {
    rethrowNextError(error);
    return fail(error instanceof Error ? error.message : "Failed to refresh dialogs", 400);
  }
}
