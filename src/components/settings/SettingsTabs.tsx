"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { useCrossfade } from "@/lib/use-crossfade";
import { UserInfoPanel } from "@/components/settings/UserInfoPanel";
import { OnboardingSettingsPanel } from "@/components/settings/OnboardingSettingsPanel";
import { DigitalLegacySettingsPanel } from "@/components/settings/DigitalLegacySettingsPanel";
import { EmergencyCardPanel } from "@/components/settings/EmergencyCardPanel";
import { PrivacyPanel } from "@/components/settings/PrivacyPanel";
import { MfaSettingsPanel } from "@/components/settings/MfaSettingsPanel";
import { DeviceLockPanel } from "@/components/settings/DeviceLockPanel";
import { AuditLogPanel } from "@/components/settings/AuditLogPanel";
import { CategoriesPanel } from "@/components/settings/CategoriesPanel";
import { ThemeToggle } from "@/components/settings/ThemeToggle";
import { NavOrientationSettings } from "@/components/settings/NavOrientationSettings";
import { BottomNavItemsSettings } from "@/components/settings/BottomNavItemsSettings";
import { MainNavItemsSettings } from "@/components/settings/MainNavItemsSettings";
import { ListViewSettings } from "@/components/settings/ListViewSettings";
import { CapsuleCountdownSettings } from "@/components/settings/CapsuleCountdownSettings";
import { DangerZonePanel } from "@/components/settings/DangerZonePanel";
import { RequireMasterKey } from "@/components/crypto/RequireMasterKey";
import { ImportExportTabs } from "@/components/import-export/ImportExportTabs";
import { AIConsentSettings } from "@/components/settings/AIConsentSettings";
import type { ComponentType, SVGProps } from "react";
import {
  ActivityIcon,
  AIIcon,
  AlertTriangleIcon,
  CategoryIcon,
  ChecklistIcon,
  EyeIcon,
  HeartIcon,
  ImportExportIcon,
  MedicalCardIcon,
  SecurityIcon,
  SlidersIcon,
  UserIcon,
} from "@/components/icons/nav-icons";

type Tab =
  | "user-info"
  | "onboarding"
  | "privacy"
  | "security"
  | "digital-legacy"
  | "emergency-card"
  | "categories"
  | "appearance"
  | "activity"
  | "import-export"
  | "ai"
  | "danger-zone";

interface TabDef {
  id: Tab;
  label: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
}

/**
 * Raggruppate in macro-aree (v. richiesta utente: 11 voci piatte erano
 * diventate difficili da scorrere) --- un gruppo con `label: null` non
 * mostra intestazione, per le due voci pensate per restare da sole,
 * fuori da qualunque cartella: "Informazioni utente" in cima (la più
 * visitata, niente da cercare) e "Zona pericolosa" in fondo (l'unica
 * che segnala un rischio, non deve confondersi con una cartella
 * qualunque). Due spostamenti concettuali rispetto a prima:
 * "Intelligenza artificiale" (un consenso al trattamento dati, non
 * un'impostazione a sé) e "Categorie" (tassonomia dei propri contenuti)
 * ora vivono sotto "Privacy e dati" invece che da sole; "Onboarding"
 * (oggi quasi solo un interruttore mostra/nascondi per il gadget in
 * barra laterale) sotto "Personalizzazione", la stessa famiglia di
 * "Aspetto". "Attività" (il registro) sotto "Sicurezza": il suo uso
 * principale è accorgersi di qualcosa di sospetto sul proprio account.
 */
