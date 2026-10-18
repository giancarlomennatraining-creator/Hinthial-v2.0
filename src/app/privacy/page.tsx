import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage, LegalSection, LegalValue } from "@/components/legal/LegalPage";
import { LEGAL } from "@/content/legal";

export const metadata: Metadata = {
  title: "Informativa privacy · HINTHIAL",
  description: "Quali dati tratta Hinthial, perché, con chi e per quanto: e quali non può vedere.",
};

/**
 * L'informativa ai sensi degli artt. 13-14 del GDPR. Descrive quello che il codice fa davvero (v. Impostazioni > Privacy,
 * che mostra gli stessi dati dell'account in tempo reale): se cambia cosa vede il server, va aggiornata qui e `LEGAL.version`.
 */
export default function PrivacyPage() {
  return (
    <LegalPage
      title="Informativa privacy"
      intro={
        <p>
          Hinthial cifra i tuoi contenuti sul tuo dispositivo, prima che arrivino a noi: noi conserviamo dati che non possiamo
          leggere. Qui trovi cosa invece vediamo, perché ci serve, con chi lo condividiamo e quali sono i tuoi diritti.
        </p>
      }
    >
      <LegalSection title="1. Chi è il titolare">
        <p>
          Il titolare del trattamento è <LegalValue value={LEGAL.controllerName} />, <LegalValue value={LEGAL.controllerAddress} />.
          Per qualsiasi domanda o richiesta sui tuoi dati scrivi a <LegalValue value={LEGAL.contactEmail} />.
        </p>
      </LegalSection>

      <LegalSection title="2. Cosa non possiamo vedere">
        <p>
          Il contenuto di ciò che ci affidi è cifrato con una chiave che nasce dalla tua master password, e la master password
          non lascia mai il tuo dispositivo. Per questo non possiamo leggere, né consegnare a nessuno:
        </p>
        <ul className="list-disc pl-5">
          <li>i tuoi documenti, foto, audio e video, e il loro nome;</li>
          <li>il testo delle note, dei racconti e delle capsule, e il loro titolo;</li>
          <li>il nome e i dati delle persone che aggiungi tra gli Amici;</li>
          <li>il titolo delle scadenze, i nomi dei beni e dei fascicoli, i campi delle schede.</li>
        </ul>
        <p>
          Se perdi la master password e la recovery key, nemmeno noi possiamo recuperare questi contenuti.
        </p>
      </LegalSection>

      <LegalSection title="3. Cosa vediamo, e perché">
        <ul className="list-disc pl-5">
          <li>
            <strong>Dati dell&apos;account</strong>: email, nome e cognome, data di nascita se la indichi, foto del profilo se la
            carichi. Servono a farti accedere e a riconoscerti presso le persone con cui condividi qualcosa. Base giuridica:
            esecuzione del contratto (art. 6.1.b GDPR).
          </li>
          <li>
            <strong>Dati che il servizio deve leggere per funzionare</strong>: date (scadenze, apertura delle capsule, ultimo
            accesso), stato delle capsule, collegamenti tra contenuti, categorie, dimensioni e tipo dei file, impostazioni
            dell&apos;Eredità digitale e chi sono i tuoi guardiani. Senza, non potremmo ricordarti una scadenza né consegnare
            una capsula al momento giusto. Base giuridica: esecuzione del contratto.
          </li>
          <li>
            <strong>Dati di sicurezza</strong>: indirizzo IP e browser di ogni accesso, tentativi falliti, eventi importanti
            dell&apos;account. Li vedi anche tu in Impostazioni &gt; Accesso e sicurezza &gt; Registro delle attività. Servono a proteggere l&apos;account e a
            ricostruire cosa è successo in caso di abuso. Base giuridica: legittimo interesse alla sicurezza (art. 6.1.f).
          </li>
          <li>
            <strong>Hinthia, solo se la attivi</strong>: quando chiedi a Hinthia di leggere un documento o di aiutarti in un
            racconto, il testo che scegli viene decifrato sul tuo dispositivo e inviato, attraverso il nostro server, ad
            Anthropic, che fornisce il modello. Non lo conserviamo dopo la risposta. Base giuridica: il tuo consenso (art.
            6.1.a e, se il testo contiene dati sanitari o di altre categorie particolari, art. 9.2.a), che puoi ritirare in
            qualsiasi momento da Impostazioni &gt; Hinthia.
          </li>
        </ul>
        <p>
          Non usiamo i tuoi dati per pubblicità, non li vendiamo e non profiliamo nessuno.
        </p>
      </LegalSection>

      <LegalSection title="4. Le persone che coinvolgi">
        <p>
          Quando scegli un guardiano o condividi una capsula, quella persona ha un proprio account Hinthial. Le scriviamo
          solo quando serve: per dirle che hai condiviso qualcosa con lei o, se l&apos;Eredità digitale è attiva e non accedi
          da molto tempo, per chiederle se ha tue notizie. Il guardiano non vede mai i tuoi contenuti. Una capsula si apre
          solo per le persone a cui l&apos;hai destinata, alla data scelta o quando l&apos;Eredità digitale lo prevede.
        </p>
      </LegalSection>

      <LegalSection title="5. Con chi condividiamo i dati">
        <p>Ci appoggiamo a fornitori che trattano i dati per nostro conto, come responsabili del trattamento:</p>
        <ul className="list-disc pl-5">
          <li>
            <strong>Supabase</strong>: database, archivio dei file cifrati e autenticazione;
          </li>
          <li>
            <strong>Vercel</strong>: ospita l&apos;applicazione;
          </li>
          <li>
            <strong>Resend</strong>: invia le email del servizio;
          </li>
          <li>
            <strong>Anthropic</strong>: solo se attivi Hinthia, riceve il testo che scegli di farle leggere.
          </li>
        </ul>
        <p>
          Alcuni di questi fornitori hanno sede o server fuori dall&apos;Unione europea. In quel caso il trasferimento avviene
          con le garanzie previste dal GDPR, come le clausole contrattuali standard della Commissione europea o il Data Privacy
          Framework.
        </p>
      </LegalSection>

      <LegalSection title="6. Per quanto tempo">
        <ul className="list-disc pl-5">
          <li>Account e contenuti: finché l&apos;account esiste. Cancellando l&apos;account cancelli tutto, subito.</li>
          <li>
            Contenuti nel Cestino: per il periodo che scegli (15 giorni se non lo cambi), poi vengono eliminati in modo
            definitivo.
          </li>
          <li>Dati di sicurezza degli accessi: per la durata dell&apos;account.</li>
        </ul>
      </LegalSection>

      <LegalSection title="7. I tuoi diritti">
        <p>Puoi in ogni momento:</p>
        <ul className="list-disc pl-5">
          <li>vedere quali dati abbiamo su di te: Impostazioni &gt; Privacy li mostra in tempo reale;</li>
          <li>correggerli, da Impostazioni &gt; Informazioni utente;</li>
          <li>portarli via, da Impostazioni &gt; Importa/Esporta;</li>
          <li>cancellare tutto, da Impostazioni &gt; Zona pericolosa;</li>
          <li>opporti a un trattamento o limitarlo, e ritirare il consenso a Hinthia.</li>
        </ul>
        <p>
          Per tutto il resto scrivi a <LegalValue value={LEGAL.contactEmail} />. Se ritieni che i tuoi dati siano trattati in
          modo non corretto puoi rivolgerti al Garante per la protezione dei dati personali (garanteprivacy.it).
        </p>
      </LegalSection>

      <LegalSection title="8. Cookie">
        <p>
          Usiamo solo i cookie tecnici che tengono aperta la tua sessione, e la memoria del browser per preferenze come il
          tema chiaro o scuro. Niente cookie di profilazione, di statistica o di terze parti: per questo non ti chiediamo il
          consenso con un banner.
        </p>
      </LegalSection>

      <LegalSection title="9. Modifiche">
        <p>
          Se questa informativa cambia in modo sostanziale te lo diremo nell&apos;app o per email prima che le modifiche si
          applichino. Trovi anche i <Link href="/termini" className="font-medium text-accent hover:underline">termini d&apos;uso</Link>.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
