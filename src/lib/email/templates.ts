/**
 * Corpo HTML delle email inviate da Hinthial stesso (v. send-email.ts) ---
 * un solo shell condiviso, testo semplice pensato per restare leggibile
 * anche nei client che tolgono gli stili: niente immagini/loghi (spesso
 * bloccati di default), solo testo e due link.
 */
function emailShell(bodyHtml: string): string {
  return `<!doctype html>
<html>
  <body style="margin:0; padding:24px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color:#18181b; line-height:1.6;">
    ${bodyHtml}
    <p style="margin-top:32px; font-size:12px; color:#71717a;">Hinthial --- il tuo sistema operativo per la vita digitale.</p>
  </body>
</html>`;
}

function primaryButton(href: string, label: string): string {
  return `<p><a href="${href}" style="display:inline-block; background:#0361d0; color:#ffffff; padding:10px 18px; border-radius:6px; text-decoration:none; font-weight:600;">${label}</a></p>`;
}

function appUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
}

function formattedToday(): string {
  return new Date().toLocaleDateString("it-IT", { day: "numeric", month: "long", year: "numeric" });
}

/**
 * Invito a registrarsi, inviato da chi aggiunge un amico e spunta
 * "Invita su Hinthial" (v. domain/friends). Il nome dell'amico non
 * compare mai qui --- è cifrato, l'email si rivolge genericamente a chi
 * la riceve.
 */
export function friendInviteEmail(inviterName: string): { subject: string; html: string } {
  const homepageUrl = appUrl();
  const registerUrl = `${homepageUrl}/register`;

  return {
    subject: `${inviterName} ti ha invitato su Hinthial`,
    html: emailShell(`
      <p><strong>${inviterName}</strong> in data ${formattedToday()} ti ha invitato a registrarti nell'applicazione <a href="${homepageUrl}">Hinthial</a>.</p>
      <p>Hinthial è un posto sicuro e cifrato per documenti, amici e messaggi da lasciare a chi vuoi tu.</p>
      ${primaryButton(registerUrl, "Crea il tuo account")}
      <p style="font-size:12px; color:#71717a;">Se non ti aspettavi questo invito, puoi ignorare questa email.</p>
    `),
  };
}

/**
 * Avviso di una capsula condivisa con l'account che la riceve (v.
 * lib/capsules/actions.ts, notifyCapsuleShared) --- niente su titolo o
 * contenuto della capsula, mai passati qui: sono cifrati, questo
 * server non li vede mai.
 */
export function capsuleSharedEmail(ownerName: string): { subject: string; html: string } {
  const dashboardUrl = `${appUrl()}/dashboard`;

  return {
    subject: `${ownerName} ha condiviso una capsula con te su Hinthial`,
    html: emailShell(`
      <p><strong>${ownerName}</strong> ha condiviso con te una capsula su Hinthial in data ${formattedToday()}.</p>
      <p>La trovi nella scheda "Condivise con me" di Capsule, da dove puoi seguirne il conto alla rovescia e aprirla appena arriva la data prevista.</p>
      ${primaryButton(dashboardUrl, "Vai a Hinthial")}
    `),
  };
}

/**
 * Fasi 1-3 di "Eredità digitale" (v. domain/digital-legacy/automation.ts)
 * --- il solo accesso a Hinthial, non serve altro, annulla questo avviso
 * (v. computeDigitalLegacyTransition, azione "reset"). Mai un tono
 * allarmante qui: è ancora solo un promemoria tra i tanti previsti,
 * niente ancora di irreversibile.
 */
export function digitalLegacyReminderEmail(
  reminderNumber: number,
  totalReminders: number,
): { subject: string; html: string } {
  const dashboardUrl = `${appUrl()}/dashboard`;

  return {
    subject: "Tutto bene? Non ti vediamo su Hinthial da un po'",
    html: emailShell(`
      <p>Non accedi a Hinthial da un po' di tempo --- ci teniamo a sapere che stai bene.</p>
      <p>Se va tutto bene, basta accedere di nuovo: non serve fare altro, il solo accesso annulla questo avviso.</p>
      <p>Questo è il promemoria ${reminderNumber} di ${totalReminders} previsti dalla tua strategia di "Eredità digitale", prima di passare a un periodo di verifica più formale.</p>
      ${primaryButton(dashboardUrl, "Accedi a Hinthial")}
      <p style="font-size:12px; color:#71717a;">Puoi modificare o disattivare questa strategia in qualsiasi momento da Impostazioni &gt; Eredità digitale.</p>
    `),
  };
}

/**
 * Inviata una sola volta, al passaggio da "reminding" a "grace_period"
 * (v. computeDigitalLegacyTransition) --- il tono si fa più concreto,
 * ma resta tutto reversibile con un solo accesso: i guardiani non sono
 * ancora coinvolti (arriverà con una fase futura, non costruita).
 */
