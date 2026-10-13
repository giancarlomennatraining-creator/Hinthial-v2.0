import { getCurrentUser } from "@/lib/auth/current-user";
import { LegacyPage } from "@/components/legacy/LegacyPage";

export default async function LegacyRoute() {
  const user = await getCurrentUser();

  return (
    <LegacyPage
      userId={user?.id ?? ""}
      firstName={user?.firstName ?? ""}
      lastName={user?.lastName ?? ""}
      birthDate={user?.birthDate ?? null}
    />
  );
}
