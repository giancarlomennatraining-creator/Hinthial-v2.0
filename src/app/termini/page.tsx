import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage, LegalSection, LegalValue } from "@/components/legal/LegalPage";
import { LEGAL } from "@/content/legal";

export const metadata: Metadata = {
  title: "Termini d'uso · HINTHIAL",
  description: "Le regole per usare Hinthial: cosa facciamo noi, cosa resta a te, e cosa Hinthial non è.",
};

/**
 * I termini d'uso. Le parti che contano di più per chi usa Hinthial sono la 3 (la master password è solo sua) e la 4
 * (l'Eredità digitale non è un testamento): scritte per prime e in modo diretto, non in fondo.
 */
export default function TerminiPage() {
  return (
    <LegalPage
      title="Termini d'uso"
      intro={
        <p>
          Questi termini regolano l&apos;uso di Hinthial. Creando un account li accetti, insieme all&apos;
          <Link href="/privacy" className="font-medium text-brand hover:underline">informativa privacy</Link>. Il servizio è
          fornito da <LegalValue value={LEGAL.controllerName} />.
        </p>
      }
    >
      <LegalSection title="1. Cos'è Hinthial">
        <p>
          Hinthial custodisce ciò che sai e ciò che hai (documenti, ricordi, istruzioni, lettere) cifrato sul tuo
          dispositivo, e ti aiuta a farlo arrivare alle persone che scegli: a una data, oppure, se attivi l&apos;Eredità
          digitale, quando non puoi più farlo tu.
        </p>
      </LegalSection>

      <LegalSection title="2. Il tuo account">
        <ul className="list-disc pl-5">
          <li>Per creare un account devi avere almeno 18 anni e indicare dati veri.</li>
          <li>L&apos;account è personale: non condividere la password con nessuno.</li>
          <li>Sei responsabile di ciò che carichi e di avere il diritto di conservarlo e condividerlo.</li>
        </ul>
      </LegalSection>

      <LegalSection title="3. La master password è solo tua">
        <p>
          I tuoi contenuti si cifrano con una chiave che nasce dalla master password, sul tuo dispositivo. Noi non la
          conosciamo e non la conserviamo. Se perdi sia la master password sia la recovery key,{" "}
          <strong>i tuoi contenuti non si possono più recuperare</strong>, né da te né da noi. Conservare la recovery key in un
          posto sicuro è compito tuo.
        </p>
      </LegalSection>

      <LegalSection title="4. L'Eredità digitale non è un testamento">
        <ul className="list-disc pl-5">
          <li>
            L&apos;Eredità digitale apre le capsule che hai scelto quando, dopo un lungo silenzio, i promemoria e i tuoi guardiani
            confermano che non sei più raggiungibile. È uno strumento per far arrivare parole e informazioni, non un atto con
            valore legale: non sostituisce un testamento né le disposizioni previste dalla legge per i tuoi beni.
          </li>
          <li>
            Il meccanismo dipende da fattori che non controlliamo del tutto: che le email arrivino, che i guardiani rispondano
            con sincerità, che tu tenga aggiornate le impostazioni. Facciamo il possibile perché funzioni come descritto, ma non
            possiamo garantire che una capsula si apra, o non si apra, in ogni circostanza.
          </li>
          <li>
            Un tuo accesso, in qualsiasi momento prima della consegna, ferma tutto. Una capsula già consegnata non si può
            ritirare.
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="5. Hinthia">
        <p>
          Hinthia, l&apos;assistente basato su un modello di intelligenza artificiale, è facoltativa e si attiva solo con il
          tuo consenso. Quello che propone (una scadenza, una categoria, una domanda) può essere sbagliato: decidi sempre tu
          cosa accettare. Non usarla per decisioni mediche, legali o finanziarie.
        </p>
      </LegalSection>

      <LegalSection title="6. Cosa non si può fare">
        <ul className="list-disc pl-5">
          <li>usare Hinthial per contenuti illegali o per molestare, ingannare o minacciare qualcuno;</li>
          <li>caricare contenuti su cui non hai diritti;</li>
          <li>tentare di accedere ad account o dati altrui, o di mettere in difficoltà il servizio.</li>
        </ul>
        <p>
          Non possiamo vedere i tuoi contenuti cifrati, ma se riceviamo una segnalazione fondata possiamo sospendere o chiudere
          un account che viola questi termini.
        </p>
      </LegalSection>

      <LegalSection title="7. Il servizio">
        <p>
          Lavoriamo perché Hinthial sia sempre disponibile e i tuoi dati al sicuro, ma possono esserci interruzioni, per
          manutenzione o per cause che non dipendono da noi. Ti consigliamo di tenere una copia di ciò che conta, che puoi
          scaricare in ogni momento da Impostazioni &gt; Importa/Esporta. Nei limiti consentiti dalla legge, non rispondiamo di
          danni indiretti o della perdita di contenuti dovuta alla perdita della master password e della recovery key.
        </p>
      </LegalSection>

      <LegalSection title="8. Chiudere l'account">
        <p>
          Puoi cancellare l&apos;account quando vuoi, da Impostazioni &gt; Zona pericolosa: con l&apos;account si cancellano
          tutti i tuoi contenuti, in modo definitivo.
        </p>
      </LegalSection>

      <LegalSection title="9. Modifiche e legge applicabile">
        <p>
          Se cambiamo questi termini in modo sostanziale te lo diremo prima che si applichino. Se non li accetti, puoi chiudere
          l&apos;account. I termini sono regolati dalla legge italiana; resta salvo ogni diritto che ti riconosce la legge del
          tuo Paese come consumatore. Per qualsiasi domanda: <LegalValue value={LEGAL.contactEmail} />.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