const TAB_GROUPS: { label: string | null; tabs: TabDef[] }[] = [
  { label: null, tabs: [{ id: "user-info", label: "Informazioni utente", icon: UserIcon }] },
  {
    label: "Sicurezza",
    tabs: [
      { id: "security", label: "Sicurezza", icon: SecurityIcon },
      { id: "digital-legacy", label: "Eredità digitale", icon: HeartIcon },
      { id: "emergency-card", label: "Scheda d'emergenza", icon: MedicalCardIcon },
      { id: "activity", label: "Attività", icon: ActivityIcon },
    ],
  },
  {
    label: "Privacy e dati",
    tabs: [
      { id: "privacy", label: "Privacy", icon: EyeIcon },
      { id: "ai", label: "Intelligenza artificiale", icon: AIIcon },
      { id: "categories", label: "Categorie", icon: CategoryIcon },
      { id: "import-export", label: "Importa/Esporta", icon: ImportExportIcon },
    ],
  },
  {
    label: "Personalizzazione",
    tabs: [
      { id: "appearance", label: "Aspetto", icon: SlidersIcon },
      { id: "onboarding", label: "Onboarding", icon: ChecklistIcon },
    ],
  },
  // Sola eccezione di colore: resta nel proprio rosso/arancio di avviso
  // invece del blu del logo (v. sotto) --- è l'unica voce che segnala
  // un rischio, non solo una sezione, e perderebbe il senso diventando
  // blu come le altre.
  { label: null, tabs: [{ id: "danger-zone", label: "Zona pericolosa", icon: AlertTriangleIcon }] },
];

