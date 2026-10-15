import type { GuardianVerificationResponse } from "@/domain/digital-legacy/guardians";

/**
 * Le parole che il guardiano legge quando gli si chiede "hai notizie di …?" (v. GuardianVerificationPanel). Ogni risposta
 * dice prima di essere data cosa provoca, e dopo cosa succederà: chi risponde deve sapere che il proprio "non riesco a
 * raggiungerla" può portare alla consegna delle capsule, e che "ho sue notizie" ferma tutto. Le frasi seguono il motore
 * (v. computeDigitalLegacyTransition): "ok" annulla tutto, "unreachable" conta verso la soglia scelta, "unknown" non sposta
 * nulla. Niente "lo/la": si usa il nome. Pura, nessuna rete.
 */

export interface GuardianAnswer {
  value: GuardianVerificationResponse;
  label: string;
  /** Cosa provoca questa risposta, scritto sotto il pulsante prima di sceglierla. */
  effect: string;
}

/** Il nome con cui rivolgersi alla persona: il primo nome, o tutto se è una sola parola. */
export function firstNameOf(ownerName: string): string {
  const trimmed = ownerName.trim();
  return trimmed.split(/\s+/)[0] || trimmed;
}

export function guardianAnswers(ownerName: string): GuardianAnswer[] {
  const name = firstNameOf(ownerName);
  return [
    {
      value: "ok",
      label: `Sì, ho notizie di ${name}`,
      effect: `Tutto si ferma subito: per ${name} non cambia nulla e nessuna capsula si apre.`,
    },
    {
      value: "unknown",
      label: "Non lo so ancora",
      effect: "La tua risposta non sposta niente. Puoi cambiarla quando ne sai di più.",
    },
    {
      value: "unreachable",
      label: `Non riesco a raggiungere ${name}`,
      effect: "Conta come conferma della sua assenza. Prima di registrarla ti chiederemo di confermare.",
    },
  ];
}

/** Cosa succede se il guardiano conferma di non riuscire a raggiungere la persona: detto prima della conferma. */
export function unreachableConsequence(ownerName: string): string {
  const name = firstNameOf(ownerName);
  return (
    `Quando abbastanza guardiani lo confermano (a volte basta uno solo), ${name} riceverà un ultimo avviso. ` +
    `Se non accede nemmeno allora, le capsule che ha preparato si apriranno per le persone a cui le ha destinate. ` +
    `Un suo accesso, in qualsiasi momento, ferma tutto.`
  );
}

/** Dopo la risposta: cosa succederà ora. */
export function afterAnswerText(response: GuardianVerificationResponse, ownerName: string): string {
  const name = firstNameOf(ownerName);
  switch (response) {
    case "ok":
      return `Grazie: la verifica su ${name} si ferma qui e tutto torna com'era. Non devi fare altro.`;
    case "unknown":
      return `Grazie. Se riesci ad avere notizie di ${name}, torna qui e cambia la risposta.`;
    case "unreachable":
      return `Grazie: hai confermato di non riuscire a raggiungere ${name}. Se ti sbagli o ricevi sue notizie, cambia la risposta: un "ho sue notizie" ferma tutto.`;
  }
}
