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
import type { AuditFilterParams } from "@/domain/audit/filters";
import { CategoriesPanel } from "@/components/settings/CategoriesPanel";
import { TagsSettingsPanel } from "@/components/settings/TagsSettingsPanel";
import { ThemeToggle } from "@/components/settings/ThemeToggle";
import { NavOrientationSettings } from "@/components/settings/NavOrientationSettings";
import { BottomNavItemsSettings } from "@/components/settings/BottomNavItemsSettings";
import { MainNavItemsSettings } from "@/components/settings/MainNavItemsSettings";
import { ListViewSettings } from "@/components/settings/ListViewSettings";
import { CapsuleCountdownSettings } from "@/components/settings/CapsuleCountdownSettings";
import { DashboardStyleSettings } from "@/components/settings/DashboardStyleSettings";
import { TrashRetentionSettings } from "@/components/settings/TrashRetentionSettings";
import { DangerZonePanel } from "@/components/settings/DangerZonePanel";
import { RequireMasterKey } from "@/components/crypto/RequireMasterKey";
import { ImportExportTabs } from "@/components/import-export/ImportExportTabs";
import { AIConsentSettings } from "@/components/settings/AIConsentSettings";
import { PageHelp, type HelpTip } from "@/components/help/PageHelp";
import type { ComponentType, ReactNode, SVGProps } from "react";
import {
  ActivityIcon,
  AIIcon,
  AlertTriangleIcon,
  ArchiveIcon,
  BottomBarIcon,
  CapsuleIcon,
  CategoryIcon,
  ChecklistIcon,
  EyeIcon,
  FingerprintIcon,
  HeartIcon,
  ImportExportIcon,
  ListViewIcon,
  DashboardIcon,
  MedicalCardIcon,
  MenuListIcon,
  SecurityIcon,
  SidebarLayoutIcon,
  SlidersIcon,
  SmartphoneIcon,
  TagIcon,
  ThemeIcon,
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
  | "tags"
  | "appearance"
  | "activity"
  | "import-export"
  | "ai"
  | "danger-zone";

type IconComponent = ComponentType<SVGProps<SVGSVGElement>>;

/** Secondo livello: una funzione di una voce (es. "Tema" dentro "Aspetto"). Il suo `id` vale solo dentro la voce che la contiene. */
interface SectionDef {
  id: string;
  label: string;
  icon: IconComponent;
}

interface TabDef {
  id: Tab;
  label: string;
  icon: IconComponent;
  /** Se presente la voce è un contenitore: mostra una sola funzione alla volta (la prima, finché non se ne sceglie un'altra). */
  sections?: SectionDef[];
}

/** Raggruppate in macro-aree (11 voci piatte erano difficili da scorrere); `label: null` per le due voci pensate per restare da sole, fuori da ogni cartella: "Informazioni utente" in cima, "Zona pericolosa" in fondo. */
const TAB_GROUPS: { label: string | null; tabs: TabDef[] }[] = [
  { label: null, tabs: [{ id: "user-info", label: "Informazioni utente", icon: UserIcon }] },
  {
    label: "Sicurezza",
    tabs: [
      {
        id: "security",
        label: "Autenticazione",
        icon: SecurityIcon,
        sections: [
          { id: "authenticator", label: "App Authenticator", icon: SmartphoneIcon },
          { id: "trusted-devices", label: "Dispositivi fidati", icon: FingerprintIcon },
        ],
      },
      { id: "digital-legacy", label: "Eredità digitale", icon: HeartIcon },
      { id: "emergency-card", label: "Scheda d'emergenza", icon: MedicalCardIcon },
      { id: "activity", label: "Attività", icon: ActivityIcon },
    ],
  },
  {
    label: "Privacy e dati",
    tabs: [
      { id: "privacy", label: "Privacy", icon: EyeIcon },
      { id: "ai", label: "Hinthia", icon: AIIcon },
      { id: "categories", label: "Categorie", icon: CategoryIcon },
      { id: "tags", label: "Tag", icon: TagIcon },
      { id: "import-export", label: "Importa/Esporta", icon: ImportExportIcon },
    ],
  },
  {
    label: "Personalizzazione",
    tabs: [
      {
        id: "appearance",
        label: "Aspetto",
        icon: SlidersIcon,
        sections: [
          { id: "theme", label: "Tema", icon: ThemeIcon },
          { id: "nav-layout", label: "Disposizione menu", icon: SidebarLayoutIcon },
          { id: "nav-items", label: "Voci del menu", icon: MenuListIcon },
          { id: "bottom-bar", label: "Barra in basso", icon: BottomBarIcon },
          { id: "dashboard", label: "Dashboard", icon: DashboardIcon },
          { id: "lists", label: "Liste", icon: ListViewIcon },
          { id: "capsules", label: "Capsule", icon: CapsuleIcon },
          { id: "archive", label: "Archivio", icon: ArchiveIcon },
        ],
      },
      { id: "onboarding", label: "Onboarding", icon: ChecklistIcon },
    ],
  },
  // Sola eccezione di colore: resta nel proprio rosso/arancio di avviso invece del blu del logo, essendo l'unica voce di rischio.
  { label: null, tabs: [{ id: "danger-zone", label: "Zona pericolosa", icon: AlertTriangleIcon }] },
];

const TABS: TabDef[] = TAB_GROUPS.flatMap((group) => group.tabs);

/** Chiave di una vista: la voce da sola, oppure `voce/funzione`; è ciò che le dissolvenze confrontano. */
function viewKey(tab: Tab, section: string | null): string {
  return section ? `${tab}/${section}` : tab;
}

function parseViewKey(key: string): { tab: Tab; section: string | null } {
  const [tab, section] = key.split("/");
  return { tab: tab as Tab, section: section ?? null };
}

/** Titolo, descrizione e corpo di una funzione: il corpo occupa tutta la larghezza disponibile della pagina. */
function FunctionBlock({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex w-full flex-col gap-4">
      <div>
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">{title}</h2>
        {description ? <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">{description}</p> : null}
      </div>
      {children}
    </div>
  );
}

/** Riga di un elenco mobile (voce o funzione): icona, nome, freccia. */
function MobileRow({
  icon: Icon,
  label,
  danger,
  onClick,
}: {
  icon: IconComponent;
  label: string;
  danger?: boolean;
  onClick: () => void;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:text-zinc-300 dark:hover:bg-zinc-900"
      >
        <Icon
          width={20}
          height={20}
          className={cn("shrink-0", danger ? "text-red-600 dark:text-red-400" : "text-brand")}
        />
        <span className={cn("flex-1", danger ? "text-red-600 dark:text-red-400" : undefined)}>{label}</span>
        <span aria-hidden="true" className="text-zinc-400 dark:text-zinc-600">
          ›
        </span>
      </button>
    </li>
  );
}

/** Consigli statici per il pannello Aiuto di ogni tab (v. feedback utente: niente più testo descrittivo fisso
 * sotto ogni titolo). Un pannello per tab, non uno per Impostazioni intera: il contenuto cambia con `tab`. */
const TAB_HELP: Record<Tab, HelpTip[]> = {
  "user-info": [
    { icon: "👤", text: "Nome, email e data di nascita: usati per la scheda d'emergenza e per farti riconoscere dagli amici." },
    { icon: "🖼️", text: "Cambia il tuo avatar da qui, in qualunque momento." },
  ],
  onboarding: [
    { icon: "✅", text: "La checklist guidata per completare la configurazione di Hinthial." },
    { icon: "🔁", text: "Puoi riaprirla in ogni momento dal gadget nella barra laterale." },
  ],
  privacy: [
    { icon: "👁️", text: "Dati reali del tuo account: non richiede la master password sbloccata." },
    { icon: "📊", text: "Solo conteggi e informazioni mai cifrate: niente contenuto dei tuoi documenti." },
  ],
  security: [
    { icon: "🔐", text: "Attiva l'autenticazione a due fattori per un accesso più sicuro." },
    { icon: "👆", text: "“Dispositivi fidati” sblocca il vault con l'impronta o Face ID, senza digitare la master password." },
  ],
  "digital-legacy": [
    { icon: "💌", text: "Cosa succede ai tuoi dati se resti inattivo a lungo: lo decidi tu qui." },
    { icon: "🛡️", text: "I guardiani che hai scelto possono confermare la tua assenza." },
  ],
  "emergency-card": [
    { icon: "🆘", text: "Una scheda stampabile con le informazioni utili in caso di emergenza." },
    { icon: "🔒", text: "Cifrata come tutto il resto: richiede la master password sbloccata." },
  ],
  categories: [
    { icon: "🏷️", text: "Le categorie predefinite coprono i casi più comuni; puoi aggiungerne altre." },
    { icon: "✏️", text: "Rinomina o elimina una categoria in ogni momento." },
  ],
  tags: [
    { icon: "🏷️", text: "I tag si aggregano automaticamente, senza distinguere maiuscole e minuscole." },
    { icon: "✏️", text: "Rinominali o eliminali da qui: l'effetto si vede su ogni contenuto che li usa." },
  ],
  appearance: [
    { icon: "🎨", text: "Tema, disposizione del menu e cosa mostrare dove: tutto qui." },
    { icon: "📱", text: "Le scelte restano le stesse su tutti i tuoi dispositivi." },
  ],
  activity: [
    { icon: "📜", text: "Il registro di ogni accesso e azione sensibile sul tuo account." },
    { icon: "🔍", text: "Filtra per periodo, area, tipo di evento o singolo elemento: i filtri restano nell'indirizzo della pagina." },
  ],
  "import-export": [
    { icon: "📤", text: "Esporta tutti i tuoi dati in un unico archivio cifrato." },
    { icon: "📥", text: "Importa amici o beni da un file .csv compilato." },
  ],
  ai: [
    { icon: "🔒", text: "Per impostazione predefinita nessuna funzione di Hinthia è attiva." },
    { icon: "🎚️", text: "Il cancello generale accende solo la possibilità di attivare le singole funzioni, una per una." },
    { icon: "🏷️", text: "Il consenso all'estrazione avanzata si dà anche per categoria, qui sotto." },
  ],
  "danger-zone": [
    { icon: "⚠️", text: "“Cancella tutto” svuota Archivio, Beni, Amici e Capsule: non si può annullare." },
    { icon: "🗑️", text: "Cancellare l'account è definitivo: non sarà più possibile accedere." },
  ],
};

export function SettingsTabs({
  userId,
  firstName,
  lastName,
  email,
  avatarPath,
  avatarUrl,
  birthDate,
  initialTab,
  initialSection,
  activityParams,
}: {
  userId: string;
  firstName: string;
  lastName: string;
  email: string;
  avatarPath: string | null;
  avatarUrl: string | null;
  birthDate: string | null;
  /** Da `?tab=` (es. il link "Vedi tutto" della cronologia di un documento): ignorato se non è una scheda esistente. */
  initialTab?: string;
  /** Da `?section=`: la funzione di una voce a due livelli (es. `?tab=appearance&section=theme`); ignorata se non esiste in quella voce. */
  initialSection?: string;
  /** Filtri iniziali di Attività, da `?from=&entity=...` (es. il link "Vedi attività di questo contenuto" da un documento). */
  activityParams?: AuditFilterParams;
}) {
  const startTabDef = TABS.find((t) => t.id === initialTab) ?? null;
  const startTab = startTabDef?.id ?? null;
  const startSection = startTabDef?.sections?.find((s) => s.id === initialSection)?.id ?? null;
  const [tab, setTab] = useState<Tab>(startTab ?? "user-info");
  // Desktop: una voce a due livelli mostra sempre una funzione (la prima, se non se n'è scelta un'altra).
  const [section, setSection] = useState<string | null>(startSection ?? startTabDef?.sections?.[0]?.id ?? null);
  // Il contenuto dissolve verso la scheda scelta invece di sostituirsi di scatto; il tasto (che usa `tab`/`section`, non la vista mostrata) risponde subito al click.
  const { displayed: displayedKey, visible: tabContentVisible } = useCrossfade(viewKey(tab, section), 150);
  const displayedView = parseViewKey(displayedKey);

  function selectTab(def: TabDef) {
    setTab(def.id);
    setSection(def.sections?.[0]?.id ?? null);
  }

  // Mobile: elenco delle voci -> (per le voci a due livelli, elenco delle funzioni ->) dettaglio, indipendente dal layout desktop (`md:hidden`/`hidden md:flex`). `null` = mostra l'elenco.
  const [mobileSection, setMobileSection] = useState<Tab | null>(startTab);
  const [mobileSub, setMobileSub] = useState<string | null>(startSection);
  const mobileKey = mobileSection === null ? "list" : viewKey(mobileSection, mobileSub);
  const { displayed: displayedMobileKey, visible: mobileViewVisible } = useCrossfade(mobileKey, 150);
  const displayedMobile = displayedMobileKey === "list" ? null : parseViewKey(displayedMobileKey);
  const displayedMobileTab = displayedMobile ? (TABS.find((t) => t.id === displayedMobile.tab) ?? null) : null;

  /** Il contenuto di una scheda --- condiviso tra il layout desktop (schede + contenuto sempre insieme) e il dettaglio mobile (una voce alla volta), così le due navigazioni indipendenti non duplicano la logica di quale pannello mostrare. */
  function renderPanel(activeTab: Tab, activeSection: string | null) {
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
      // Serve i dati decifrati per calcolare l'avanzamento --- richiede la master key sbloccata.
      return (
        <RequireMasterKey>{(masterKey) => <OnboardingSettingsPanel masterKey={masterKey} />}</RequireMasterKey>
      );
    }
    if (activeTab === "privacy") {
      // Solo conteggi e colonne mai cifrate: non richiede la master key.
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
      // Layer di identità (login), non di cifratura: non richiede la master key. "Dispositivi fidati" la sblocca da sé nel proprio modulo, per non forzare uno sblocco solo per vedere lo stato dell'MFA.
      if (activeSection === "trusted-devices") {
        return (
          <FunctionBlock
            title="Dispositivi fidati"
            description="Sblocca il vault con l'impronta o Face ID su questo dispositivo, invece della master password."
          >
            <DeviceLockPanel userId={userId} />
          </FunctionBlock>
        );
      }
      return <MfaSettingsPanel userId={userId} />;
    }
    if (activeTab === "digital-legacy") {
      // Solo parametri, nessun dato cifrato coinvolto: non richiede la master key.
      return <DigitalLegacySettingsPanel userId={userId} />;
    }
    if (activeTab === "emergency-card") {
      // Tutto cifrato: richiede la master key, a differenza della scheda qui sopra.
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
      // Non richiede la master key: il consenso riguarda solo dati già decifrati e mostrati altrove (v. AIPanel).
      return (
        <div className="flex flex-col gap-4">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
            Hinthia
          </h2>
          <AIConsentSettings />
        </div>
      );
    }
    if (activeTab === "categories") {
      return <CategoriesPanel />;
    }
    if (activeTab === "tags") {
      // A differenza di Categorie, i tag sono cifrati: richiede la master key sbloccata.
      return <RequireMasterKey>{(masterKey) => <TagsSettingsPanel masterKey={masterKey} />}</RequireMasterKey>;
    }
    if (activeTab === "appearance") {
      if (activeSection === "nav-layout") {
        return (
          <FunctionBlock
            title="Disposizione del menu"
            description="Barra laterale a sinistra o a destra, oppure barra orizzontale in alto — la scelta resta la stessa su tutti i tuoi dispositivi."
          >
            <NavOrientationSettings />
          </FunctionBlock>
        );
      }
      if (activeSection === "nav-items") {
        return (
          <FunctionBlock
            title="Voci del menu principale"
            description="Scegli quali voci mostrare nel menu di navigazione, e in che ordine."
          >
            <MainNavItemsSettings />
          </FunctionBlock>
        );
      }
      if (activeSection === "bottom-bar") {
        return (
          <FunctionBlock
            title="Barra di navigazione in basso (smartphone)"
            description="Scegli quali voci mostrare sempre in basso su smartphone — le altre restano comunque raggiungibili dal menu con le 3 lineette."
          >
            <BottomNavItemsSettings />
          </FunctionBlock>
        );
      }
      if (activeSection === "dashboard") {
        return (
          <FunctionBlock
            title="Stile della Dashboard"
            description="Scegli come si presenta la prima pagina: gli stessi dati, letti in modi diversi. La scelta resta la stessa su tutti i tuoi dispositivi."
          >
            <DashboardStyleSettings />
          </FunctionBlock>
        );
      }
      if (activeSection === "lists") {
        return (
          <FunctionBlock
            title="Visualizzazione delle liste"
            description="Elenco o tabella impaginata, per ogni sezione — la scelta resta la stessa su tutti i tuoi dispositivi, e puoi cambiarla anche direttamente da ogni sezione. Su schermi stretti si mostra comunque sempre l'elenco, dove la tabella non avrebbe spazio per restare leggibile."
          >
            <ListViewSettings />
          </FunctionBlock>
        );
      }
      if (activeSection === "capsules") {
        return (
          <FunctionBlock title="Capsule" description="Elementi visivi propri di questa sezione.">
            <CapsuleCountdownSettings />
          </FunctionBlock>
        );
      }
      if (activeSection === "archive") {
        return (
          <FunctionBlock title="Archivio" description="Elementi visivi propri di questa sezione.">
            <TrashRetentionSettings />
          </FunctionBlock>
        );
      }
      return (
        <FunctionBlock
          title="Tema"
          description="Scegli l'aspetto dell'app, o lascia che segua le impostazioni del tuo dispositivo."
        >
          <ThemeToggle />
        </FunctionBlock>
      );
    }
    if (activeTab === "activity") {
      // Il registro è in chiaro: non richiede la master key (con vault sbloccato mostra anche i nomi degli elementi).
      return <AuditLogPanel initialParams={activityParams} />;
    }
    if (activeTab === "import-export") {
      // ImportExportTabs gestisce da sé le proprie sotto-schede e il proprio RequireMasterKey.
      return <ImportExportTabs firstName={firstName} lastName={lastName} email={email} />;
    }
    // "Cancella tutto" ha bisogno della master key sbloccata per scoprire i path da rimuovere in Storage.
    return (
      <RequireMasterKey>{(masterKey) => <DangerZonePanel userId={userId} masterKey={masterKey} />}</RequireMasterKey>
    );
  }

  const mobileBackLabel = displayedMobile?.section && displayedMobileTab ? displayedMobileTab.label : "Torna alle impostazioni";
  // La funzione di una voce a due livelli porta già il proprio titolo nel corpo; la voce senza funzioni, e l'elenco delle sue funzioni, hanno il titolo qui.
  const mobileIsFunction = displayedMobile?.section != null;
  const mobileIsFunctionList = displayedMobileTab?.sections != null && !mobileIsFunction;

  return (
    <>
      {/* Mobile: elenco delle voci -> (elenco delle funzioni ->) dettaglio, con un tasto per tornare indietro. */}
      <div className="md:hidden">
        <div
          className={cn(
            "transition-opacity duration-150",
            mobileViewVisible ? "opacity-100" : "opacity-0",
          )}
        >
          {displayedMobile === null || displayedMobileTab === null ? (
            // Un blocco per gruppo: il nome del gruppo vive sopra e fuori dal proprio blocco.
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
                      <MobileRow
                        key={t.id}
                        icon={t.icon}
                        label={t.label}
                        danger={t.id === "danger-zone"}
                        onClick={() => {
                          setMobileSub(null);
                          setMobileSection(t.id);
                        }}
                      />
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              <div className="flex items-start justify-between gap-3">
                <button
                  type="button"
                  onClick={() => (mobileSub ? setMobileSub(null) : setMobileSection(null))}
                  className="flex items-center gap-1.5 self-start text-sm font-medium text-zinc-500 underline-offset-2 hover:underline dark:text-zinc-400"
                >
                  <span aria-hidden="true">←</span> {mobileBackLabel}
                </button>
                {mobileIsFunction ? (
                  <PageHelp title={displayedMobileTab.label} tips={TAB_HELP[displayedMobileTab.id]} />
                ) : null}
              </div>
              {mobileIsFunction ? null : (
                <div className="flex items-start justify-between gap-3">
                  <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">{displayedMobileTab.label}</h2>
                  <PageHelp title={displayedMobileTab.label} tips={TAB_HELP[displayedMobileTab.id]} />
                </div>
              )}
              {mobileIsFunctionList ? (
                <ul className="flex flex-col divide-y divide-zinc-200 rounded-2xl border border-zinc-200 bg-white dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-950">
                  {displayedMobileTab.sections?.map((sec) => (
                    <MobileRow key={sec.id} icon={sec.icon} label={sec.label} onClick={() => setMobileSub(sec.id)} />
                  ))}
                </ul>
              ) : (
                renderPanel(displayedMobile.tab, displayedMobile.section)
              )}
            </div>
          )}
        </div>
      </div>

      {/* Desktop: schede laterali (con le funzioni sotto la voce aperta) + contenuto, sempre visibili insieme. */}
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
                <div key={t.id} className="flex flex-col gap-1">
                  <button
                    type="button"
                    role="tab"
                    aria-selected={tab === t.id}
                    aria-expanded={t.sections ? tab === t.id : undefined}
                    onClick={() => selectTab(t)}
                    className={cn(
                      "flex shrink-0 items-center gap-2 whitespace-nowrap rounded-xl px-3 py-2 text-left text-sm font-medium transition-colors",
                      tab === t.id
                        ? t.id === "danger-zone"
                          ? "bg-red-500/10 text-red-600 dark:text-red-400"
                          : "bg-brand/10 text-brand"
                        : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-900",
                    )}
                  >
                    {/* Icona sempre blu a prescindere dallo stato attivo/inattivo, eccetto "Zona pericolosa" nel proprio colore di avviso. */}
                    <t.icon
                      width={20}
                      height={20}
                      className={cn(
                        "shrink-0",
                        t.id === "danger-zone" ? "text-red-600 dark:text-red-400" : "text-brand",
                      )}
                    />
                    <span className="flex-1">{t.label}</span>
                    {t.sections ? (
                      <span
                        aria-hidden="true"
                        className={cn(
                          "text-zinc-400 transition-transform dark:text-zinc-600",
                          tab === t.id ? "rotate-90" : undefined,
                        )}
                      >
                        ›
                      </span>
                    ) : null}
                  </button>
                  {t.sections && tab === t.id ? (
                    <div className="ml-5 flex flex-col gap-0.5 border-l border-zinc-200 pl-2 dark:border-zinc-800">
                      {t.sections.map((sec) => (
                        <button
                          key={sec.id}
                          type="button"
                          role="tab"
                          aria-selected={section === sec.id}
                          onClick={() => setSection(sec.id)}
                          className={cn(
                            "flex items-center gap-2 whitespace-nowrap rounded-lg px-2.5 py-1.5 text-left text-sm font-medium transition-colors",
                            section === sec.id
                              ? "bg-brand/10 text-brand"
                              : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-900",
                          )}
                        >
                          <sec.icon width={16} height={16} className="shrink-0 text-brand" />
                          {sec.label}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
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
          <div className="mb-4 flex justify-end">
            <PageHelp
              title={TABS.find((t) => t.id === displayedView.tab)?.label ?? ""}
              tips={TAB_HELP[displayedView.tab]}
            />
          </div>
          {renderPanel(displayedView.tab, displayedView.section)}
        </div>
      </div>
    </>
  );
}
