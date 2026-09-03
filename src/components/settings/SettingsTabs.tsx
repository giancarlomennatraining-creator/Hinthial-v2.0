"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { UserInfoPanel } from "@/components/settings/UserInfoPanel";
import { CategoriesPanel } from "@/components/settings/CategoriesPanel";
import { ThemeToggle } from "@/components/settings/ThemeToggle";
import { ListViewSettings } from "@/components/settings/ListViewSettings";
import { DangerZonePanel } from "@/components/settings/DangerZonePanel";
import { RequireMasterKey } from "@/components/crypto/RequireMasterKey";
import { ImportExportTabs } from "@/components/import-export/ImportExportTabs";

type Tab = "user-info" | "categories" | "appearance" | "import-export" | "danger-zone";

const TABS: { id: Tab; label: string }[] = [
  { id: "user-info", label: "Informazioni utente" },
  { id: "categories", label: "Categorie" },
  { id: "appearance", label: "Aspetto" },
  { id: "import-export", label: "Importa/Esporta" },
  { id: "danger-zone", label: "Zona pericolosa" },
];

export function SettingsTabs({
  userId,
  firstName,
  lastName,
  email,
  avatarPath,
  avatarUrl,
}: {
  userId: string;
  firstName: string;
  lastName: string;
  email: string;
  avatarPath: string | null;
  avatarUrl: string | null;
}) {
  const [tab, setTab] = useState<Tab>("user-info");

  return (
    <div className="flex flex-col gap-6">
      <div role="tablist" className="flex gap-4 border-b border-zinc-200 dark:border-zinc-800">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              "-mb-px border-b-2 px-1 pb-3 text-sm font-medium transition-colors",
              tab === t.id
                ? "border-brand text-brand"
                : "border-transparent text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "user-info" ? (
        <UserInfoPanel
          userId={userId}
          firstName={firstName}
          lastName={lastName}
          email={email}
          avatarPath={avatarPath}
          avatarUrl={avatarUrl}
        />
      ) : tab === "categories" ? (
        <CategoriesPanel />
      ) : tab === "appearance" ? (
        <div className="flex max-w-md flex-col gap-8">
          <div className="flex flex-col gap-4">
            <div>
              <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Tema</h2>
              <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                Scegli l&apos;aspetto dell&apos;app, o lascia che segua le impostazioni del tuo
                dispositivo.
              </p>
            </div>
            <ThemeToggle />
          </div>

          <div className="flex flex-col gap-4">
            <div>
              <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                Visualizzazione delle liste
              </h2>
              <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                Elenco o tabella impaginata, per ogni sezione --- la scelta resta la stessa su
                tutti i tuoi dispositivi, e puoi cambiarla anche direttamente da ogni sezione.
              </p>
            </div>
            <ListViewSettings />
          </div>
        </div>
      ) : tab === "import-export" ? (
        // ImportExportTabs gestisce da sé le proprie sotto-schede
        // (Importa/Esporta) e il proprio RequireMasterKey --- prima
        // viveva in una pagina a sé (/import-export), ora è qui.
        <ImportExportTabs firstName={firstName} lastName={lastName} email={email} />
      ) : (
        // "Cancella tutto" ha bisogno della master key sbloccata (per
        // scoprire i path da rimuovere in Storage) --- unica scheda qui
        // dentro a richiederla oltre a Importa/Esporta; le altre non
        // toccano nulla di cifrato.
        <RequireMasterKey>
          {(masterKey) => <DangerZonePanel userId={userId} masterKey={masterKey} />}
        </RequireMasterKey>
      )}
    </div>
  );
}
