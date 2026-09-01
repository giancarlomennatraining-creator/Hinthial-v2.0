"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { RequireMasterKey } from "@/components/crypto/RequireMasterKey";
import { ImportWizard } from "@/components/import-export/ImportWizard";
import { ExportPanel } from "@/components/import-export/ExportPanel";

type Tab = "import" | "export";

const TABS: { id: Tab; label: string }[] = [
  { id: "import", label: "Importa" },
  { id: "export", label: "Esporta" },
];

export function ImportExportTabs({
  firstName,
  lastName,
  email,
}: {
  firstName: string;
  lastName: string;
  email: string;
}) {
  const [tab, setTab] = useState<Tab>("import");

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

      <RequireMasterKey>
        {(masterKey) =>
          tab === "import" ? (
            <ImportWizard masterKey={masterKey} />
          ) : (
            <ExportPanel masterKey={masterKey} firstName={firstName} lastName={lastName} email={email} />
          )
        }
      </RequireMasterKey>
    </div>
  );
}