const TABS: TabDef[] = TAB_GROUPS.flatMap((group) => group.tabs);

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

  // Navigazione mobile: elenco delle voci -> dettaglio di una sola,
  // invece della fila di schede orizzontali (v. richiesta utente: "può
  // vivere parallelamente a quello che accade nella versione desktop?")
  // --- sì, i due layout sono indipendenti: qui sotto md, la fila di
  // schede sopra invariata da md in su (due blocchi separati con
  // `md:hidden`/`hidden md:flex`, non un solo layout responsive). `null`
  // = mostra l'elenco.
  const [mobileSection, setMobileSection] = useState<Tab | null>(null);
  const mobileView: Tab | "list" = mobileSection ?? "list";
  const { displayed: displayedMobileView, visible: mobileViewVisible } = useCrossfade(mobileView, 150);

  /** Il contenuto di una scheda --- condiviso tra il layout desktop (schede + contenuto sempre insieme) e il dettaglio mobile (una voce alla volta), così le due navigazioni indipendenti non duplicano la logica di quale pannello mostrare. */
  function renderPanel(activeTab: Tab) {
    if (activeTab === "user-info") {
      return (
        <UserInfoPanel
          userId={userId}
          firstName={firstName}
          lastName={lastName}
          email={email}
          avatarPath={avatarPath}
          avatarUrl={avatarUrl}
          birthDate={birthDate}
        />
      );
    }
    if (activeTab === "onboarding") {
      // Serve i dati decifrati (documenti/beni/contatti/capsule) per
      // calcolare l'avanzamento --- unica scheda oltre a Importa/Esporta
      // e Zona pericolosa a richiedere la master key sbloccata.
      return (
        <RequireMasterKey>{(masterKey) => <OnboardingSettingsPanel masterKey={masterKey} />}</RequireMasterKey>
      );
    }
    if (activeTab === "privacy") {
      // Solo conteggi e colonne mai cifrate (v. domain/privacy/repository.ts)
      // --- non richiede la master key, a differenza di Onboarding qui sopra.
      return (
        <PrivacyPanel
          userId={userId}
          firstName={firstName}
          lastName={lastName}
          email={email}
          birthDate={birthDate}
        />
      );
    }
    if (activeTab === "security") {
      // Layer di identità (login), non di cifratura --- non richiede
      // la master key (v. domain/mfa/repository.ts). "Dispositivi
      // fidati" (FASE 13) invece la sblocca da sé, chiedendo di nuovo
      // la master password nel proprio modulo (v. DeviceLockPanel):
      // niente RequireMasterKey qui, per non forzare uno sblocco solo
      // per vedere lo stato dell'MFA.
      return (
        <div className="flex flex-col gap-10">
          <MfaSettingsPanel userId={userId} />
          <div className="flex flex-col gap-4 border-t border-zinc-200 pt-10 dark:border-zinc-800">
            <div>
              <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                Dispositivi fidati
              </h2>
              <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                Sblocca il vault con l&apos;impronta o Face ID su questo dispositivo, invece della
                master password.
              </p>
            </div>
            <DeviceLockPanel userId={userId} />
          </div>
        </div>
      );
    }
    if (activeTab === "digital-legacy") {
      // Solo parametri (v. domain/digital-legacy) --- nessun dato
      // cifrato coinvolto, come Sicurezza: non richiede la master key.
      return <DigitalLegacySettingsPanel userId={userId} />;
    }
    if (activeTab === "emergency-card") {
      // Tutto cifrato (v. domain/emergency-card) --- richiede la master key, a differenza della scheda qui sopra.
      return (
        <RequireMasterKey>
          {(masterKey) => (
            <EmergencyCardPanel
              masterKey={masterKey}
              userId={userId}
              firstName={firstName}
              lastName={lastName}
              birthDate={birthDate}
            />
          )}
        </RequireMasterKey>
      );
    }
    if (activeTab === "ai") {
      // Una scheda a sé (non più una sottoparte di Privacy, v. richiesta
      // utente) --- non richiede la master key, il consenso riguarda
      // solo dati già decifrati e mostrati altrove (v. AIPanel).
      return (
        <div className="flex flex-col gap-4">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
            Intelligenza artificiale
          </h2>
          <p className="max-w-2xl text-sm text-zinc-500 dark:text-zinc-400">
            Per impostazione predefinita nessuna funzione di IA reale è attiva --- ogni domanda
            e ogni contenuto restano elaborati solo sul tuo dispositivo. Attivando il cancello
            generale qui sotto, attivi solo la possibilità di accendere le singole funzioni, una
            per una.
          </p>
          <AIConsentSettings />
        </div>
      );
    }
    if (activeTab === "categories") {
      return <CategoriesPanel />;
    }
    if (activeTab === "appearance") {
      return (
        // A due colonne da lg in su (v. richiesta utente) --- una sola
        // sotto, dove non ci sarebbe spazio per restare leggibili
        // affiancate. Niente più max-w: qui come nel resto di
        // Impostazioni il contenuto usa tutta la larghezza disponibile.
        <div className="grid gap-8 lg:grid-cols-2">
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
                Voci del menu principale
              </h2>
              <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                Scegli quali voci mostrare nel menu di navigazione, e in che ordine.
              </p>
            </div>
            <MainNavItemsSettings />
          </div>

          <div className="flex flex-col gap-4">
            <div>
              <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                Barra di navigazione in basso (smartphone)
              </h2>
              <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                Scegli quali voci mostrare sempre in basso su smartphone --- le altre restano
                comunque raggiungibili dal menu con le 3 lineette.
              </p>
            </div>
            <BottomNavItemsSettings />
          </div>

          <div className="flex flex-col gap-4">
            <div>
              <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                Visualizzazione delle liste
              </h2>
              <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                Elenco o tabella impaginata, per ogni sezione --- la scelta resta la stessa su
                tutti i tuoi dispositivi, e puoi cambiarla anche direttamente da ogni sezione.
                Su schermi stretti si mostra comunque sempre l&apos;elenco, dove la tabella non
                avrebbe spazio per restare leggibile.
              </p>
            </div>
            <ListViewSettings />
          </div>

          <div className="flex flex-col gap-4">
            <div>
              <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Capsule</h2>
              <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                Elementi visivi propri di questa sezione.
              </p>
            </div>
            <CapsuleCountdownSettings />
          </div>
        </div>
      );
    }
    if (activeTab === "activity") {
      // Registro tecnico in chiaro (v. lib/audit/log-event.ts): non
      // richiede la master key, come Aspetto.
      return <AuditLogPanel />;
    }
    if (activeTab === "import-export") {
      // ImportExportTabs gestisce da sé le proprie sotto-schede
      // (Importa/Esporta) e il proprio RequireMasterKey --- prima
      // viveva in una pagina a sé (/import-export), ora è qui.
      return <ImportExportTabs firstName={firstName} lastName={lastName} email={email} />;
    }
    // "Cancella tutto" ha bisogno della master key sbloccata (per
    // scoprire i path da rimuovere in Storage) --- come Onboarding e
    // Importa/Esporta; le altre schede non toccano nulla di cifrato.
    return (
      <RequireMasterKey>{(masterKey) => <DangerZonePanel userId={userId} masterKey={masterKey} />}</RequireMasterKey>
    );
  }

  return (
    <>
      {/* Mobile: elenco delle voci -> dettaglio di una sola, con un
          tasto per tornare indietro --- v. commento su mobileSection
          sopra. */}
      <div className="md:hidden">
        <div
          className={cn(
            "transition-opacity duration-150",
            mobileViewVisible ? "opacity-100" : "opacity-0",
          )}
        >
          {displayedMobileView === "list" ? (
            // Un blocco per gruppo, non un unico elenco continuo (v.
            // richiesta utente) --- il nome del gruppo vive sopra e fuori
            // dal proprio blocco, non più incollato dentro come prima riga.
            <div className="flex flex-col gap-6">
              {TAB_GROUPS.map((group, groupIndex) => (
                <div key={group.label ?? `group-${groupIndex}`} className="flex flex-col gap-2">
                  {group.label ? (
                    <p className="px-1 text-sm font-semibold tracking-wide text-zinc-400 uppercase dark:text-zinc-500">
                      {group.label}
                    </p>
                  ) : null}
                  <ul className="flex flex-col divide-y divide-zinc-200 rounded-2xl border border-zinc-200 bg-white dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-950">
                    {group.tabs.map((t) => (
                      <li key={t.id}>
                        <button
                          type="button"
                          onClick={() => setMobileSection(t.id)}
                          className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:text-zinc-300 dark:hover:bg-zinc-900"
                        >
                          <t.icon
                            width={20}
                            height={20}
                            className={cn(
                              "shrink-0",
                              t.id === "danger-zone" ? "text-red-600 dark:text-red-400" : "text-brand",
                            )}
                          />
                          <span
                            className={cn(
                              "flex-1",
                              t.id === "danger-zone" ? "text-red-600 dark:text-red-400" : undefined,
                            )}
                          >
                            {t.label}
                          </span>
                          <span aria-hidden="true" className="text-zinc-400 dark:text-zinc-600">
                            ›
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              <button
                type="button"
                onClick={() => setMobileSection(null)}
                className="flex items-center gap-1.5 self-start text-sm font-medium text-zinc-500 underline-offset-2 hover:underline dark:text-zinc-400"
              >
                <span aria-hidden="true">←</span> Torna alle impostazioni
              </button>
              <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                {TABS.find((t) => t.id === displayedMobileView)?.label}
              </h2>
              {renderPanel(displayedMobileView)}
            </div>
          )}
        </div>
      </div>

      {/* Desktop: schede laterali + contenuto, sempre visibili insieme
          --- comportamento invariato rispetto a prima di questa funzione. */}
      <div className="hidden md:flex md:gap-10">
        <div
          role="tablist"
          aria-orientation="vertical"
          className="flex shrink-0 flex-col gap-1 md:w-60 md:border-r md:border-zinc-200 md:pr-4 dark:md:border-zinc-800"
        >
          {TAB_GROUPS.map((group, groupIndex) => (
            <div key={group.label ?? `group-${groupIndex}`} className="flex flex-col gap-1">
              {group.label ? (
                <p
                  className={cn(
                    "px-3 text-sm font-semibold tracking-wide text-zinc-400 uppercase dark:text-zinc-500",
                    groupIndex === 0 ? undefined : "mt-3",
                  )}
                >
                  {group.label}
                </p>
              ) : null}
              {group.tabs.map((t) => (
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
                    width={20}
                    height={20}
                    className={cn(
                      "shrink-0",
                      t.id === "danger-zone" ? "text-red-600 dark:text-red-400" : "text-brand",
                    )}
                  />
                  {t.label}
                </button>
              ))}
            </div>
          ))}
        </div>

        <div
          className={cn(
            "min-w-0 flex-1 transition-opacity duration-150",
            tabContentVisible ? "opacity-100" : "opacity-0",
          )}
        >
          {renderPanel(displayedTab)}
        </div>
      </div>
    </>
  );
}
