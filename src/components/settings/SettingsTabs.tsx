"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { useCrossfade } from "@/lib/use-crossfade";
import { UserInfoPanel } from "@/components/settings/UserInfoPanel";
import { EmergencyCardPanel } from "@/components/settings/EmergencyCardPanel";
import { PlanSettingsPanel } from "@/components/settings/PlanSettingsPanel";
import { PrivacyPanel } from "@/components/settings/PrivacyPanel";
import { MfaSettingsPanel } from "@/components/settings/MfaSettingsPanel";
import { DeviceLockPanel } from "@/components/settings/DeviceLockPanel";
import { AuditLogPanel } from "@/components/settings/AuditLogPanel";
import type { AuditFilterParams } from "@/domain/audit/filters";
import { CategoriesPanel } from "@/components/settings/CategoriesPanel";
import { StyleToggle } from "@/components/settings/StyleToggle";
import { ThemeToggle } from "@/components/settings/ThemeToggle";
import { CapsuleCountdownSettings } from "@/components/settings/CapsuleCountdownSettings";
import { CapsuleOpenEffectSettings } from "@/components/settings/CapsuleOpenEffectSettings";
import { IntroSettings } from "@/components/settings/IntroSettings";
import { TrashRetentionSettings } from "@/components/settings/TrashRetentionSettings";
import { DangerZonePanel } from "@/components/settings/DangerZonePanel";
import { RequireMasterKey } from "@/components/crypto/RequireMasterKey";
import { ImportExportTabs } from "@/components/import-export/ImportExportTabs";
import { StorageUsageMeter } from "@/components/ui/StorageUsageMeter";
import { AIConsentSettings } from "@/components/settings/AIConsentSettings";
import { SettingsBlock, SettingsFocusContext } from "@/components/settings/SettingsBlock";
import { SettingsSearch } from "@/components/settings/SettingsSearch";
import {
  resolveSettingsTarget,
  type SettingsEntry,
  type SettingsTab as Tab,
} from "@/components/settings/settings-index";
import { PageHelp, type HelpTip } from "@/components/help/PageHelp";
import type { ComponentType, SVGProps } from "react";
import { BACK_LINK_CLASS } from "@/components/ui/BackLink";
import { PANEL_FLAT } from "@/components/ui/styles";
import {
  AlertTriangleIcon,
  CategoryIcon,
  EyeIcon,
  SecurityIcon,
  SlidersIcon,
  UserIcon,
} from "@/components/icons/nav-icons";

type IconComponent = ComponentType<SVGProps<SVGSVGElement>>;

interface TabDef {
  id: Tab;
  label: string;
  icon: IconComponent;
}

/**
 * Sei pagine, ognuna col nome di ciò che ci si fa (prima erano undici voci e due sottomenu, raggruppate per categorie che
 * non dicevano cosa c'era dentro). Dentro ogni pagina, i blocchi: v. SettingsBlock. Il nome della pagina è anche il titolo
 * della pagina stessa, e quello che si cerca nella ricerca.
 */
const TABS: TabDef[] = [
  { id: "profile", label: "Profilo", icon: UserIcon },
  { id: "security", label: "Accesso e sicurezza", icon: SecurityIcon },
  { id: "privacy", label: "Privacy e Hinthia", icon: EyeIcon },
  { id: "data", label: "I miei dati", icon: CategoryIcon },
  { id: "preferences", label: "Aspetto e preferenze", icon: SlidersIcon },
  // Sola eccezione di colore: resta nel proprio rosso/arancio di avviso invece del blu del logo, essendo l'unica voce di rischio.
  { id: "danger-zone", label: "Zona pericolosa", icon: AlertTriangleIcon },
];

const TAB_LABELS = Object.fromEntries(TABS.map((t) => [t.id, t.label])) as Record<Tab, string>;

