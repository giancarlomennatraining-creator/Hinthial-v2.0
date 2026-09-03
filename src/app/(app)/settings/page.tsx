import { getCurrentUser } from "@/lib/auth/current-user";
import { SettingsTabs } from "@/components/settings/SettingsTabs";

export default async function SettingsPage() {
  const user = await getCurrentUser();

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
          Impostazioni
        </h1>
      </div>

      <SettingsTabs
        userId={user?.id ?? ""}
        firstName={user?.firstName ?? ""}
        lastName={user?.lastName ?? ""}
        email={user?.email ?? ""}
        avatarPath={user?.avatarPath ?? null}
        avatarUrl={user?.avatarUrl ?? null}
      />
    </div>
  );
}
