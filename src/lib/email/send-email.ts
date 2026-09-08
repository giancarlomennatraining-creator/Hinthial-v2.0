interface SendEmailInput {
  to: string;
  subject: string;
  html: string;
}

/**
 * Invio email via l'API REST di Resend --- una chiamata fetch diretta,
 * senza il pacchetto ufficiale: per un solo endpoint non serve una
 * dipendenza in più. Usata solo da Server Actions (mai importata in un
 * componente client, e mai marcata "use server" essa stessa: non è
 * pensata per essere chiamata direttamente dal browser) --- RESEND_API_KEY
 * non deve mai lasciare il server. Distinta dalle email automatiche di
 * Supabase Auth (conferma registrazione, reset password), che restano
 * gestite da Supabase.
 */
export async function sendEmail({ to, subject, html }: SendEmailInput): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!apiKey || !from) {
    throw new Error("Configurazione email mancante (RESEND_API_KEY/EMAIL_FROM).");
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from, to, subject, html }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`Impossibile inviare l'email (${response.status}): ${body}`);
  }
}
