import { getCurrentUser } from "@/lib/auth/current-user";
import { DashboardPanel } from "@/components/dashboard/DashboardPanel";

export default async function DashboardPage() {
  const user = await getCurrentUser();

  return <DashboardPanel displayName={user?.displayName ?? "Utente"} />;
}
