import { requireAdminSession, assertCsrf } from "@/lib/auth";
import { accountRepository, jobRepository, withRepositoryError } from "@/lib/db/repositories";
import { fail, ok } from "@/lib/http";
import { rethrowNextError } from "@/lib/next";
import { jobSchema } from "@/lib/validation/forms";

export async function POST(request: Request) {
  try {
    await requireAdminSession();
    await assertCsrf();
    const payload = jobSchema.parse(await request.json());
    const account = accountRepository.getById(payload.accountId);
    if (!account) {
      return fail("Account not found", 404);
    }

    const job = withRepositoryError(() =>
      jobRepository.create({
        accountId: payload.accountId,
        sourceChannelRef: payload.sourceChannelRef,
        targetChannelRef: payload.targetChannelRef,
        startMessageId: payload.startMessageId,
        endMessageId: payload.endMessageId,
        selection: payload.selection,
        searchQuery: payload.searchQuery,
        jobOrder: payload.jobOrder,
        mode: payload.mode,
        albumStrategy: payload.albumStrategy,
        allowedMediaTypes: payload.allowedMediaTypes,
        keywordWhitelist: payload.keywordWhitelist,
        keywordBlacklist: payload.keywordBlacklist,
        regexWhitelist: payload.regexWhitelist,
        regexBlacklist: payload.regexBlacklist,
        delaySeconds: payload.delaySeconds,
      }),
    );

    return ok({ job });
  } catch (error) {
    rethrowNextError(error);
    return fail(error instanceof Error ? error.message : "Failed to create job", 400);
  }
}