export function digitalLegacyGracePeriodEmail(gracePeriodDays: number): { subject: string; html: string } {
  const dashboardUrl = `${appUrl()}/dashboard`;

  return {
    subject: "Un passo più concreto: periodo di grazia iniziato su Hinthial",
    html: emailShell(`
      <p>Non siamo ancora riusciti a raggiungerti, dopo diversi promemoria: da oggi inizia un periodo di grazia di ${gracePeriodDays} giorni, previsto dalla tua strategia di "Eredità digitale".</p>
      <p>Se accedi anche una sola volta entro questo periodo, tutto si annulla automaticamente --- nessun'altra azione richiesta.</p>
      <p>Se questo periodo terminasse senza tue notizie, il passo successivo coinvolgerebbe i tuoi guardiani, chiedendo loro di confermare che tu stia bene.</p>
      ${primaryButton(dashboardUrl, "Accedi a Hinthial")}
      <p style="font-size:12px; color:#71717a;">Puoi modificare o disattivare questa strategia in qualsiasi momento da Impostazioni &gt; Eredità digitale.</p>
    `),
  };
}

/**
 * Inviata a UN guardiano collegato quando il proprietario entra in
 * "awaiting_guardians" (v. automation.ts) --- mai a un guardiano non
 * collegato: il server non conoscerebbe nemmeno il suo indirizzo (v.
 * FriendsPanel.tsx, badge "non collegato"). Il link porta a una pagina
 * dentro l'app (v. app/(app)/guardian-check/[requestId]), non a
 * un'azione compiuta direttamente dall'email: chi risponde deve essere
 * autenticato con il PROPRIO account, non un click anonimo.
 */
export function digitalLegacyGuardianRequestEmail(
  ownerName: string,
  respondUrl: string,
): { subject: string; html: string } {
  return {
    subject: `${ownerName} ti ha indicato come guardiano su Hinthial --- riesci a raggiungerlo/la?`,
    html: emailShell(`
      <p><strong>${ownerName}</strong> ti ha indicato come guardiano su Hinthial --- una persona di fiducia da contattare se non risponde più da un po' di tempo.</p>
      <p>Non riusciamo a raggiungerlo/la da diverse settimane, nonostante diversi promemoria. Puoi dirci se hai sue notizie?</p>
      ${primaryButton(respondUrl, "Rispondi")}
      <p style="font-size:12px; color:#71717a;">Dovrai accedere al tuo account Hinthial per rispondere --- la tua risposta conta solo se arriva da lì, mai da un semplice click su questa email.</p>
    `),
  };
}

/**
 * Inviata al proprietario quando i suoi guardiani confermano di non
 * riuscire a raggiungerlo (v. isGuardianQuorumSatisfied) --- un'ultima
 * rete di sicurezza, anche se l'account potrebbe non poterla leggere.
 * Segue una verifica formale, poi un'attesa finale (v.
 * digitalLegacyFinalWaitEmail): un solo accesso, in qualunque momento
 * prima che l'attesa finale scada, annulla comunque tutto.
 */
export function digitalLegacyGuardiansConfirmedEmail(): { subject: string; html: string } {
  const dashboardUrl = `${appUrl()}/dashboard`;

  return {
    subject: "I tuoi guardiani non riescono a raggiungerti su Hinthial",
    html: emailShell(`
      <p>I guardiani che hai indicato per "Eredità digitale" hanno confermato di non riuscire più a raggiungerti.</p>
      <p>Se stai bene, accedi subito a Hinthial: basta un accesso per annullare tutto.</p>
      ${primaryButton(dashboardUrl, "Accedi a Hinthial")}
    `),
  };
}

/**
 * L'ultima email al proprietario prima dell'apertura vera e propria
 * delle capsule --- inviata all'inizio dell'attesa finale (v.
 * computeDigitalLegacyTransition, "start_final_wait"), l'unico avviso
 * che dice esplicitamente cosa sta per succedere e quando.
 */
export function digitalLegacyFinalWaitEmail(finalWaitDays: number): { subject: string; html: string } {
  const dashboardUrl = `${appUrl()}/dashboard`;

  return {
    subject: "Ultimo avviso: le tue capsule su Hinthial stanno per aprirsi",
    html: emailShell(`
      <p>Questo è l'ultimo avviso prima che le tue capsule già condivise diventino leggibili ai loro destinatari, a prescindere dalla data di apertura che avevi scelto.</p>
      <p>Hai ancora ${finalWaitDays} giorni: se accedi anche una sola volta entro questo periodo, tutto si annulla e nessuna capsula si apre in anticipo.</p>
      ${primaryButton(dashboardUrl, "Accedi a Hinthial")}
    `),
  };
}

