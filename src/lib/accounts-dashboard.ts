import { accountRepository } from "@/lib/db/repositories";
import type { AccountsOverviewSnapshot, AccountListItemSnapshot } from "@/lib/accounts-snapshots";
import type { TelegramAccountRow } from "@/lib/types";

export type { AccountsOverviewSnapshot, AccountListItemSnapshot } from "@/lib/accounts-snapshots";

const POLLING_LOGIN_STATES: readonly TelegramAccountRow["login_state"][] = [
  "awaiting_code",
  "awaiting_password",
  "reauth_required",
];

function toAccountListItem(account: TelegramAccountRow): AccountListItemSnapshot {
  return {
    id: account.id,
    label: account.label,
    phone_number: account.phone_number,
    api_id_override: account.api_id_override,
    api_hash_configured: Boolean(account.api_hash_override_encrypted),
    login_state: account.login_state,
    telegram_user_id: account.telegram_user_id,
    last_connected_at: account.last_connected_at,
  };
}

export function buildAccountsOverviewSnapshot(): AccountsOverviewSnapshot {
  const accounts = accountRepository.list();
  const needsPolling = accounts.some((account) => POLLING_LOGIN_STATES.includes(account.login_state));

  return {
    accounts: accounts.map(toAccountListItem),
    needs_polling: needsPolling,
  };
}