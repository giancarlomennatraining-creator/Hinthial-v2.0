"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { UserInfoPanel } from "@/components/settings/UserInfoPanel";
import { OnboardingSettingsPanel } from "@/components/settings/OnboardingSettingsPanel";
import { PrivacyPanel } from "@/components/settings/PrivacyPanel";
import { MfaSettingsPanel } from "@/components/settings/MfaSettingsPanel";
import { AuditLogPanel } from "@/components/settings/AuditLogPanel";
import { CategoriesPanel } from "@/components/settings/CategoriesPanel";
import { ThemeToggle } from "@/components/settings/ThemeToggle";
import { NavOrientationSettings } from "@/components/settings/NavOrientationSettings";
import { ListViewSettings } from "@/components/settings/ListViewSettings";
import { DangerZonePanel } from "@/components/settings/DangerZonePanel";
import { RequireMasterKey } from "@/components/crypto/RequireMasterKey";
import { ImportExportTabs } from "@/components/import-export/ImportExportTabs";

type Tab =
  | "user-info"
  | "onboarding"
  | "privacy"
  | "security"
  | "categories"
  | "appearance"
  | "activity"
  | "import-export"
  | "danger-zone";

const TABS: { id: Tab; label: string }[] = [
  { id: "user-info", label: "Informazioni utente" },
  { id: "security", label: "Sicurezza" },
  { id: "privacy", label: "Privacy" },
  { id: "categories", label: "Categorie" },
  { id: "import-export", label: "Importa/Esporta" },
  { id: "onboarding", label: "Onboarding" },
  { id: "activity", label: "Attività" },
  { id: "appearance", label: "Aspetto" },
  { id: "danger-zone", label: "Zona pericolosa" },
];

export function SettingsTabs({
  userId,
  firstName,
  lastName,
  email,
  avatarPath,
  avatarUrl,
  birthDate,
}: {
  userId: string;
  firstName: string;
  lastName: string;
  email: string;
  avatarPath: string | null;
  avatarUrl: string | null;
  birthDate: string | null;
}) {
  const [tab, setTab] = useState<Tab>("user-info");

  return (
    <div className="flex flex-col gap-6 md:flex-row md:gap-10">
      <div
        role="tablist"
        aria-orientation="vertical"
        className="flex shrink-0 flex-row gap-1 overflow-x-auto border-b border-zinc-200 pb-2 md:w-48 md:flex-col md:border-b-0 md:border-r md:pb-0 md:pr-4 dark:border-zinc-800"
      >
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              "shrink-0 whitespace-nowrap rounded-md px-3 py-2 text-left text-sm font-medium transition-colors",
              tab === t.id
                ? "bg-brand text-white"
                : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-900",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="min-w-0 flex-1">
      {tab === "user-info" ? (
        <UserInfoPanel
          userId={userId}
          firstName={firstName}
          lastName={lastName}
          email={email}
          avatarPath={avatarPath}
          avatarUrl={avatarUrl}
          birthDate={birthDate}
        />
      ) : tab === "onboarding" ? (
        // Serve i dati decifrati (documenti/asset/contatti/capsule) per
        // calcolare l'avanzamento --- unica scheda oltre a Importa/Esporta
        // e Zona pericolosa a richiedere la master key sbloccata.
        <RequireMasterKey>
          {(masterKey) => <OnboardingSettingsPanel masterKey={masterKey} />}
        </RequireMasterKey>
      ) : tab === "privacy" ? (
        // Solo conteggi e colonne mai cifrate (v. domain/privacy/repository.ts)
        // --- non richiede la master key, a differenza di Onboarding qui sopra.
        <PrivacyPanel
          userId={userId}
          firstName={firstName}
          lastName={lastName}
          email={email}
          birthDate={birthDate}
        />
      ) : tab === "security" ? (
        // Layer di identità (login), non di cifratura --- non richiede
        // la master key (v. domain/mfa/repository.ts).
        <MfaSettingsPanel userId={userId} />
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
                Disposizione del menu
              </h2>
              <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                Barra laterale a sinistra o a destra, oppure barra orizzontale in alto --- la
                scelta resta la stessa su tutti i tuoi dispositivi.
              </p>
            </div>
            <NavOrientationSettings />
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
      ) : tab === "activity" ? (
        // Registro tecnico in chiaro (v. lib/audit/log-event.ts): non
        // richiede la master key, come Aspetto.
        <AuditLogPanel />
      ) : tab === "import-export" ? (
        // ImportExportTabs gestisce da sé le proprie sotto-schede
        // (Importa/Esporta) e il proprio RequireMasterKey --- prima
        // viveva in una pagina a sé (/import-export), ora è qui.
        <ImportExportTabs firstName={firstName} lastName={lastName} email={email} />
      ) : (
        // "Cancella tutto" ha bisogno della master key sbloccata (per
        // scoprire i path da rimuovere in Storage) --- come Onboarding e
        // Importa/Esporta; le altre schede non toccano nulla di cifrato.
        <RequireMasterKey>
          {(masterKey) => <DangerZonePanel userId={userId} masterKey={masterKey} />}
        </RequireMasterKey>
      )}
      </div>
    </div>
  );
}