/**
 * Inviata a ogni destinatario di una capsula già condivisa, quando
 * "Eredità digitale" fa scattare l'apertura (v. domain/digital-legacy/
 * automation.ts, releaseCapsulesToRecipients) --- mai il titolo o il
 * contenuto della capsula, ancora cifrati e mai visti da questo
 * server: solo l'avviso che è arrivato il momento di aprirla.
 */
export function digitalLegacyCapsuleReleasedEmail(ownerName: string): { subject: string; html: string } {
  const dashboardUrl = `${appUrl()}/dashboard`;

  return {
    subject: `Una capsula di ${ownerName} è ora disponibile su Hinthial`,
    html: emailShell(`
      <p>Una capsula che <strong>${ownerName}</strong> aveva condiviso con te è ora disponibile --- non siamo riusciti a raggiungerlo/la per un periodo prolungato, e i guardiani che aveva indicato hanno confermato la stessa cosa.</p>
      <p>La trovi nella scheda "Condivise con me" di Capsule.</p>
      ${primaryButton(dashboardUrl, "Vai a Hinthial")}
    `),
  };
}

/** Conferma dopo la cancellazione definitiva dell'account (v. domain/danger-zone). */
export function accountDeletedEmail(): { subject: string; html: string } {
  return {
    subject: "Il tuo account Hinthial è stato cancellato",
    html: emailShell(`
      <p>Il tuo account Hinthial e tutti i dati ad esso collegati (documenti, asset, amici, capsule, promemoria) sono stati cancellati definitivamente in data ${formattedToday()}.</p>
      <p>Se non sei stato tu, o hai cambiato idea, contattaci il prima possibile: questa operazione non può essere annullata.</p>
    `),
  };
}

/** Conferma dopo aver svuotato il vault mantenendo l'account attivo (v. domain/danger-zone). */
export function accountResetEmail(): { subject: string; html: string } {
  return {
    subject: "Il tuo account Hinthial è stato reimpostato",
    html: emailShell(`
      <p>In data ${formattedToday()} il tuo vault Hinthial (documenti, asset, amici, capsule) è stato svuotato completamente, come richiesto da Impostazioni > Zona pericolosa.</p>
      <p>Il tuo account resta attivo: puoi continuare a usarlo normalmente, ripartendo da zero.</p>
      <p>Se non sei stato tu, cambia subito la password del tuo account.</p>
    `),
  };
}

/**
 * Richiesta di amicizia (v. domain/friends/friend-requests.ts) --- inviata
 * a un utente Hinthial già esistente, trovato per email. Il link porta
 * alla scheda Amici, dove la richiesta è già in attesa: chi risponde deve
 * essere autenticato con il proprio account, mai un click anonimo.
 */
export function friendRequestEmail(senderName: string): { subject: string; html: string } {
  const friendsUrl = `${appUrl()}/friends`;

  return {
    subject: `${senderName} ti ha chiesto l'amicizia su Hinthial`,
    html: emailShell(`
      <p><strong>${senderName}</strong> ti ha chiesto di diventare amico su Hinthial.</p>
      <p>Puoi accettare o rifiutare la richiesta dalla scheda Amici --- se accetti, comparirete entrambi nella rispettiva lista amici.</p>
      ${primaryButton(friendsUrl, "Vai ad Amici")}
      <p style="font-size:12px; color:#71717a;">Se non ti aspettavi questa richiesta, puoi semplicemente ignorarla.</p>
    `),
  };
}

/**
 * Richiesta di diventare guardiano (v. domain/friends/guardian-requests.ts)
 * --- distinta dalla verifica di "Eredità digitale" già in corso
 * (digitalLegacyGuardianRequestEmail): questa è il consenso preliminare
 * per DIVENTARE guardiano di un amico, non ancora la verifica reale di
 * un'inattività. Il link porta alla scheda "Protetti", dove la richiesta
 * è già in attesa.
 */
export function guardianRoleRequestEmail(ownerName: string): { subject: string; html: string } {
  const protectedUrl = `${appUrl()}/friends/protected`;

  return {
    subject: `${ownerName} ti ha chiesto di diventare suo guardiano su Hinthial`,
    html: emailShell(`
      <p><strong>${ownerName}</strong> ti ha chiesto di diventare il suo guardiano su Hinthial --- una persona di fiducia da contattare se un giorno non dovesse più poter accedere al proprio account.</p>
      <p>Non è richiesto nulla ora: solo se in futuro non dovesse più accedere per molto tempo, ti verrà chiesto di confermare se hai sue notizie.</p>
      ${primaryButton(protectedUrl, "Vai a Protetti")}
      <p style="font-size:12px; color:#71717a;">Puoi accettare, rifiutare, o smettere di essere guardiano in qualunque momento.</p>
    `),
  };
}
