import { getCurrentUser } from "@/lib/auth/current-user";
import { SettingsTabs } from "@/components/settings/SettingsTabs";

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{
    tab?: string;
    section?: string;
    from?: string;
    to?: string;
    area?: string;
    types?: string;
    entity?: string;
    size?: string;
    page?: string;
  }>;
}) {
  const user = await getCurrentUser();
  const { tab, section, ...activityParams } = await searchParams;

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-brand">
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
        birthDate={user?.birthDate ?? null}
        initialTab={tab}
        initialSection={section}
        activityParams={activityParams}
      />
    </div>
  );
}
