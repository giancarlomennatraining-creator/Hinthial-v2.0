/**
 * L'indice delle Impostazioni: le sei pagine, i blocchi che contengono, la ricerca e la traduzione dei vecchi indirizzi.
 * Sta fuori dai componenti perché sia leggibile (e provabile) senza disegnare nulla.
 */

export type SettingsTab = "profile" | "security" | "privacy" | "data" | "preferences" | "danger-zone";

export interface SettingsTarget {
  tab: SettingsTab;
  /** Il blocco da portare in vista (e da aprire, se richiudibile), se si punta a uno in particolare. */
  block: string | null;
}

export interface SettingsEntry extends SettingsTarget {
  label: string;
  /** Parole con cui la gente cerca la cosa, oltre al nome: "faccia", "impronta", "scuro"… */
  keywords: string;
}

export const SETTINGS_ENTRIES: SettingsEntry[] = [
  { tab: "profile", block: "avatar", label: "Foto profilo", keywords: "avatar immagine scatta carica" },
  { tab: "profile", block: "personal", label: "Dati personali", keywords: "nome cognome data di nascita compleanno" },
  { tab: "profile", block: "card", label: "Scheda d'emergenza", keywords: "tessera sanguigno allergie farmaci medico contatti soccorso stampa emergenza" },
  { tab: "profile", block: "email", label: "Email", keywords: "indirizzo posta cambia" },
  { tab: "security", block: "authenticator", label: "Verifica in due passaggi", keywords: "2fa mfa authenticator codice app accesso" },
  { tab: "security", block: "backup-codes", label: "Codici di backup", keywords: "recupero emergenza perso telefono" },
  { tab: "security", block: "trusted-devices", label: "Dispositivi fidati", keywords: "impronta face id biometrico sblocco master password" },
  { tab: "security", block: "activity", label: "Registro delle attività", keywords: "accessi cronologia log storico audit" },
  { tab: "privacy", block: "know", label: "Cosa sa Hinthial di te", keywords: "privacy dati informativa visibile cifrato" },
  { tab: "privacy", block: "hinthia", label: "Hinthia", keywords: "intelligenza artificiale ai consenso estrazione assistente" },
  { tab: "data", block: "space", label: "Spazio usato", keywords: "quota archiviazione gigabyte memoria occupato" },
  { tab: "data", block: "categories", label: "Categorie", keywords: "etichette tipi documenti" },
  { tab: "data", block: "import-export", label: "Importa ed esporta", keywords: "backup csv scarica file template" },
  { tab: "data", block: "trash", label: "Cestino", keywords: "eliminati giorni rimozione definitiva" },
  { tab: "preferences", block: "style", label: "Stile", keywords: "foglia notte luce colori aspetto" },
  { tab: "preferences", block: "theme", label: "Tema", keywords: "chiaro scuro sistema notte" },
  { tab: "preferences", block: "capsule-effect", label: "Come si aprono le capsule", keywords: "effetto animazione apertura" },
  { tab: "preferences", block: "capsule-countdown", label: "Conto alla rovescia delle capsule", keywords: "countdown cartellino giorni ore" },
  { tab: "preferences", block: "intro", label: "Entrata dell'app", keywords: "animazione avvio apertura splash suono intro aurora" },
  { tab: "preferences", block: "onboarding", label: "Guida iniziale", keywords: "onboarding checklist configurazione primi passi" },
  { tab: "danger-zone", block: "reset", label: "Reimposta l'account", keywords: "cancella tutto svuota azzera reset" },
  { tab: "danger-zone", block: "delete", label: "Cancella il tuo account", keywords: "elimina chiudi account definitivo" },
];

const TAB_IDS: SettingsTab[] = ["profile", "security", "privacy", "data", "preferences", "danger-zone"];

/** I nomi delle voci di prima (`?tab=user-info`, `?tab=activity`…) continuano ad aprire il punto giusto: i link già salvati o inviati non si rompono. */
const LEGACY: Record<string, SettingsTarget> = {
  "user-info": { tab: "profile", block: null },
  security: { tab: "security", block: null },
  activity: { tab: "security", block: "activity" },
  privacy: { tab: "privacy", block: null },
  ai: { tab: "privacy", block: "hinthia" },
  categories: { tab: "data", block: "categories" },
  "import-export": { tab: "data", block: "import-export" },
  appearance: { tab: "preferences", block: null },
  onboarding: { tab: "preferences", block: "onboarding" },
};

/** Le funzioni di una voce a due livelli (`?tab=appearance&section=archive`): il Cestino, ad esempio, ora sta in "I miei dati". */
const LEGACY_SECTIONS: Record<string, SettingsTarget> = {
  authenticator: { tab: "security", block: "authenticator" },
  "trusted-devices": { tab: "security", block: "trusted-devices" },
  theme: { tab: "preferences", block: "theme" },
  capsules: { tab: "preferences", block: "capsule-effect" },
  archive: { tab: "data", block: "trash" },
};

/** Da `?tab=` e `?section=` alla pagina e al blocco; `null` se l'indirizzo non indica nulla di valido. */
export function resolveSettingsTarget(tab?: string, section?: string): SettingsTarget | null {
  if (!tab) return null;
  if ((TAB_IDS as string[]).includes(tab)) {
    return { tab: tab as SettingsTab, block: section ?? null };
  }
  const legacy = LEGACY[tab];
  if (!legacy) return null;
  return (section ? LEGACY_SECTIONS[section] : undefined) ?? legacy;
}

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

/** Le voci che contengono tutte le parole scritte (nel nome o nelle parole chiave), il nome per primo. */
export function searchSettings(query: string): SettingsEntry[] {
  const words = normalize(query).split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];
  const hits: { entry: SettingsEntry; inLabel: boolean }[] = [];
  for (const entry of SETTINGS_ENTRIES) {
    const label = normalize(entry.label);
    const all = `${label} ${normalize(entry.keywords)}`;
    if (words.every((w) => all.includes(w))) hits.push({ entry, inLabel: words.every((w) => label.includes(w)) });
  }
  return hits.sort((a, b) => Number(b.inLabel) - Number(a.inLabel)).map((h) => h.entry);
}
