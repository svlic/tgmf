import { assertCsrf } from "@/lib/csrf";
import { accountRepository, withRepositoryError } from "@/lib/db/repositories";
import { fail, ok } from "@/lib/http";
import { unstable_rethrow as rethrowNextError } from "next/navigation";

type RouteContext = { params: Promise<{ accountId: string }> };

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    await assertCsrf();
    const { accountId } = await context.params;
    const deleted = withRepositoryError(() => accountRepository.delete(accountId));
    if (!deleted) {
      return fail("Account not found", 404);
    }

    return ok({ deleted: true });
  } catch (error) {
    rethrowNextError(error);
    return fail(error instanceof Error ? error.message : "Failed to delete account", 400);
  }
}
