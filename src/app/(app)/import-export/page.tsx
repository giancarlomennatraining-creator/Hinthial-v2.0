import { getCurrentUser } from "@/lib/auth/current-user";
import { ImportExportTabs } from "@/components/import-export/ImportExportTabs";

export default async function ImportExportPage() {
  const user = await getCurrentUser();

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
          Importa/Esporta
        </h1>
      </div>

      <ImportExportTabs
        firstName={user?.firstName ?? ""}
        lastName={user?.lastName ?? ""}
        email={user?.email ?? ""}
      />
    </div>
  );
}
