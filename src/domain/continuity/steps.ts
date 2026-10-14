/**
 * Il punteggio di continuità: quanto Hinthial è pronto a fare arrivare ciò che sai e ciò che hai alle persone a cui
 * tieni, se un giorno non ci sei. Quattro passi, tutti verificabili dai dati già in mano alla pagina; ognuno dice cosa è
 * fatto e, se manca, dove andare a farlo. Puro: nessuna rete, nessun database.
 */

export interface ContinuityInput {
  /** Amici che hai nominato guardiani (v. Friend.isGuardian), attivi. */
  guardianCount: number;
  /** L'eredità digitale è accesa (v. DigitalLegacySettings.enabled). */
  legacyEnabled: boolean;
  /** La scheda d'emergenza ha almeno un dato. */
  emergencyCardFilled: boolean;
  /** Capsule già chiuse con almeno un destinatario: qualcosa che arriverà a qualcuno, alla sua data. */
  capsulesForOthers: number;
  /** Di quelle, le capsule che si aprono anche prima della data se l'eredità consegna (v. Capsule.openOnLegacy). */
  capsulesForDelivery: number;
}

export interface ContinuityStep {
  id: "guardians" | "legacy" | "emergency-card" | "capsules";
  done: boolean;
  /** Cosa c'è di fatto (se `done`) o cosa manca (altrimenti), in una frase. */
  label: string;
  /** Dove si fa. */
  href: string;
  /** Il verbo del link quando manca (es. "Scegli"). */
  action: string;
}

export function continuitySteps(input: ContinuityInput): ContinuityStep[] {
  const { guardianCount, legacyEnabled, emergencyCardFilled, capsulesForOthers, capsulesForDelivery } = input;
  return [
    {
      id: "guardians",
      done: guardianCount > 0,
      label:
        guardianCount > 0
          ? guardianCount === 1
            ? "Hai un guardiano che può confermare la tua assenza"
            : `Hai ${guardianCount} guardiani che possono confermare la tua assenza`
          : "Nessun guardiano: scegli chi può confermare la tua assenza",
      href: "/friends",
      action: "Scegli",
    },
    {
      id: "legacy",
      done: legacyEnabled,
      label: legacyEnabled ? "L'eredità digitale è attiva" : "L'eredità digitale è spenta: attivala",
      href: "/legacy",
      action: "Attiva",
    },
    {
      id: "emergency-card",
      done: emergencyCardFilled,
      label: emergencyCardFilled ? "La scheda d'emergenza è compilata" : "La scheda d'emergenza è vuota: compilala",
      href: "/legacy",
      action: "Compila",
    },
    {
      id: "capsules",
      done: capsulesForDelivery > 0,
      label:
        capsulesForDelivery > 0
          ? capsulesForDelivery === 1
            ? "Una capsula arriverà a chi ami anche se non ci sei"
            : `${capsulesForDelivery} capsule arriveranno a chi ami anche se non ci sei`
          : capsulesForOthers > 0
            ? "Nessuna capsula si apre prima della sua data: scegli quali"
            : "Nessuna capsula per chi ami: scrivine una",
      // Con capsule già chiuse manca solo la scelta di quali consegnare; senza, manca la capsula stessa.
      href: capsulesForOthers > 0 ? "/legacy" : "/capsules/new",
      action: capsulesForOthers > 0 ? "Scegli" : "Scrivi",
    },
  ];
}

export interface ContinuityScore {
  done: number;
  total: number;
}

export function continuityScore(steps: ContinuityStep[]): ContinuityScore {
  return { done: steps.filter((s) => s.done).length, total: steps.length };
}
