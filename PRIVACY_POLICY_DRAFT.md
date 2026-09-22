# Informativa sulla privacy --- BOZZA (FASE 15)

> **Questo documento è una bozza di lavoro, non un testo legale pronto per la pubblicazione.** È stato scritto per organizzare i fatti reali del prodotto (chi tratta cosa, cosa vede, cosa non vede mai) in un testo che segua la struttura richiesta dal GDPR (art. 13) --- ma **va fatto rivedere da chi si occupa della parte legale prima di pubblicarlo**. I punti dove manca un'informazione che solo tu/il team puoi fornire sono segnati con `[DA COMPLETARE]` o in un riquadro "Nota per chi revisiona". Non è consulenza legale.
>
> Verificato leggendo il codice reale del progetto (non assunto): quali colonne sono cifrate, quali no, quali fornitori sono davvero integrati, cosa riceve ciascuno --- v. le note tecniche in corsivo sotto ogni sezione, che non entrerebbero nel testo pubblicato ma servono a chi revisiona per controllare che il testo sia accurato.

---

## 1. Titolare del trattamento

`[DA COMPLETARE]` --- ragione sociale, sede legale, indirizzo email di contatto (e, se nominato, il Responsabile della Protezione dei Dati).

---

## 2. Perché questa informativa è diversa dal solito

Hinthial è costruito secondo un principio di **cifratura end-to-end a conoscenza zero**: i tuoi documenti, beni, promemoria, amici e capsule vengono cifrati sul tuo dispositivo con una chiave (la tua "Master Password") che **non lasciamo mai il tuo dispositivo e non conosciamo**. Questo significa che per la maggior parte dei tuoi contenuti, anche se lo volessimo, non potremmo leggerli --- non è una promessa contrattuale, è un limite tecnico che vale anche per noi.

Questa informativa distingue quindi, sezione per sezione, tra:
- dati che **non vediamo mai** (il contenuto del tuo archivio);
- dati che vediamo perché servono al funzionamento del servizio (es. la categoria di un documento, per organizzarlo);
- dati che vediamo solo se **tu scegli esplicitamente** di condividerli con noi (es. una domanda posta al nostro assistente basato su intelligenza artificiale).

---

## 3. Quali dati trattiamo

### 3.1 Dati del tuo account
Email, nome, e --- se li inserisci --- data di nascita e una foto profilo. Necessari per creare e gestire il tuo account.

### 3.2 Il contenuto del tuo archivio (cifrato, non leggibile da noi)
Nomi di file, note, tag, trascrizioni, testo estratto dai documenti, il contenuto dei tuoi beni, dei tuoi promemoria, dei tuoi amici e delle tue capsule --- tutto cifrato sul tuo dispositivo prima di essere salvato. Non abbiamo la chiave per leggerlo.

*Nota tecnica per chi revisiona: verificato su `domain/documents/repository.ts` --- `encrypted_filename`, note, tag, trascrizione e testo estratto sono tutti cifrati lato client prima del salvataggio (envelope AES-GCM sotto la Master Key). Lo stesso vale per beni, amici, capsule (v. rispettivi `domain/*/repository.ts`).*

### 3.3 Metadati necessari al funzionamento, non cifrati
Per poter organizzare e mostrarti il tuo archivio, alcuni collegamenti tra i tuoi contenuti restano in chiaro sui nostri sistemi: a quale categoria appartiene un documento, la sua eventuale data di scadenza, a quale bene è collegato, quando è stato creato o modificato. Questi dati **non rivelano il contenuto** dei tuoi documenti, ma rivelano una loro struttura (es. "hai un documento nella categoria Assicurazioni con scadenza il 15 ottobre").

*Nota tecnica per chi revisiona: `category_id`, `related_asset_id`, `expires_at`, i timestamp di creazione/modifica --- non cifrati, verificato sullo stesso file. Questa sezione esiste apposta per non lasciare un vuoto tra "tutto cifrato" (falso) e "niente è protetto" (falso anche questo).*

### 3.4 Dati tecnici e di sicurezza
Indirizzo IP, tipo di dispositivo/browser, orari di accesso, eventi di sicurezza (accessi riusciti o falliti, modifiche a impostazioni sensibili) --- registrati nel tuo registro Attività, consultabile da te in ogni momento.

