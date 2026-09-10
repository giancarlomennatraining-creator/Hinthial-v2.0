"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { useCrossfade } from "@/lib/use-crossfade";
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
import type { ComponentType, SVGProps } from "react";
import {
  ActivityIcon,
  AlertTriangleIcon,
  CategoryIcon,
  ChecklistIcon,
  EyeIcon,
  ImportExportIcon,
  SecurityIcon,
  SlidersIcon,
  UserIcon,
} from "@/components/icons/nav-icons";

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

const TABS: { id: Tab; label: string; icon: ComponentType<SVGProps<SVGSVGElement>> }[] = [
  { id: "user-info", label: "Informazioni utente", icon: UserIcon },
  { id: "security", label: "Sicurezza", icon: SecurityIcon },
  { id: "privacy", label: "Privacy", icon: EyeIcon },
  { id: "categories", label: "Categorie", icon: CategoryIcon },
  { id: "import-export", label: "Importa/Esporta", icon: ImportExportIcon },
  { id: "onboarding", label: "Onboarding", icon: ChecklistIcon },
  { id: "activity", label: "Attività", icon: ActivityIcon },
  { id: "appearance", label: "Aspetto", icon: SlidersIcon },
  // Sola eccezione: resta nel proprio rosso/arancio di avviso invece del
  // blu del logo (v. sotto) --- è l'unica voce che segnala un rischio,
  // non solo una sezione, e perderebbe il senso diventando blu come le
  // altre.
  { id: "danger-zone", label: "Zona pericolosa", icon: AlertTriangleIcon },
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
  // Il contenuto mostrato dissolve verso la scheda scelta invece di
  // sostituirsi di scatto (v. richiesta utente) --- il tasto della
  // scheda risponde comunque subito al click (usa `tab`, non
  // `displayedTab`): solo il contenuto sotto ha il ritardo della
  // dissolvenza.
  const { displayed: displayedTab, visible: tabContentVisible } = useCrossfade(tab, 150);

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
              "flex shrink-0 items-center gap-2 whitespace-nowrap rounded-xl px-3 py-2 text-left text-sm font-medium transition-colors",
              tab === t.id
                ? t.id === "danger-zone"
                  ? "bg-red-500/10 text-red-600 dark:text-red-400"
                  : "bg-brand/10 text-brand"
                : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-900",
            )}
          >
            {/* Icona sempre blu (colore del logo), a prescindere dallo
                stato attivo/inattivo della scheda --- eccetto "Zona
                pericolosa" (v. sopra), che resta nel proprio colore di
                avviso. */}
            <t.icon
              width={18}
              height={18}
              className={t.id === "danger-zone" ? "text-red-600 dark:text-red-400" : "text-brand"}
            />
            {t.label}
          </button>
        ))}
      </div>

      <div
        className={cn(
          "min-w-0 flex-1 transition-opacity duration-150",
          tabContentVisible ? "opacity-100" : "opacity-0",
        )}
      >
      {displayedTab === "user-info" ? (
        <UserInfoPanel
          userId={userId}
          firstName={firstName}
          lastName={lastName}
          email={email}
          avatarPath={avatarPath}
          avatarUrl={avatarUrl}
          birthDate={birthDate}
        />
      ) : displayedTab === "onboarding" ? (
        // Serve i dati decifrati (documenti/asset/contatti/capsule) per
        // calcolare l'avanzamento --- unica scheda oltre a Importa/Esporta
        // e Zona pericolosa a richiedere la master key sbloccata.
        <RequireMasterKey>
          {(masterKey) => <OnboardingSettingsPanel masterKey={masterKey} />}
        </RequireMasterKey>
      ) : displayedTab === "privacy" ? (
        // Solo conteggi e colonne mai cifrate (v. domain/privacy/repository.ts)
        // --- non richiede la master key, a differenza di Onboarding qui sopra.
        <PrivacyPanel
          userId={userId}
          firstName={firstName}
          lastName={lastName}
          email={email}
          birthDate={birthDate}
        />
      ) : displayedTab === "security" ? (
        // Layer di identità (login), non di cifratura --- non richiede
        // la master key (v. domain/mfa/repository.ts).
        <MfaSettingsPanel userId={userId} />
      ) : displayedTab === "categories" ? (
        <CategoriesPanel />
      ) : displayedTab === "appearance" ? (
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
      ) : displayedTab === "activity" ? (
        // Registro tecnico in chiaro (v. lib/audit/log-event.ts): non
        // richiede la master key, come Aspetto.
        <AuditLogPanel />
      ) : displayedTab === "import-export" ? (
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
