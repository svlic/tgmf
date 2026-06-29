import type { TelegramAccountRow } from "@/lib/types";

export const ACCOUNTS_POLL_INTERVAL_MS = 2_000;
export const ACCOUNTS_MUTATED_EVENT = "tgmf:accounts-mutated";

export type AccountListItemSnapshot = {
  id: string;
  label: string;
  phone_number: string;
  api_id_override: string | null;
  api_hash_configured: boolean;
  login_state: TelegramAccountRow["login_state"];
  telegram_user_id: string | null;
  last_connected_at: string | null;
};

export type AccountsOverviewSnapshot = {
  accounts: AccountListItemSnapshot[];
  needs_polling: boolean;
};