### 3.5 Dati condivisi con il nostro assistente basato su intelligenza artificiale --- solo con il tuo consenso esplicito
Se attivi la funzione (revocabile in qualsiasi momento da Impostazioni), la domanda che scrivi e un numero minimo di elementi del tuo archivio --- individuati da un meccanismo che gira interamente sul tuo dispositivo, prima che qualunque dato parta --- vengono inviati al fornitore che elabora la risposta (v. sezione 5). Mai l'intero archivio, mai il contenuto completo di un documento (oggi): solo nome, categoria e poche informazioni minime sull'elemento pertinente.

*Nota tecnica per chi revisiona: v. `domain/ai/claude-provider.ts` (`projectSource()`) e `app/api/ai/chat/route.ts`. Ogni domanda è elaborata isolatamente: il fornitore non riceve la cronologia delle domande precedenti.*

---

## 4. Perché trattiamo questi dati (finalità e base giuridica)

| Finalità | Base giuridica |
|---|---|
| Fornire il servizio (creare e gestire il tuo archivio) | Esecuzione del contratto con te |
| Sicurezza dell'account e prevenzione di accessi non autorizzati | Legittimo interesse |
| Risposte generate dal nostro assistente IA | Consenso esplicito, revocabile in ogni momento |
| Eredità digitale (trasmissione di capsule a destinatari designati in caso di inattività prolungata) | Esecuzione di un'istruzione che ci hai dato tu stesso, con conferma di guardiani da te scelti |

---

## 5. Con chi condividiamo i dati (fornitori che trattano dati per nostro conto)

Nessuno di questi fornitori può usare i tuoi dati per fini propri: li trattano solo per fornire il servizio a noi, secondo nostre istruzioni.

### Supabase
**Cosa riceve:** email e credenziali di accesso; i metadati non cifrati descritti al punto 3.3; il contenuto del tuo archivio, ma sempre e solo in forma cifrata (non è nella condizione tecnica di leggerlo).
**Perché:** hosting dell'applicazione, autenticazione, database, conservazione dei file.
**Dove:** `[DA COMPLETARE --- verificare la regione dei server Supabase in uso e se serve una Standard Contractual Clause]`.

### Resend
**Cosa riceve:** indirizzo email del destinatario, nome, contenuto del messaggio (es. un invito ad aggiungere un amico, la conferma di cancellazione account). Non riceve mai contenuto del tuo archivio.
**Perché:** invio delle email che il servizio genera automaticamente (diverse dalle email di autenticazione, gestite direttamente da Supabase).

### Anthropic
**Cosa riceve:** solo se hai attivato il consenso specifico --- la tua domanda e i pochi elementi minimi descritti al punto 3.5.
**Perché:** generare una risposta reale alle tue domande sui tuoi dati.
**Dove:** Stati Uniti. `[DA COMPLETARE --- verificare le clausole contrattuali standard (SCC) nei termini commerciali Anthropic attualmente in vigore e se serve un Data Processing Addendum firmato separatamente]`.

### Vercel
**Cosa riceve:** traffico applicativo (cifrato in transito), log tecnici standard di hosting.
**Perché:** hosting ed erogazione dell'applicazione.

---

## 6. Trasferimento dei dati fuori dall'Unione Europea

`[DA COMPLETARE]` --- Anthropic e (a seconda della regione scelta) Supabase e Vercel possono trattare dati negli Stati Uniti. Va indicato qui su quali garanzie ci si basa (tipicamente le Clausole Contrattuali Standard della Commissione Europea) --- da verificare nei rispettivi termini commerciali attualmente in vigore, non assunto in questa bozza.

---

## 7. Per quanto tempo conserviamo i dati

`[DA COMPLETARE]` --- tipicamente: per tutta la durata dell'account, più un periodo definito dopo la cancellazione per gli obblighi di legge (es. fatturazione) o per permettere un recupero in caso di cancellazione accidentale. Va deciso un numero preciso, non lasciato vago.

---

## 8. Come proteggiamo i tuoi dati

Il tuo archivio è protetto da una **Master Password** che sceglie solo tu: da essa deriviamo una chiave di cifratura che non lasciamo mai il tuo dispositivo e non salviamo da nessuna parte, nemmeno cifrata. Se la perdi e non hai salvato la tua recovery key, **non possiamo recuperare il tuo archivio per te** --- è il prezzo di una promessa che vogliamo poter mantenere davvero: nemmeno noi possiamo leggerlo.

---

## 9. Il consenso all'intelligenza artificiale, nel dettaglio

Il consenso funziona su più livelli, tutti gestibili da Impostazioni → Intelligenza artificiale, e tutti revocabili in qualsiasi momento con effetto immediato:

