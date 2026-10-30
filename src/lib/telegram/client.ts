import { StringSession } from "telegram/sessions";
import { TelegramClient } from "telegram";
import { LogLevel } from "telegram/extensions/Logger";
import { accountRepository } from "@/lib/db/repositories";
import { systemErrorFields, systemLog } from "@/lib/logger";

export async function createTelegramClient(accountId: string, sessionOverride?: string) {
  const account = accountRepository.getById(accountId);
  if (!account) {
    throw new Error("Account not found");
  }

  const { apiId, apiHash } = accountRepository.getResolvedApiCredentials(accountId);
  const sessionString = sessionOverride ?? accountRepository.getSessionString(accountId) ?? "";
  const session = new StringSession(sessionString);
  const client = new TelegramClient(session, apiId, apiHash, {
    connectionRetries: 5,
  });

  client.onError = async (error) => {
    if (error.message === "TIMEOUT") {
      return;
    }

    systemLog("warn", "telegram_background_error", { accountId, ...systemErrorFields(error) });
  };
  // GramJS logs background update-loop errors after calling onError; keep logging centralized above.
  client.setLogLevel(LogLevel.NONE);

  return { account, client, session };
}
