import { AccountsLiveList } from "@/components/dashboard/accounts-live-list";
import { buildAccountsOverviewSnapshot } from "@/lib/accounts-dashboard";

export default function AccountsPage() {
  const initial = buildAccountsOverviewSnapshot();

  return <AccountsLiveList initial={initial} />;
}