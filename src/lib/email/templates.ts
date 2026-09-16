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
