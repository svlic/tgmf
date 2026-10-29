import { StringSession } from "telegram/sessions";
import { TelegramClient } from "telegram";
import { LogLevel } from "telegram/extensions/Logger";
import { accountRepository } from "@/lib/db/repositories";

const TELEGRAM_LOG_PREFIX = "[telegram]";

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

    console.warn(TELEGRAM_LOG_PREFIX, "Client background error", {
      accountId,
      errorName: error.name,
      errorMessage: error.message,
    });
  };
  // GramJS logs background update-loop errors after calling onError; keep logging centralized above.
  client.setLogLevel(LogLevel.NONE);

  return { account, client, session };
}
