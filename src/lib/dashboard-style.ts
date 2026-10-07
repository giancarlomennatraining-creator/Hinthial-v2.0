/**
 * Lo stile con cui si presenta la Dashboard --- scelto in Impostazioni > Aspetto, sincronizzato sul server
 * (profiles.dashboard_style) come la disposizione del menu: segue l'utente su ogni dispositivo. Gli stili mostrano
 * gli stessi dati (v. useDashboardData): cambia solo il modo di leggerli.
 */

export type DashboardStyle = "classic" | "today" | "bento" | "stories" | "board";

export const DEFAULT_DASHBOARD_STYLE: DashboardStyle = "classic";

export interface DashboardStyleOption {
  value: DashboardStyle;
  label: string;
  /** Una frase per capire a colpo d'occhio cosa si sceglie (mostrata nelle Impostazioni). */
  description: string;
}

/** Solo gli stili già disponibili: ognuno nuovo si aggiunge qui quando la sua vista esiste (v. DashboardWidgets). */
export const DASHBOARD_STYLE_OPTIONS: DashboardStyleOption[] = [
  { value: "classic", label: "Classica", description: "I riquadri di sempre: contatori, prossime scadenze, aggiunti di recente." },
  { value: "today", label: "Oggi", description: "Parte da cosa fare: ogni scadenza vicina ha il suo pulsante per segnarla fatta o rimandarla." },
  { value: "bento", label: "Bento", description: "Un colpo d'occhio su tutto, in riquadri di misure diverse: la prossima scadenza, l'archivio, la prossima capsula, gli amici, i beni e una domanda per Hinthia." },
  { value: "stories", label: "Storie", description: "La tua giornata a cinque schermate che scorrono da sole, come le storie: tocca a destra per avanzare, tieni premuto per fermarle. Pensata per lo smartphone." },
  { value: "board", label: "Lavagna", description: "Le scadenze in colonne per tempo: trascina una carta in un'altra colonna per spostarne la data, o in «Fatte» per segnarla. Ogni spostamento si annulla." },
];

export const DASHBOARD_STYLES: DashboardStyle[] = DASHBOARD_STYLE_OPTIONS.map((o) => o.value);

export function isDashboardStyle(value: unknown): value is DashboardStyle {
  return typeof value === "string" && (DASHBOARD_STYLES as string[]).includes(value);
}

/** Legge il valore grezzo dalla riga di profiles, ignorando valori inattesi. */
export function parseDashboardStyle(raw: unknown): DashboardStyle {
  return isDashboardStyle(raw) ? raw : DEFAULT_DASHBOARD_STYLE;
}
