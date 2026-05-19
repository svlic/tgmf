import { StringSession } from "telegram/sessions";
import { TelegramClient } from "telegram";
import { accountRepository } from "@/lib/db/repositories";

export async function createTelegramClient(accountId: string) {
  const account = accountRepository.getById(accountId);
  if (!account) {
    throw new Error("Account not found");
  }

  const { apiId, apiHash } = accountRepository.getResolvedApiCredentials(accountId);
  const sessionString = accountRepository.getSessionString(accountId) ?? "";
  const session = new StringSession(sessionString);
  const client = new TelegramClient(session, apiId, apiHash, {
    connectionRetries: 5,
  });

  return { account, client, session };
}