/** Consigli statici per il pannello Aiuto di ogni pagina (v. feedback utente: niente più testo descrittivo fisso sotto ogni titolo). */
const TAB_HELP: Record<Tab, HelpTip[]> = {
  profile: [
    { icon: "👤", text: "Nome, email e data di nascita: usati per la scheda d'emergenza e per farti riconoscere dagli amici." },
    { icon: "🖼️", text: "Cambia il tuo avatar da qui, in qualunque momento." },
    { icon: "🆘", text: "La scheda d'emergenza è una tessera stampabile con le informazioni utili a chi ti soccorre: gruppo sanguigno, allergie, farmaci, medico e contatti." },
  ],
  security: [
    { icon: "🔐", text: "Attiva la verifica in due passaggi per un accesso più sicuro." },
    { icon: "👆", text: "“Dispositivi fidati” sblocca il vault con l'impronta o Face ID, senza digitare la master password." },
    { icon: "📜", text: "Il registro delle attività elenca ogni accesso e azione sensibile sul tuo account; si filtra per periodo, area, tipo di evento o singolo elemento." },
  ],
  privacy: [
    { icon: "👁️", text: "Dati reali del tuo account: non richiede la master password sbloccata. Solo conteggi e informazioni mai cifrate, niente contenuto dei tuoi documenti." },
    { icon: "🔒", text: "Per impostazione predefinita nessuna funzione di Hinthia è attiva." },
    { icon: "🎚️", text: "Il cancello generale accende solo la possibilità di attivare le singole funzioni, una per una; il consenso all'estrazione avanzata si dà anche per categoria." },
  ],
  data: [
    { icon: "🏷️", text: "Le categorie predefinite coprono i casi più comuni; puoi aggiungerne altre, rinominarle o eliminarle." },
    { icon: "💾", text: "Lo spazio mostra quanto occupano i tuoi file cifrati e quanto te ne resta." },
    { icon: "📤", text: "Esporta tutti i tuoi dati in un unico archivio cifrato, o importa amici e beni da un file .csv compilato." },
    { icon: "🗑️", text: "Il Cestino tiene i documenti eliminati per il tempo che scegli qui." },
  ],
  preferences: [
    { icon: "🎨", text: "Stile e tema valgono su questo dispositivo; le preferenze delle capsule restano le stesse su tutti i tuoi dispositivi." },
    { icon: "✅", text: "La guida iniziale si riapre in ogni momento anche dal gadget nella barra laterale." },
  ],
  "danger-zone": [
    { icon: "⚠️", text: "“Reimposta l'account” svuota Archivio, Beni, Amici e Capsule: non si può annullare." },
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
  /** Da `?tab=` (es. il link "Vedi tutto" della cronologia di un documento): ignorato se non è una pagina esistente. Valgono anche i nomi di prima. */
  initialTab?: string;
  /** Da `?section=`: il blocco da portare in vista, o (coi nomi di prima) la funzione di una voce a due livelli. */
  initialSection?: string;
  /** Filtri iniziali del registro delle attività, da `?from=&entity=...` (es. il link "Vedi attività di questo contenuto" da un documento). */
  activityParams?: AuditFilterParams;
}) {
  const start = resolveSettingsTarget(initialTab, initialSection);
  const [tab, setTab] = useState<Tab>(start?.tab ?? "profile");
  // Il contenuto dissolve verso la pagina scelta invece di sostituirsi di scatto; il tasto (che usa `tab`, non la vista mostrata) risponde subito al click.
  const { displayed: displayedTab, visible: tabContentVisible } = useCrossfade(tab, 150);
  // Mobile: elenco delle pagine -> pagina, indipendente dal layout desktop (`lg:hidden`/`hidden lg:flex`). `null` = mostra l'elenco.
  const [mobileTab, setMobileTab] = useState<Tab | null>(start?.tab ?? null);
  const { displayed: displayedMobileTab, visible: mobileViewVisible } = useCrossfade(mobileTab, 150);
  // Il blocco da portare in vista: dall'indirizzo, o da un risultato di ricerca. `n` distingue due richieste dello stesso blocco.
  const [focus, setFocus] = useState<{ block: string | null; n: number }>({ block: start?.block ?? null, n: 0 });

  function selectTab(next: Tab) {
    setTab(next);
    setFocus((f) => ({ block: null, n: f.n + 1 }));
  }

  function selectMobile(next: Tab) {
    setMobileTab(next);
    setFocus((f) => ({ block: null, n: f.n + 1 }));
  }

  function goTo(entry: SettingsEntry) {
    setTab(entry.tab);
    setMobileTab(entry.tab);
    setFocus((f) => ({ block: entry.block, n: f.n + 1 }));
  }

  /** Il contenuto di una pagina: condiviso tra il layout desktop e quello mobile, così le due navigazioni indipendenti non duplicano la logica di quale pannello mostrare. */
  function renderPanel(active: Tab) {
    switch (active) {
      case "profile":
        // La scheda d'emergenza serve a chi presta soccorso adesso, non a chi eredita: sta qui, coi dati personali. È cifrata, quindi chiede la master key (nel suo blocco, senza fermare il resto del profilo).
        return (
          <div className="flex flex-col">
            <UserInfoPanel
              userId={userId}
              firstName={firstName}
              lastName={lastName}
              email={email}
              avatarPath={avatarPath}
              avatarUrl={avatarUrl}
              birthDate={birthDate}
            />
            <SettingsBlock
              id="card"
              title="Scheda d'emergenza"
              description="Pochi campi, scritti una volta, cifrati come tutto il resto: servono solo a generare una tessera da stampare e portare nel portafoglio o tenere sul frigorifero, per chi presta soccorso quando non puoi parlare tu."
            >
              <RequireMasterKey inline>
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
            </SettingsBlock>
          </div>
        );
      case "security":
        // Layer di identità (login), non di cifratura: non richiede la master key. "Dispositivi fidati" la sblocca da sé nel proprio modulo, per non forzare uno sblocco solo per vedere lo stato dell'MFA. Il registro è in chiaro: con vault sbloccato mostra anche i nomi degli elementi.
        return (
          <div className="flex flex-col">
            <MfaSettingsPanel userId={userId} />
            <SettingsBlock
              id="trusted-devices"
              title="Dispositivi fidati"
              description="Sblocca il vault con l'impronta o Face ID su questo dispositivo, invece della master password."
            >
              <DeviceLockPanel userId={userId} />
            </SettingsBlock>
            <SettingsBlock
              id="activity"
              title="Registro delle attività"
              description="Tutto ciò che è successo sul tuo account e sui tuoi contenuti: cosa è stato fatto e quando. Il contenuto dei tuoi dati resta privato."
              collapsible
            >
              <AuditLogPanel initialParams={activityParams} />
            </SettingsBlock>
          </div>
        );
      case "privacy":
        // Non richiedono la master key: solo conteggi e colonne mai cifrate, e il consenso riguarda dati già decifrati e mostrati altrove (v. RaccontamiPage e PageHelp).
        return (
          <div className="flex flex-col">
            <SettingsBlock
              id="know"
              title="Cosa sa Hinthial di te"
              description="I dati reali e attuali del tuo account. Il contenuto di ciò che ci affidi resta cifrato sul tuo dispositivo prima ancora di lasciarlo."
            >
              <PrivacyPanel
                userId={userId}
                firstName={firstName}
                lastName={lastName}
                email={email}
                birthDate={birthDate}
              />
            </SettingsBlock>
            <SettingsBlock
              id="hinthia"
              title="Hinthia"
              description="Le funzioni di intelligenza artificiale. Nessuna è attiva finché non la accendi tu, una per una."
            >
              <AIConsentSettings />
            </SettingsBlock>
          </div>
        );
      case "data":
        return (
          <div className="flex flex-col">
            <SettingsBlock id="space" title="Spazio" description="Quanto spazio occupano i tuoi file cifrati.">
              <StorageUsageMeter />
            </SettingsBlock>
            <SettingsBlock
              id="trash"
              title="Cestino"
              description="Quanto restano i documenti nel Cestino prima di sparire per sempre."
            >
              <TrashRetentionSettings />
            </SettingsBlock>
            <SettingsBlock
              id="import-export"
              title="Importa ed esporta"
              description="Esporta tutti i tuoi dati in un archivio cifrato, o importa amici e beni da un file .csv."
            >
              {/* ImportExportTabs gestisce da sé le proprie sotto-schede e il proprio RequireMasterKey. */}
              <ImportExportTabs firstName={firstName} lastName={lastName} email={email} />
            </SettingsBlock>
            <SettingsBlock
              id="categories"
              title="Categorie"
              description="Quelle iniziali sono un punto di partenza: aggiungi, rinomina o elimina le tue."
            >
              <CategoriesPanel />
            </SettingsBlock>
          </div>
        );
      case "preferences":
        return (
          <div className="flex flex-col">
            <SettingsBlock
              id="style"
              title="Stile"
              description="I colori dell'app. Cambia solo come appare, non ciò che puoi fare. Vale su questo dispositivo."
            >
              <StyleToggle />
            </SettingsBlock>
            <SettingsBlock
              id="theme"
              title="Tema"
              description="Scegli l'aspetto dell'app, o lascia che segua le impostazioni del tuo dispositivo."
            >
              <ThemeToggle />
            </SettingsBlock>
            <SettingsBlock
              id="capsule-effect"
              title="Come si aprono le capsule"
              description="L'effetto con cui chi riceve una capsula la vede aprirsi. Qui scegli quello che ti propongo quando ne crei una; per ognuna puoi sceglierne un altro."
            >
              <CapsuleOpenEffectSettings />
            </SettingsBlock>
            <SettingsBlock
              id="capsule-countdown"
              title="Conto alla rovescia"
              description="Se mostrare i giorni, le ore e i minuti che mancano all'apertura di una capsula."
            >
              <CapsuleCountdownSettings />
            </SettingsBlock>
            <SettingsBlock
              id="intro"
              title="Entrata dell'app"
              description="L'animazione che si vede aprendo Hinthial installata sul telefono. Vale su questo dispositivo."
            >
              <IntroSettings />
            </SettingsBlock>
            <SettingsBlock
              id="onboarding"
              title="Il tuo piano"
              description="L'indicatore dell'avanzamento nella barra di navigazione. Il piano sta in Oggi."
            >
              <PlanSettingsPanel />
            </SettingsBlock>
          </div>
        );
      case "danger-zone":
        // "Reimposta l'account" ha bisogno della master key sbloccata per scoprire i path da rimuovere in Storage.
        return (
          <RequireMasterKey inline>{(masterKey) => <DangerZonePanel userId={userId} masterKey={masterKey} />}</RequireMasterKey>
        );
    }
  }

  const mobileTabDef = displayedMobileTab ? TABS.find((t) => t.id === displayedMobileTab) : null;
  const desktopTabDef = TABS.find((t) => t.id === displayedTab);

  return (
    <SettingsFocusContext.Provider value={focus}>
      {/* Mobile: elenco delle pagine -> pagina, con un tasto per tornare indietro. */}
      <div className="lg:hidden">
        <div className={cn("transition-opacity duration-150", mobileViewVisible ? "opacity-100" : "opacity-0")}>
          {mobileTabDef === null || mobileTabDef === undefined ? (
            <div className="flex flex-col gap-4">
              <SettingsSearch tabLabels={TAB_LABELS} onSelect={goTo} />
              <ul className={`${PANEL_FLAT} flex flex-col divide-y divide-zinc-200 dark:divide-zinc-800`}>
                {TABS.map((t) => {
                  const danger = t.id === "danger-zone";
                  return (
                    <li key={t.id}>
                      <button
                        type="button"
                        onClick={() => selectMobile(t.id)}
                        className="flex w-full items-center gap-3 px-4 py-3.5 text-left text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:text-zinc-300 dark:hover:bg-zinc-900"
                      >
                        <t.icon width={20} height={20} className={cn("shrink-0", danger ? "text-red-600 dark:text-red-400" : "text-accent")} />
                        <span className={cn("flex-1", danger ? "text-red-600 dark:text-red-400" : undefined)}>{t.label}</span>
                        <span aria-hidden="true" className="text-zinc-500 dark:text-zinc-500">
                          ›
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : (
            <div className="@container flex flex-col gap-4">
              <div className="flex items-start justify-between gap-3">
                <button type="button" onClick={() => setMobileTab(null)} className={BACK_LINK_CLASS}>
                  <span aria-hidden="true">←</span> Torna alle impostazioni
                </button>
                <PageHelp title={mobileTabDef.label} tips={TAB_HELP[mobileTabDef.id]} />
              </div>
              <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">{mobileTabDef.label}</h2>
              {renderPanel(mobileTabDef.id)}
            </div>
          )}
        </div>
      </div>

      {/* Desktop: pagine a sinistra, contenuto a destra, sempre visibili insieme. */}
      <div className="hidden lg:flex lg:gap-10">
        <div className="flex shrink-0 flex-col gap-4 lg:w-60 lg:border-r lg:border-zinc-200 lg:pr-4 dark:lg:border-zinc-800">
          <SettingsSearch tabLabels={TAB_LABELS} onSelect={goTo} />
          <div role="tablist" aria-orientation="vertical" className="flex flex-col gap-1">
            {TABS.map((t, i) => {
              const danger = t.id === "danger-zone";
              return (
                <button
                  key={t.id}
                  type="button"
                  role="tab"
                  aria-selected={tab === t.id}
                  onClick={() => selectTab(t.id)}
                  className={cn(
                    "flex shrink-0 items-center gap-2 whitespace-nowrap rounded-xl px-3 py-2 text-left text-sm font-medium transition-colors",
                    danger && i > 0 ? "mt-3" : undefined,
                    tab === t.id
                      ? danger
                        ? "bg-red-500/10 text-red-600 dark:text-red-400"
                        : "bg-brand/10 text-accent"
                      : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-900",
                  )}
                >
                  {/* Icona sempre blu a prescindere dallo stato attivo/inattivo, eccetto "Zona pericolosa" nel proprio colore di avviso. */}
                  <t.icon width={20} height={20} className={cn("shrink-0", danger ? "text-red-600 dark:text-red-400" : "text-accent")} />
                  <span className="flex-1">{t.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div
          className={cn(
            "@container min-w-0 flex-1 transition-opacity duration-150",
            tabContentVisible ? "opacity-100" : "opacity-0",
          )}
        >
          <div className="mb-6 flex items-start justify-between gap-4">
            <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">{desktopTabDef?.label}</h2>
            {desktopTabDef ? <PageHelp title={desktopTabDef.label} tips={TAB_HELP[desktopTabDef.id]} /> : null}
          </div>
          {renderPanel(displayedTab)}
        </div>
      </div>
    </SettingsFocusContext.Provider>
  );
}
