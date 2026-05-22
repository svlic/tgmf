import { assertCsrf, clearAdminSession } from "@/lib/auth";
import { ok, fail } from "@/lib/http";
import { rethrowNextError } from "@/lib/next";

export async function POST() {
  try {
    await assertCsrf();
    await clearAdminSession();
    return ok({ loggedOut: true });
  } catch (error) {
    rethrowNextError(error);
    return fail(error instanceof Error ? error.message : "Logout failed", 400);
  }
}