- Un **interruttore generale**: se spento, nessuna funzione IA reale può contattare un fornitore esterno --- tutto resta elaborato sul tuo dispositivo.
- **Interruttori specifici per funzione** (oggi: risposte della chat; in futuro, quando saranno disponibili: lettura più approfondita dei contenuti, trascrizione audio/video, avvisi generati automaticamente) --- ciascuno indipendente, nessuno si accende da solo quando accendi quello generale.
- Un consenso ulteriore, distinto, per includere la categoria **Salute** in un'eventuale lettura più approfondita dei contenuti --- v. sezione 10.

*Nota tecnica per chi revisiona: le funzioni "lettura più approfondita", "trascrizione" e "avvisi automatici" non sono ancora costruite --- l'interruttore esiste già (permette di impostare la preferenza in anticipo) ma oggi non ha alcun effetto reale. Il testo qui sopra è scritto per restare vero sia oggi sia quando quelle funzioni arriveranno, senza dover essere riscritto da capo.*

---

## 10. Dati relativi alla salute

Oggi i contenuti che archivi nella categoria Salute sono trattati come ogni altro contenuto: cifrati, mai letti da noi.

**Decisione presa**: quando la lettura più approfondita dei contenuti (sezione 9) sarà disponibile, **i contenuti della categoria Salute ne restano esclusi in ogni caso, indipendentemente da qualunque consenso specifico attivato**. Non è un'eccezione che l'utente può togliere spuntando una casella: date, scadenze e richiami sanitari continueranno a essere individuati come oggi, con la sola lettura locale sul dispositivo --- mai inviati a un fornitore esterno.

Questa scelta è deliberatamente più cauta di quanto il solo consenso richiederebbe: è coerente con come Hinthial tratta altri dati particolarmente delicati altrove nel prodotto (guardiani, eredità digitale), dove si preferisce un limite fisso a un consenso che potrebbe essere dato senza aver pesato davvero la conseguenza. Il costo, dichiarato apertamente: nessuna estrazione automatica di scadenze di vaccini o promemoria di farmaci dal testo di un referto --- quella parte resta manuale.

*Nota tecnica per chi revisiona: questa è una decisione di prodotto, non una conclusione legale --- va comunque confermata da chi si occupa della parte legale prima della pubblicazione, ma non richiede ulteriori informazioni per essere scritta (a differenza delle altre voci `[DA COMPLETARE]` di questo documento).*

---

## 11. I tuoi diritti

Hai diritto di accedere ai tuoi dati, farli correggere, farli cancellare, ottenerne una copia in formato portabile, opporti al trattamento, revocare in ogni momento il consenso già dato, e presentare un reclamo all'Autorità di controllo competente (in Italia, il Garante per la protezione dei dati personali). `[DA COMPLETARE --- indicare come esercitare concretamente ciascun diritto: quali già disponibili in-app (es. esportazione, cancellazione account) e quali richiedono di scriverci]`.

---

## 12. Eredità digitale

Se attivi questa funzione, designi tu stesso uno o più "guardiani" e definisci le condizioni (periodo di inattività, conferme richieste) in base alle quali alcune tue capsule vengono rese accessibili a destinatari che hai scelto tu. Non è un trattamento che decidiamo noi caso per caso: eseguiamo un'istruzione che hai impostato tu in anticipo, con le conferme che hai richiesto tu stesso.

---

## 13. Modifiche a questa informativa

`[DA COMPLETARE]` --- come verrai avvisato di modifiche sostanziali (es. email dedicata, banner in-app) prima che entrino in vigore.

---

## 14. Contatti

`[DA COMPLETARE]`

---

## Riepilogo per chi revisiona: cosa manca prima di poter pubblicare

1. Ragione sociale, sede, contatti (sezione 1, 14).
2. Verifica delle garanzie di trasferimento extra-UE offerte oggi da Supabase, Anthropic, Vercel nei rispettivi termini (sezioni 5, 6) --- e se serve un DPA firmato a parte con Anthropic, non solo i termini standard.
3. Periodo di conservazione dei dati, con un numero preciso (sezione 7).
4. Come si esercitano in pratica i diritti dell'interessato (sezione 11).
5. Conferma legale della decisione sui dati sanitari (sezione 10) --- la scelta di prodotto è già presa (esclusione sempre, indipendente dal consenso), resta da confermare che il testo la esprima correttamente.
