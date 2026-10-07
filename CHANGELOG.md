# Changelog

Registro di tutto ciò che è stato costruito in HINTHIAL, dalla nascita del progetto ad oggi — pensato come base per scrivere documentazione tecnica e guide utente, non come sostituto di nessuna delle due.

**Come leggere una voce:**
- **Cosa fa** --- in linguaggio semplice: cosa può fare oggi chi usa Hinthial, materiale di partenza per una guida utente.
- **Note tecniche** --- dove rilevante, per chi scriverà la documentazione per sviluppatori (scelte architetturali, compromessi accettati consapevolmente, limiti noti).

**Una precisazione sulle date**: riflettono quando ogni funzionalità è stata *registrata su git* (`git log`), non necessariamente il giorno esatto in cui è stata scritta --- un ampio arretrato di lavoro è stato formalizzato in commit separati il 2026-09-04, pur essendo stato sviluppato nel corso di più sessioni precedenti. Da qui in avanti una nuova voce viene aggiunta in cima ad ogni funzionalità completata.

---

## 2026-10-07 (65)

### Dashboard "Lavagna"

**Cosa fa:**
- Ultimo stile della Dashboard, da scegliere in **Impostazioni > Aspetto > Dashboard**: le tue scadenze in **colonne per tempo**: *Da sistemare* (già scadute), *Questa settimana* (entro 7 giorni), *Questo mese* (entro 30), *Più avanti* e *Fatte* (le ultime cinque completate). Ogni carta ha il titolo, quanto manca (colorato per urgenza), la data e il bene.
- **Si trascina una carta (col mouse) in un'altra colonna e la sua data si sposta**: in una colonna di date la scadenza va a un giorno di quella colonna (tra 4 giorni per la settimana, 20 per il mese, 60 per più avanti), alla stessa ora; in *Fatte* la scadenza è segnata come completata; una carta *Fatta* trascinata in una colonna torna aperta. Mentre si trascina la carta segue il mouse e la colonna sotto si illumina; *Esc* annulla il trascinamento.
- **In *Da sistemare* non si può trascinare**: si riempie da sola con il passare del tempo. Rilasciare lì fa tremare la colonna e spiega perché; la carta resta dov'era.
- **Ogni spostamento si può annullare** per qualche secondo ("«Bollo auto» spostata in "Più avanti": lun 7 dic. — Annulla"). In alto un contatore dice quante ne hai segnate come fatte oggi.
- **Su smartphone e con la tastiera** ogni carta ha i pulsanti per spostarla ("→ settimana", "→ mese", "→ più avanti", "✓ Fatta"), e le colonne scorrono di lato (il dito non trascina: litigherebbe con lo scorrimento). Su schermo largo i pulsanti compaiono quando una carta riceve il focus da tastiera.

**Note tecniche:**
- Nessuna migrazione. Le regole stanno in funzioni pure (`domain/dashboard/board.ts`: `columnOf`, `buildBoard`, `planMove`), che decidono in quale colonna sta una scadenza e cosa va salvato per uno spostamento (completata sì/no e nuova data, o niente, o rifiuto). Il componente applica lo spostamento in modo ottimistico e lo salva con `setReminderCompleted` e `setReminderDueAt` (solo ciò che cambia); se il salvataggio fallisce torna indietro. L'annulla ripristina completamento e data di prima.
- Il trascinamento è fatto con i pointer events del mouse (non l'HTML5 drag-and-drop, che non dà controllo sull'aspetto né sul rifiuto) e una copia della carta che segue il puntatore; il bersaglio si trova con `elementFromPoint`. Col dito non parte nulla, per non togliere lo scorrimento delle colonne.
- Test: unità per le regole delle colonne e degli spostamenti, e per il componente (pulsanti, annulla, errore, trascinamento con eventi del mouse); e2e `dashboard-board.spec.ts` con un trascinamento vero e la verifica che lo spostamento resti salvato.

---

## 2026-10-07 (64)

### Dashboard "Storie"

**Cosa fa:**
- Nuovo stile della Dashboard, da scegliere in **Impostazioni > Aspetto > Dashboard**: la tua giornata a **cinque schermate che scorrono da sole**, come le storie. **Oggi** (quante cose chiedono attenzione, con il numero che sale), **Scadenze** (le prime tre, quelle già passate per prime, con la data e il bene), **Archivio** (i documenti nuovi della settimana e un ventaglio di pagine), **Capsule** (quando si apre la prossima, con un anello e i giorni che mancano) e **Primi passi** (l'anello dei passi di avvio e quello che manca). Ogni storia ha il suo colore e il suo pulsante verso la sezione.
- In alto le barre di avanzamento: ognuna si riempie in 6 secondi e poi si passa alla successiva (dall'ultima si riparte dalla prima). **Tocca a destra per avanzare, a sinistra per tornare**, **tieni premuto per fermare**, oppure usa il **pulsante di pausa** o le **frecce** della tastiera.
- **Su schermo largo** la storia sta al centro, con l'indice delle cinque storie a sinistra e, a destra, i documenti recenti (con le miniature) e le aree. Su smartphone la storia è in cima, il resto sotto.
- Chi ha scelto "meno movimento" nel dispositivo non le vede avanzare da sole né gli ingressi animati: i numeri compaiono interi e si va avanti a tocchi.

**Note tecniche:**
- Nessuna migrazione (`stories` era già nel vincolo di `profiles.dashboard_style`). `buildStories` (pura, `domain/dashboard/stories.ts`) ricava il contenuto dallo stesso contesto delle altre viste, riusando `buildBento`; `BentoCapsule` ora porta anche `openAt` e `others`. "Aggiunti di recente" e "Le tue aree" sono stati estratti in componenti condivisi (`DashboardRecentDocuments`, `DashboardAreas`), usati anche da Oggi.
- L'avanzamento è una animazione CSS (`story-seg`) il cui `animationend` passa alla storia successiva: mettere in pausa è `animation-play-state: paused`, senza timer in JavaScript da sincronizzare. Le animazioni stanno in `globals.css` (`story-*`) con una regola `prefers-reduced-motion`.
- Test: unità per `buildStories` e per il componente (navigazione a tocchi e frecce, pausa e tenere premuto, capsule, primi passi, vault vuoto); l'avanzamento da solo è coperto dall'e2e (`dashboard-style.spec.ts`), perché jsdom non emette gli eventi di animazione.

---

## 2026-10-07 (63)

### Dashboard "Bento"

**Cosa fa:**
- Nuovo stile della Dashboard, da scegliere in **Impostazioni > Aspetto > Dashboard**: un colpo d'occhio su tutto, in **riquadri di misure diverse**, ognuno col suo gesto e ognuno un link alla sua sezione.
- Il riquadro grande è la **prossima scadenza** ("Bollo auto tra 5 giorni", con la data e il bene) con le etichette "N scadute" e "N nei prossimi 30 giorni". **Archivio** mostra quanti documenti hai e quanti nuovi questa settimana, con un ventaglio di tre schede nel colore della categoria. **Prossima capsula** ha un anello con i giorni all'apertura e il nome di chi la riceverà. **Amici** mostra le foto (o le iniziali) e quanti sono amici e guardiani. **Beni** elenca fino a tre beni con la scadenza che li riguarda e un'etichetta (scaduta, in arrivo, ok): prima quelli con qualcosa da sistemare. **Primi passi** è un anello con i passi di avvio completati e dice quello che manca. **Appena aggiunti** mostra gli ultimi due documenti.
- **Chiedi a Hinthia**: scrivi una domanda (o tocca uno dei due suggerimenti, ricavati dalle tue scadenze) e si apre la pagina di Hinthia con la domanda già nel campo, pronta da inviare. Vale anche per chiunque arrivi alla pagina con `?q=...`.
- Su smartphone i riquadri piccoli stanno affiancati a due a due, quelli grandi occupano tutta la riga. A vault vuoto ogni riquadro ha un testo gentile.

**Note tecniche:**
- Nessuna migrazione (il valore `bento` era già previsto dal vincolo di `profiles.dashboard_style`). `buildBento` (`domain/dashboard/bento.ts`, pura) ricava tutto dallo stesso `SummaryContext` delle altre viste; `DashboardBento` lo disegna. Per i beni una scadenza già passata conta più di qualunque futura.
- La domanda non viene inviata dalla dashboard: si apre Hinthia con il campo compilato, così la risposta (locale o con Claude, secondo il consenso) resta una scelta di chi preme "Invia". `AIPanel` legge `?q=` una sola volta all'apertura.
- Test: unità per `buildBento` e per il componente (a vault vuoto, scadenze, beni, domanda), e2e esteso in `dashboard-style.spec.ts` (scelta di Bento, scadenza rimandata, domanda che arriva a Hinthia).

---

## 2026-10-07 (62)

### Lo stile della Dashboard si sceglie dalle Impostazioni (primo: "Oggi")

**Cosa fa:**
- In **Impostazioni > Aspetto > Dashboard** si sceglie come si presenta la prima pagina, con una scheda e una breve spiegazione per ogni stile. La scelta segue l'account su tutti i dispositivi. Per ora gli stili sono due: **Classica** (la dashboard di sempre, resta quella predefinita) e **Oggi**.
- **Oggi** parte da cosa fare: in alto una frase dice quante cose chiedono attenzione ("Oggi 2 cose meritano attenzione") con una barra di avanzamento. Ogni scadenza già scaduta o entro 7 giorni ha la sua carta, colorata per urgenza, con il documento collegato e due pulsanti: **Segna fatta** e **Rimanda di 7 giorni** (una scadenza già passata riparte da oggi). Quando hai finito lo dice. Sotto, "Più avanti" con le prossime tre; di lato la **settimana** (sette giorni con un punto colorato dove c'è una scadenza, da toccare per leggerla), i **documenti aggiunti di recente** come schede da scorrere di lato (con la **miniatura vera** del file dove c'è, altrimenti una pagina disegnata nel colore della categoria) e le **aree** come pastiglie con icona, numero e nome. Su smartphone tutto in una colonna.
- Gli altri stili (Bento, Storie, Lavagna) arriveranno uno alla volta.

**Note tecniche:**
- Migrazione `20261010000000_dashboard_style.sql`: `profiles.dashboard_style` (testo, predefinito `classic`, vincolato ai cinque valori già previsti). Letto lato server con il resto del profilo (`getCurrentUser`) per non mostrare per un istante lo stile sbagliato; `lib/dashboard-style.ts` elenca solo gli stili già disponibili.
- I dati sono gli stessi per ogni stile: l'hook `useDashboardData` costruisce una volta il `SummaryContext` e `DashboardWidgets` sceglie la vista (`DashboardClassic`, `DashboardToday`); un "segna fatta" o "rimanda" aggiorna la scadenza in locale (`patchReminder`) invece di ricostruire e decifrare tutto. Nuova `setReminderDueAt`. Le funzioni di data (`daysUntil`, `deadlineLevel`, `whenText`, `buildTodayPlan`) sono pure, in `domain/dashboard/deadlines.ts`, e contano giorni di calendario nel fuso dell'utente.
- Corretto un difetto che si vedeva solo in sviluppo: le **miniature dei documenti non comparivano mai** (né qui né nella Cassettiera dell'Archivio). In sviluppo React monta, smonta e rimonta ogni componente; la cache delle miniature veniva chiusa allo smontaggio e non riaperta al rimontaggio, quindi scartava ogni risultato. Ora la cache si riapre (`revive`); test `thumbnails-strict-mode.test.tsx`. In produzione non succedeva.
- Test: unità per le funzioni di data e per la vista Oggi (segna fatta, rimanda, errore di salvataggio, settimana), e2e `dashboard-style.spec.ts` (scelta, uso, persistenza dopo il refresh). Sistemati anche `onboarding-checklist` e `onboarding-status`, che cercavano gli amici nelle righe dell'elenco invece che nella rubrica.

---

## 2026-10-07 (61)

### Amici diventa una rubrica

**Cosa fa:**
- La pagina **Amici** (vista a elenco) è ora una **rubrica**: in alfabetico per nome, con le lettere come intestazioni, una **ricerca** (per nome, ruolo o email) e un **indice a lettere** a lato: un tocco salta alla lettera, quelle senza nessuno sono spente. A destra, la **scheda della persona** con foto o iniziali, ruolo, stato (Attivo/Revocato), amico, guardiano, "Ha un account Hinthial", email, da quando è in rubrica e le **capsule che le hai affidato** (titolo, data di creazione e apertura prevista).
- Dalla scheda: "Richiedi amicizia" (se ha un account), "Chiedi di diventare guardiano" o "Rimuovi dai guardiani" (solo per gli amici), "Modifica" e il menu ⋮ con tutte le azioni di prima (Revoca, Elimina...).
- **Su smartphone** si vede una cosa alla volta: la rubrica, e **toccando una persona la sua scheda**, con **"← Rubrica"** per tornare all'elenco, che riparte da dove l'avevi lasciato. Su tablet e computer elenco e scheda stanno affiancati.
- La vista a tabella (solo su schermi larghi) resta com'è, e si sceglie sempre dall'interruttore o da Impostazioni > Aspetto > Liste. Le richieste di amicizia in arrivo e il filtro per stato non cambiano.

**Note tecniche:**
- Nessuna migrazione. Componente `AddressBook` (con le funzioni pure `letterOf`, `groupByLetter`, `sortAlphabetically`, `nameParts`), usato da `FriendsPanel` al posto dell'elenco a righe; il menu ⋮ è lo stesso della tabella (`rowMenu`). Gli amici senza nome e cognome salvati (i più vecchi) mostrano le iniziali ricavate dal nome visualizzato invece del punto interrogativo.
- Ordine per nome visualizzato (di solito il nome proprio), come molte rubriche; i nomi che non iniziano con una lettera stanno sotto "#". Il tasto "indietro" del telefono lascia la pagina (non torna alla rubrica): per tornare c'è "← Rubrica". Test: `friends-rubrica.spec.ts` (schermo largo e smartphone); gli altri test che guardavano le righe degli amici sono stati adattati alla scheda.

---

## 2026-10-07 (60)

### Una nuova zona di rilascio per il file ("Mirino")

**Cosa fa:**
- Il riquadro in cui si trascina un documento (Archivio > Aggiungi contenuto > Carica un file) non ha più la graffetta: ora è un **mirino**. A riposo ha quattro angoli e un foglio.
- Quando **trascini un file sopra**, il riquadro si colora di verde acqua, compare una griglia, i quattro angoli si stringono sul foglio e dice "Inquadrato: rilascia".
- Quando **il file viene caricato**, una luce scorre sul foglio mentre Hinthial ne legge il testo sul dispositivo (con la percentuale, quando si conosce) e le righe si accendono. A lettura finita compare il timbro "Fatto", poi la zona lascia il posto alla scheda del file, come prima.
- Rimuovendo il file la zona torna a riposo. Funziona anche in tema scuro, e con il movimento ridotto le animazioni si spengono.

**Note tecniche:**
- Componente `FileDropZone` (stati `idle | over | loading | done` in `data-state`) e stili `.file-drop` in `globals.css`; nessuna libreria. Il campo file vero (`#file`) ricopre ancora il riquadro, invisibile, quindi tastiera, "Scatta foto" e i test restano com'erano. "Trascinando sopra" è un evento di trascinamento: il solo passaggio del mouse non cambia niente.
- La zona resta visibile durante la lettura del file e per circa un secondo dopo (`zoneSettled` in `CreateArchiveItemForm`): è il tempo del timbro. Test e2e: `archive-dropzone.spec.ts`.

---

## 2026-10-07 (59)

### Nuovo fascicolo da un modello

**Cosa fa:**
- In "Nuovo fascicolo" si può partire da un **modello**: Acquisto di una casa, Incidente d'auto, Cura medica, Ristrutturazione, Successione, Trasloco, Nuovo lavoro, Nascita di un figlio. Ogni scheda dice quante fasi e quanti documenti attesi propone. **"Parti da zero"** resta il percorso di sempre (solo titolo e descrizione).
- Scegliendo un modello il titolo si compila da solo (si può cambiare) e compaiono: **le fasi** (modificabili: nomi separati da virgola), i **documenti attesi** da spuntare o togliere, e **"Ho già trovato N documenti tra i tuoi"**: quelli già in Hinthial che nominano una voce del modello (es. "Visura catastale.pdf"), con "Sembra: …", da tenere o scartare.
- "Crea fascicolo" crea il fascicolo con le fasi, i documenti attesi scelti e collega i documenti trovati, poi apre la scheda.

**Note tecniche:**
- Nessuna migrazione: un modello è solo un insieme di dati (`domain/dossiers/templates.ts`) che usa fasi e documenti attesi già esistenti. I documenti trovati si cercano con lo stesso abbinamento dei documenti attesi (`matchExpected`), solo tra quelli che non stanno già in un fascicolo, uno per voce; si leggono solo quando si sceglie un modello, così "Parti da zero" non costa nulla in più.
- Se il fascicolo si crea ma un passaggio successivo fallisce (fasi, voci, collegamenti) la pagina lo dice e offre "Apri il fascicolo", senza permettere un secondo "Crea" che ne farebbe un doppione.

---

## 2026-10-07 (58)

### Condividere un fascicolo con un link protetto

**Cosa fa:**
- Nella scheda di un fascicolo c'è il pulsante **"Condividi"**. Si scelgono i documenti (tutti, o si tolgono quelli che non vanno mostrati), **con chi** (Notaio, Medico, Commercialista, Avvocato o un nome: serve solo a riconoscere il link), **per quanto tempo** (24 ore, 7 giorni, 30 giorni) e **cosa può fare** (solo vedere, oppure vedere e scaricare). Si può includere il riassunto di Hinthia e le fasi; persone coinvolte, passi e note personali non vengono mai condivisi.
- Il pulsante **"Crea il link protetto"** cifra i documenti sul tuo dispositivo (con una barra di avanzamento) e dà un link da **copiare** o da **inviare per email** (un'email già scritta).
- Chi riceve il link **non ha bisogno di un account**: apre una pagina con il fascicolo, i documenti (anteprima di PDF, immagini, audio, video, note) e, se permesso, il pulsante per scaricarli. Il link scade da solo.
- Nella stessa pagina vedi l'elenco dei **link condivisi**: stato (Attivo, Scaduto, Revocato), quante volte è stato aperto, quanti documenti sono stati visti e l'ultimo accesso. **"Copia il link"** lo ricopia in qualunque momento, **"Revoca subito"** lo chiude e toglie le copie dei documenti.

**Note tecniche:**
- Migrazione `20261009000000_dossier_shares`: tabelle `dossier_shares` e `dossier_share_accesses` e bucket privato `dossier-shares`. Il dispositivo ricifra ogni documento con una chiave nuova che sta **solo nel link, dopo il #** (il browser non la invia mai al server); l'indice del fascicolo è cifrato con la stessa chiave, e la chiave stessa è salvata cifrata con la Master Key per poter ricopiare il link. Il server consegna solo byte che non può leggere. Dettagli in `lib/crypto/PROTOCOL.md`.
- Pagine pubbliche: `/c/[id]` (fuori da `(app)`, non indicizzata) e `/api/shares/[id]` e `/api/shares/[id]/documents/[documentId]` (service role): controllano solo che il link esista, non sia scaduto, revocato o ripulito, e rispondono allo stesso modo a ogni errore. Gli accessi li scrive il server.
- Pulizia: revoca, scadenza (cron giornaliero `trash-purge` → `lib/shares/purge.ts`), eliminazione del fascicolo, "Cancella tutto" ed eliminazione dell'account tolgono le copie da Storage. Eventi in Attività: "Fascicolo condiviso con un link" e "Link di condivisione revocato".
- Limiti dichiarati: chi ha il link intero apre i documenti finché non scade o viene revocato (un'email che lo porta passa dal fornitore di posta); "solo vedere" nasconde il pulsante di download ma non può impedire di salvare o fotografare ciò che si vede. Al massimo 40 documenti e 100 MB per link. Non c'è ancora un limite di richieste sulle pagine pubbliche.

---

## 2026-10-07 (57)

### "In breve": il riassunto del fascicolo scritto da Hinthia

**Cosa fa:**
- Se Hinthia ha già letto dei documenti di un fascicolo, in cima compare **"In breve"**: **"Scrivi il riassunto"** produce 3-5 frasi sulla vicenda (di cosa si tratta, fatti principali, scadenza più vicina, cosa sembra mancare), partendo dalle sintesi che Hinthia ha già scritto. Non rilegge i file.
- Il riassunto si salva nel fascicolo e dice da quando è e da quanti documenti è tratto. Se poi Hinthia legge altri documenti, avvisa che è da aggiornare; **"Aggiorna"** lo riscrive, **"Elimina il riassunto"** lo toglie.
- Parte solo quando lo chiedi, e solo con i documenti che hai abilitato: i documenti esclusi dall'analisi o di una categoria non abilitata restano fuori, e te lo dice.

**Note tecniche:**
- Rotta `api/ai/dossier-summary`: ricontrolla sul database il consenso generale (`ai_master_enabled`, `ai_extraction_consent`) e per ogni documento l'esclusione e la categoria abilitata, come `api/ai/analyze`; il permesso "solo questa volta" non vale qui. Il client manda solo titolo del fascicolo e, per documento, nome, data, sintesi (max 1.500 caratteri) e fino a 8 campi letti (max 30 documenti); il server rifiuta richieste fuori misura. Un evento "Documento letto da Hinthia" per ogni documento usato. Modello: lo stesso della fusione delle sintesi (`ANALYSIS_MODELS.merge`).
- Il testo si salva cifrato con la Master Key in `dossiers.encrypted_summary` (migrazione `20261008000000`). La parte pura è in `domain/ai/dossier-summary.ts` (richiesta, validazione, "da aggiornare"), la chiamata ad Anthropic in `lib/ai/claude-dossier-summary.ts`.

---

## 2026-10-07 (56)

### Fasi, prossimi passi e persone nel fascicolo

**Cosa fa:**
- **Fasi**: il pulsante "+ Fasi" propone un modello (Acquisto casa, Salute, Incidente, Lavori in casa) o si scrivono a mano ("Visite, Esami, Cura"). Si vedono come tappe; **un clic sposta** la fase in cui sei (la scelta è tua, Hinthia non decide). Nell'elenco la scheda del fascicolo dice "Fase 3 di 5 · Mutuo" con una barretta di avanzamento.
- **Prossimi passi**: poche righe da fare ("Fissare il rogito"), con un giorno facoltativo e la spunta. Quelli con un giorno contano tra le prossime scadenze del fascicolo, anche nell'elenco.
- **Persone**: chi c'entra con la vicenda, con nome e ruolo ("Notaio Rossi · Studio notarile"), nel riquadro "Coinvolti" insieme ai beni.
- Tutto facoltativo: finché non lo aggiungi, la scheda non mostra niente di tutto questo (solo i pulsanti "+ …").

**Note tecniche:**
- Migrazione `20261008000000_dossier_phases_items_summary`: `dossiers.encrypted_phases` (JSON cifrato: nomi e fase corrente) e tabella `dossier_items` (passi e persone, `encrypted_data` cifrato; in chiaro solo `done` e `due_on`). Parte pura in `domain/dossiers/phases.ts` e `items.ts`; i passi con data entrano in `dossierDeadlines`.
- `DossierDetail` è stato diviso in componenti (`DossierTimeline`, `ExpectedItemsCard`, `DossierNextSteps`, `DossierInvolved`, `PhasesBar`, `DossierSideCards`).

---

## 2026-10-07 (55)

### Fascicoli suggeriti: Hinthial nota cosa va insieme

**Cosa fa:**
- Nell'elenco dei fascicoli, se hai **tre o più documenti dello stesso bene** e nessuno è in un fascicolo, compare un avviso: "Hai 3 documenti di «Fiat Panda» senza un fascicolo. Vuoi riunirli?". **"Crea il fascicolo"** lo crea col nome del bene, ci mette dentro i documenti e lo apre; **"Non ora"** lo nasconde.
- Nella scheda di un fascicolo, il riquadro **"Forse appartengono qui"** elenca altri documenti dello stesso bene dei suoi documenti, ancora fuori: **"Aggiungi"** li mette dentro (restano negli altri fascicoli in cui già stanno), la **×** li scarta.
- Regole prudenti, per non proporre collegamenti sbagliati: un fascicolo nuovo solo da tre documenti in su e mai se esiste già un fascicolo con quel nome; i documenti da aggiungere solo se almeno due del fascicolo sono di quel bene, e se il bene è uno solo (con due beni a pari merito non si sceglie). Mai sui fascicoli chiusi.

**Note tecniche:**
- Nessuna migrazione e nessun dato in più sul server: i suggerimenti si calcolano sul dispositivo (`domain/dossiers/suggestions.ts`, coperto da test) dai beni già collegati ai documenti. I "Non ora" e le × si ricordano nel `localStorage` del dispositivo, quindi su un altro dispositivo il suggerimento ricompare.
- Non sono "proposte" del registro di lettura (nessun nuovo tipo di proposta): vivono nelle pagine dei fascicoli. Rimandato: suggerire un fascicolo anche da altri legami (stesso emittente, parole in comune) e dal singolo documento.

---

## 2026-10-07 (54)

### Documenti attesi nel fascicolo

**Cosa fa:**
- Nella scheda di un fascicolo puoi scrivere cosa ti aspetti di trovarci ("Referto", "Fattura dell'intervento"…): il pulsante **"+ Documenti attesi"** apre il riquadro, e più voci separate da virgola si aggiungono insieme.
- Ogni voce si **spunta da sola** quando nel fascicolo c'è un documento che la nomina (nel nome, nell'emittente, nei tag, nelle note o nei campi letti da Hinthia), e sotto compare il link a quel documento. Per una cosa che non sta in Hinthial ("ritirare l'originale") si spunta a mano. Una barra mostra quante sono fatte.
- Senza voci la scheda resta com'è: il riquadro compare solo se lo vuoi.

**Note tecniche:**
- Migrazione `20261007000000_dossier_expected_items` (additiva, una tabella nuova): `dossier_expected_items` con etichetta cifrata sul dispositivo come titolo e descrizione del fascicolo, spunta in chiaro, accesso solo al proprietario e al suo fascicolo. Il record dello storico delle migrazioni del progetto è fermo al 2026-09-28 (le successive sono state applicate a mano): per questa NON usare `supabase db push`, che riproverebbe anche quelle, ma `supabase db query --linked -f` sul solo file.
- L'abbinamento è puro (`domain/dossiers/expected.ts`, coperto da test): parole significative della voce (senza accenti, senza vocale finale, quindi "fattura" = "fatture", senza articoli e preposizioni) tutte presenti nel testo del documento; un documento soddisfa una sola voce. Se la tabella non esiste ancora la scheda funziona lo stesso e il riquadro non compare.

---

## 2026-10-06 (53)

### Fascicoli vivi: l'elenco e la scheda raccontano la vicenda da soli

**Cosa fa:**
- L'elenco dei fascicoli è una griglia di schede: stato (Aperto/Chiuso), **prossima scadenza** in evidenza (rossa se urgente), quanti documenti, quanto si è speso, quanti beni, "ultimo documento ieri" e tre paginette colorate come le categorie. Cliccando dove vuoi la scheda si apre; il menu ha Apri, Modifica, Elimina. In cima, al posto del menu a tendina, i filtri **Tutti / Aperti / Chiusi / Con scadenze vicine**, con i conteggi.
- La scheda di un fascicolo ha una **Cronologia** unica: documenti, note e scadenze in ordine di data, con l'importo letto dal documento. Sopra la cronologia scrivi una **nota** ("Aggiungi nota"): diventa una nota dell'Archivio già collegata al fascicolo.
- A destra, solo se hanno qualcosa da dire: **Prossime scadenze**, **Spese** (totale e voci principali), **Coinvolti** (i beni dei documenti) e **Cosa dicono i documenti**, che mostra le sintesi già scritte da Hinthia sui documenti letti, senza avviare nessuna nuova lettura.
- Niente da compilare: tutto si ricava da ciò che c'è già nei documenti.

**Note tecniche:**
- Nessuna migrazione. La parte pura è in `domain/dossiers/overview.ts` (importi, scadenze, panoramica, cronologia viva), coperta da `tests/unit/dossier-overview.test.ts`; i componenti sono `DossierCard`, `DossiersPanel` e `DossierDetail`.
- Una spesa è l'importo di un documento nei campi `importo_totale`, `importo_sanzione`, `premio`, `importo`, in quest'ordine: massimale e saldo non contano, per non gonfiare il totale. Le scadenze sono quelle create per i documenti del fascicolo più la data di scadenza dei documenti stessi (se coincidono nello stesso giorno resta la scadenza).
- Le sintesi di "Cosa dicono i documenti" si leggono solo al clic, con `getDocumentsByIds`. Rimandati: fasi, documenti attesi, persone, condivisione, fascicoli suggeriti.

---

## 2026-10-06 (52)

### L'Archivio ha sei viste: elenco, tabella e quattro nuove

**Cosa fa:**
- Nell'Archivio c'è un menu **"Vista"** (accanto a "+ Aggiungi contenuto") per guardare gli stessi documenti in sei modi. Scegliere una vista vale per quella visita (finisce nell'indirizzo: il tasto indietro torna alla precedente). **"Rendi predefinita"** la salva su tutti i tuoi dispositivi, ed è la stessa scelta di **Impostazioni > Aspetto > Liste > Archivio**.
- **Cassettiera**: una galleria di schede con miniatura, viste in cima (Tutti, In scadenza, Da leggere, Senza categoria, Recenti) e filtri a faccette a sinistra (categoria, tipo, anno) che si combinano. Schede grandi o compatte, ordine per data, nome o scadenza, "Mostra altri 60". Selezionando compare una barra scura in basso con Categoria, Fascicolo, Tag e Cestino.
- **Linea del tempo**: i documenti per mese lungo una linea, con in cima le scadenze in arrivo, filtri (categoria, tipo, bene, scadenza, da leggere) e a destra la **Mappa del tempo**: una barra per mese, un clic per saltarci. Azioni al passaggio (Apri, Scarica, Elimina).
- **Collezioni**: la home dice cosa chiede attenzione (in scadenza, da leggere con Hinthia, senza categoria, possibili doppioni) e mostra le categorie come pile di fogli; aprirne una porta a una tabella ordinabile (nome, tipo, scadenza, aggiunto) con selezione e "Mostra altri 50". La ricerca in alto cerca in tutto l'archivio.
- **Scaffale**: ogni documento è un dorso su uno scaffale. Il colore è la categoria, l'altezza il peso del file, il nastrino in cima una scadenza vicina, il puntino in basso la lettura di Hinthia. I filtri "illuminano" i dorsi giusti senza nascondere gli altri; cliccando un dorso la scheda si apre a destra.
- Tutte e quattro cercano per nome, emittente, note, tag, campi della Scheda (targa, numero polizza…), categoria e bene. Sul telefono resta l'elenco, come prima.

**Note tecniche:**
- Nessuna migrazione: la vista è `profiles.list_view_preferences.archive` (jsonb), ora una di sei (`ArchiveViewMode`); le altre sezioni restano a elenco o tabella. `modeFor("archive")` ricade su elenco/tabella; `archiveViewFor()` e `savedArchiveView` danno la vista completa. Il parametro dell'indirizzo è `?vista=`.
- `DocumentsPanel` è stato diviso: dati, selezione e azioni di gruppo sono in `archive/useArchiveData.ts` e valgono per ogni vista; elenco e tabella restano dove erano. Le quattro viste sono in `components/documents/archive/` (`GalleryView`, `TimelineView`, `CollectionsView`, `ShelfView`), la parte pura (colori delle categorie, urgenza delle scadenze, ricerca, mesi, collezioni, disposizione dello scaffale) in `domain/documents/archive-views.ts`.
- Le categorie non hanno un colore proprio: si ricava in modo stabile dal nome (colori fissi per le categorie predefinite, per le altre dall'hash del nome). Le miniature vere dei documenti si scaricano e decifrano solo quando la scheda entra nello schermo (al massimo quattro richieste insieme, una cache per tutta la pagina); dove non c'è, una pagina disegnata col colore della categoria.
- Tipo = tipo di contenuto (documento, immagine, nota…), non il tipo letto da Hinthia (polizza, bolletta…): quello sta nella lettura cifrata e non è nell'elenco leggero. "Possibili doppioni" = stesso nome e stessa dimensione. L'altezza dei dorsi usa la dimensione del file, non le pagine.
- Limite noto: l'Archivio carica e decifra ancora tutti i riassunti dei documenti a ogni visita (come prima); le viste ne disegnano 60 alla volta o 168 sullo scaffale, ma l'indice leggero tenuto sul dispositivo resta da fare.
- Test: unità della parte pura, delle quattro viste e delle preferenze; e2e del menu, della vista predefinita da menu e da Impostazioni e dell'indirizzo con `?vista=`.

---

## 2026-10-06 (51)

### Un solo registro di lettura, con il movimento

**Cosa fa:**
- Nella scheda **"Chiedi a Hinthia"** le due sezioni che dicevano le stesse cose, "Proposte" e "Cosa ha letto Hinthia", sono diventate **un solo elenco**: il registro di lettura. Ogni riga è una cosa trovata da Hinthia, con la sua pagina d'origine e la frase del documento che la prova.
- **Accetta, Modifica e No grazie stanno di fianco alla voce**, sulla stessa riga: la pagina è circa metà di prima. "Aggiungi a Scadenze", "Collega" e "Crea e collega" funzionano allo stesso modo.
- **Una voce accettata diventa di sola lettura** ("nella Scheda") e si restringe a una riga: la pagina si snellisce mentre decidi e restano in evidenza le voci da decidere. Una voce scartata resta in elenco, attenuata, con **Ripristina**. Il tipo di documento è sempre di sola lettura.
- In cima, un riquadro dice "8 di 10 nella Scheda · 2 da decidere", con una barra a tacche (una per voce) e il pulsante **"Accetta le N rimaste"**. Le voci sono raggruppate in Documento, Dettagli, Importi e date, Collegamenti.
- **Il movimento:** accettando, un lampo verde attraversa la riga, la spunta si disegna da sola, la tacca della barra cresce e il numero in alto scorre; con "Accetta le N rimaste" le righe si accendono **a onda**, una ogni 150 millisecondi, e a lavoro finito il riquadro lancia un alone verde. Passando su una voce da decidere si illumina con un filo blu; i pulsanti si sollevano e si schiacciano. Chi ha il movimento ridotto nel sistema vede gli stessi stati senza animazioni.
- L'intestazione di una lettura già fatta è ora "Lettura di Hinthia · titolo · letta il…", con "Rileggi da capo" di fianco.
- **Ordine della scheda:** "Vedi attività di questo contenuto" sta sotto l'anteprima, a sinistra, e non più sopra le tab. Nella scheda "Chiedi a Hinthia" l'ordine è: intestazione della lettura, **riassunto**, registro delle proposte. Il testo "Non hai ancora chiesto a Hinthia di leggere questo documento" compare solo se il documento non è mai stato letto (prima compariva anche con una lettura senza riassunto).

**Note tecniche:**
- `src/domain/ai/analysis/register.ts` (puro) costruisce le righe unendo i fatti della lettura (`buildAnalysisOverview`), le proposte e i rifiuti: una riga è `pending` (ha una proposta), `adopted` (già nella Scheda), `rejected` (c'è un rifiuto registrato) o `info` (nessuna azione possibile: tipo di documento, una data già passata, un campo già diverso nella Scheda). Le proposte senza una lettura che le spieghi (il bene da creare o collegare, la categoria dedotta dal tipo) diventano righe a sé.
- `ReadingRegister.tsx` sostituisce `ProposalsSection.tsx` e `AnalysisOverviewSection.tsx` (eliminati, con i loro test; la pagina d'origine con la frase evidenziata è rimasta). Il movimento è in `globals.css` (`.reading-*`, `--d` = ritardo di ciascuna riga): la riga che passa a "nella Scheda" si riconosce confrontando lo stato con il render precedente, e non si anima nulla al primo caricamento.
- Con "Accetta le N rimaste" le scritture restano sequenziali come prima; la riga si accende a onda quando la pagina si aggiorna, non a ogni scrittura.
- Non c'è un "Annulla" sulla riga: l'annullamento resta quello sopra le tab (annulla l'ultima azione, anche "Accetta le N rimaste" in un colpo). L'ordine delle righe è quello del registro (categoria prima della scadenza): gli e2e delle proposte cercano la riga per nome.
- Test: unità del registro (`reading-register.test.tsx`) e e2e delle proposte aggiornati.

---

## 2026-10-06 (50)

### Hinthial propone di creare il bene, e il bene mostra tutte le sue scadenze

**Cosa fa:**
- Se un documento parla di un bene che non hai ancora (una polizza auto con modello e targa, una polizza casa con l'oggetto assicurato, una bolletta con il codice di fornitura), nella scheda compare **"Nuovo bene: Ford Focus 1.5 EcoBlue (EY389YM)"**. **Crea e collega** crea il bene e vi collega il documento; **Modifica** cambia il nome prima di crearlo; **No, grazie** non la ripropone; **Annulla** elimina il bene appena creato.
- Se esiste già un bene con lo stesso nome, propone di collegarlo invece di crearne un doppione.
- Dopo il primo collegamento il bene "impara" targa e numero di polizza: i documenti successivi vengono proposti da soli (v. voce 49).
- Nella pagina **Beni**, "Scadenze collegate" ora riunisce in un posto solo: le scadenze create per il bene, quelle dei suoi documenti (per esempio una disdetta accettata da una polizza) e la data di scadenza dei documenti stessi (📄), in ordine di data. Il conteggio nella tabella segue lo stesso criterio.

**Note tecniche:**
- `buildNewAssetProposal` (`src/domain/assets/link-proposal.ts`) ricava il nome dai campi già letti o confermati (targa + oggetto assicurato, solo oggetto assicurato se più corto di 60 caratteri, codice di fornitura): nessun cambiamento al prompt né alla lettura, quindi nessun bump di `ANALYSIS_PIPELINE_VERSION` e nessuna nuova chiamata a un servizio esterno. Resta il limite che il nome è quello che la lettura ha dato ai campi: per beni senza questi identificativi (un elettrodomestico, un animale) la proposta non compare; un bene con nome scelto dal modello sarebbe un passo successivo, con modifica del prompt e nuova misura.
- Stessa proposta `asset` della voce 49 (`createAsset` + `value` = nome): nessuna nuova migrazione, il rifiuto usa il nome come valore. Il bene nasce nella categoria del documento, se ce l'ha.
- `src/domain/assets/deadlines.ts` (puro): scadenze non completate del bene o dei suoi documenti + data di scadenza dei documenti; se un evento coincide col giorno di scadenza del proprio documento mostra solo l'evento.
- Test: unità (proposta, scadenze, sezione), integrazione (crea/annulla contro il database) ed e2e.

---

## 2026-10-05 (49)

### Hinthial propone il bene a cui collegare un documento

**Cosa fa:**
- Se un documento ha la **stessa targa, lo stesso numero di polizza, di contratto o lo stesso codice di fornitura** di un documento che hai già collegato a un bene, nella scheda compare la proposta **"Bene: Fiat Panda"**, con il motivo (*"Stesso numero di polizza (RCA-998877) di «Polizza 2026.pdf», già collegato a Fiat Panda"*).
- Tre risposte, come per le altre proposte: **Collega**, **Modifica** (scegli un altro bene) o **No, grazie** (non ricompare). Dopo "Collega" c'è **Annulla**.
- Non devi compilare nessuna scheda del bene: il bene "impara" dai documenti che hai già collegato. Il confronto avviene sul tuo dispositivo, senza inviare nulla fuori.
- Non collega mai da solo e non entra in "Accetta tutto".
- Il campo "Bene collegato" della Scheda ora mostra sempre il bene scelto, anche se è di un'altra categoria rispetto al documento.

**Note tecniche:**
- `src/domain/assets/link-proposal.ts` (puro): solo uguaglianza esatta su identificativi normalizzati (maiuscole, solo lettere e cifre, almeno 4 caratteri), stessa chiave su entrambi i lati, e solo se i documenti trovati portano a **un solo** bene; con due beni in conflitto non propone niente. Un numero di fattura o di verbale non collega mai.
- Il bene impara dai **campi salvati nella Scheda** dei documenti già collegati (`listAssetLinkedFields`: decifra solo nome e campi): un numero letto da Hinthia ma non accettato sul documento già collegato non conta. Nessun cambiamento al prompt né alla lettura, quindi nessun bump di `ANALYSIS_PIPELINE_VERSION`.
- Nuovo tipo di proposta `asset` (`value` = id del bene). **Migrazione `20261005010000_proposal_rejections_asset_kind.sql`**: allarga il vincolo dei rifiuti; senza, "No, grazie" sulla proposta del bene non si registra.
- Test: unità del confronto e della sezione, integrazione (accetta/annulla/rifiuta contro il database) ed e2e `asset-link-proposal.spec.ts`.

---

## 2026-10-05 (48)

### La categoria proposta per tipo di documento si sceglie dalle Impostazioni

**Cosa fa:**
- In **Impostazioni > Categorie**, sotto l'elenco, c'è la sezione **"Categoria proposta per tipo di documento"**: per ogni tipo (polizza, bolletta, contratto, referto, fattura, verbale, certificato, estratto conto, generico) scegli quale categoria Hinthia deve proporre quando legge un documento di quel tipo e il modello non ne dà una.
- Le scelte sono tre: **una tua categoria** (per esempio le bollette in "Utenze"), **"Nessuna categoria"** (per quel tipo non si propone niente) oppure **"Predefinita"** (la corrispondenza di prima: la polizza in "Assicurazioni", la bolletta in "Casa"...). Si può scegliere una categoria anche per i tipi che non ne hanno una predefinita, come i verbali.
- Vale subito, anche sui documenti già letti, e la proposta resta sempre da accettare. Se elimini la categoria scelta, per quel tipo torna la predefinita.

**Note tecniche:** nuova tabella `document_type_categories` (migrazione `20261005000000`, additiva): una riga per tipo, `category_id` null = nessuna categoria, in chiaro come le categorie, con le regole di accesso del proprietario (la categoria scelta deve essere sua). `defaultCategoryFor` accetta le scelte (`TypeCategoryOverrides`); la scheda del documento le legge insieme agli altri dati e, se la tabella non è ancora presente, usa le predefinite senza errori. Test unitari del pannello e della logica, e un e2e (`type-categories.spec.ts`).

---

## 2026-10-05 (47)

### La categoria si ricava anche dal tipo di documento

**Cosa cambia:** se Hinthia legge un documento e non propone una categoria, la scheda ne propone una in base al **tipo riconosciuto**: una polizza va in "Assicurazioni", una bolletta in "Casa", un contratto in "Contratti", un referto in "Salute", una fattura in "Fiscale", un estratto conto in "Finanze". La proposta è segnata come **"calcolata da Hinthial"** e dice "Dal tipo di documento: Bolletta", perché non c'è una frase del documento che la provi; la accetti o la rifiuti come le altre. Funziona **anche sulle letture già salvate**, senza rileggere.

**Dove non propone niente:** verbali, certificati e documenti generici (una stessa categoria non va bene a tutti: un certificato può essere di residenza, di prestazione energetica o di idoneità), e se hai rinominato o eliminato la categoria corrispondente (il nome si cerca tra le tue, senza badare alle maiuscole). Se il documento ha già una categoria, non si propone nulla.

**Misura su 34 documenti inventati:** categoria 94% in entrambe le prove (prima 68% e 91%, a seconda della prova): ora il risultato non dipende più dall'umore del modello.

**Note tecniche:** `category-defaults.ts` (tabella tipo -> nome della categoria e `defaultCategoryFor`), applicato in `extractedFieldsFrom` con `derived: true`; la misura (`evals/run-analysis.ts`) applica lo stesso ripiego. La tabella è fissa: renderla modificabile dalle Impostazioni è il passo successivo. Nessuna migrazione.

---

## 2026-10-05 (46)

### Tre tipi di documento in più: verbali, certificati ed estratti conto

**Cosa cambia:**
- Hinthia riconosce ora anche i **verbali e le sanzioni** (numero verbale, data della violazione, importo, targa), i **certificati e gli attestati** (numero o codice, data di rilascio, intestatario: residenza, stato di famiglia, prestazione energetica, idoneità) e gli **estratti conto** (periodo, IBAN, saldo iniziale e finale). Prima finivano tutti in "Documento generico", senza campi.
- Nel riquadro "Cosa ha letto Hinthia" il tipo compare con il suo nome (per esempio "Verbale o sanzione") e i campi con i nomi giusti.
- **I documenti già letti risultano "da rileggere"** (versione della lettura 4): solo dopo la rilettura compaiono i nuovi tipi.

**Misura su 34 documenti inventati (tre in più di prima, due prove):** tipo di documento 94-97% (tutti i nuovi tipi riconosciuti); campi trovati con la chiave giusta 88-90% (verbali 88-100%, certificati 89-100%, estratti conto 71-100%); scadenze 100% di precisione; eventi 90% di precisione e completezza. La categoria resta il punto più instabile: 68-91% con gli stessi documenti da una prova all'altra.

**Note tecniche:** i tipi stanno nel registro degli schemi (`schemas.ts`); il prompt e l'interfaccia li leggono da lì, senza altro codice. `ANALYSIS_PIPELINE_VERSION` = 4. Il corpus di misura passa a 34 documenti (`evals/corpus/tipi-nuovi.ts`); un certificato di idoneità sportiva, prima "referto", è ora un certificato. Nessuna migrazione.

---

## 2026-10-05 (45)

### Hinthia dice quando una data da ricordare è già passata

**Cosa fa:** se la lettura trova una data da ricordare (un pagamento, un appuntamento) ma è già passata, la scheda lo scrive nella tab "Chiedi a Hinthia" ("Hinthia ha trovato una data da ricordare, ma è già passata: non l'ho aggiunta a Scadenze", con la data e il nome). Prima la proposta spariva senza spiegazioni. Il comportamento resta lo stesso: una data passata non diventa una scadenza.

**Note tecniche:** `pastEventsOf` (`analyze-document.ts`) e `PastEventsNotice`; test unitari e un e2e (`archive-proposals`). Nessuna migrazione.

---

## 2026-10-05 (44)

### Lettura di Hinthia più completa: campi, eventi e categoria

**Cosa cambia per chi usa Hinthial:**
- **Più dati ricavati dal documento:** i campi del tipo (numero polizza, premio, importo, codice fornitura...) tornano quasi sempre con il nome giusto e non più con nomi inventati; gli **appuntamenti** (controlli medici, visite prenotate) non vanno più persi quando il documento riporta anche l'orario; i **campi con un importo** non vengono più scartati per un "euro" scritto prima o dopo la cifra.
- **La scadenza di pagamento** di una bolletta, di una fattura o di un verbale compare **sia come scadenza del documento sia come avviso da ricordare**; la scadenza di un contratto, di un'offerta o di una garanzia resta solo scadenza.
- **La categoria** viene proposta più spesso quando il tipo di documento è chiaro.

**I documenti già letti vanno riletti:** la versione della lettura è passata da 2 a 3, quindi la scheda li propone "da rileggere" ("Rileggi da capo") e solo allora compaiono le novità. Senza questo passaggio una lettura salvata prima restava valida e non mostrava gli avvisi da ricordare.

**Misura su 31 documenti inventati (due prove ciascuna, Anthropic Haiku 4.5), prima -> dopo:**
campi trovati con la chiave del registro 35% -> 91-94%; completezza degli eventi da ricordare 53% -> 88-94%; categoria 68% -> 84%; precisione delle scadenze 95% -> 100%; tipo di documento 97% -> 97-100%; nessuna istruzione ostile eseguita, prima e dopo. Le misure stanno in `evals/baselines/`. La misura varia di qualche punto da una prova all'altra, e il campione è piccolo: i numeri indicano la direzione, non una garanzia.

**Note tecniche:**
- `validateBlock`: un importo si confronta ignorando l'ordine tra valuta e cifra (`valueMatchesQuote`, con almeno tre cifre perché una cifra sola si troverebbe in qualunque frase); una data con l'ora ("2027-03-20 10:30") si normalizza al giorno (`normalizeDateValue`). La citazione deve comunque comparire nel testo.
- Prompt (`claude-analysis-provider.ts`): al primo blocco, quando il tipo non è ancora noto, si elencano i campi attesi di ogni tipo; regola esplicita per la scadenza di pagamento (scadenza + evento); data degli eventi senza orario; per la categoria non vale "nel dubbio, ometti" se il tipo è chiaro.
- `evals/`: rivalutazione senza chiamate (`EVAL_FROM`), rifacimento della sola validazione sull'uscita grezza (`EVAL_REVALIDATE`) e diagnosi degli scarti (`EVAL_DIAGNOSE`).
- Resta da fare: documenti con OCR molto sporco (il motore "corregge" la citazione e la verifica non la ritrova), la categoria nel 16% dei casi, la scadenza di un'offerta dentro una bolletta. Nessuna migrazione.

---

## 2026-10-05 (43)

### Misura della qualità della lettura (`evals/`)

**Cosa fa:**
- Un insieme di **31 documenti inventati** (polizze, contratti, referti, fatture, bollette, certificati, estratti conto, verbali, più trappole: istruzioni ostili dentro il testo, OCR sporco, documento lungo su più blocchi, appunti senza contenuto, sole date passate), ognuno con le **risposte giuste**.
- `npm run eval` esegue la stessa catena dell'app (blocchi, motore, validazione delle citazioni, fusione) su ogni documento e stampa una tabella: tipo, categoria, scadenze, emittente, campi (per chiave e per valore), eventi e valori vietati, più l'elenco di cosa non torna. Si sceglie il motore con `EVAL_PROVIDER` (oggi `claude` e `empty`, il "pavimento" senza rete), e si rivaluta una misura salvata senza rifare le chiamate con `EVAL_FROM`.
- **Prima misura su Anthropic (Haiku 4.5)**, salvata in `evals/baselines/`: tipo di documento 97%; emittente 100% di precisione e 93% di completezza; scadenze 68% / 87%; eventi 73% / 47%; categoria 55%; campi trovati con la chiave del registro 29% (61% se si accetta una chiave qualsiasi); nessuna istruzione ostile eseguita.

**Cosa ha mostrato (da correggere):**
- Al **primo blocco** di un documento il prompt non include i "campi attesi" del tipo (il tipo non è ancora noto), quindi i campi tornano con chiavi libere (`premio_annuo`, `decorrenza_copertura`) invece di quelle del registro: i documenti di un blocco solo non ne beneficiano mai.
- Le **scadenze di pagamento** delle bollette e delle fatture finiscono come "scadenza del documento" invece che come evento da ricordare (precisione scadenze 0% sulle bollette).
- La **categoria** non viene proposta nel 45% dei casi ("nel dubbio ometti").
- Alcune date di **decorrenza e fine del periodo di prova** diventano eventi.

**Note tecniche:** nessun cambiamento all'app. `tests/unit/evals-corpus.test.ts` controlla le risposte giuste contro i testi (annotazione e documento devono concordare) e `tests/unit/evals-score.test.ts` il punteggio: girano con i test normali, senza chiamare nessun servizio. I risultati completi finiscono in `evals/results/` (ignorata da git). Nessuna migrazione.

---

## 2026-10-05 (42)

### Pulizia: il dispositivo legge il testo, l'interpretazione la fa solo Hinthia

**Cosa cambia:**
- Il dispositivo **estrae il testo** (PDF, OCR, Word) e lo conserva, ma **non lo interpreta più con regole proprie**: niente più scadenza, emittente, titolo o categoria ricavati da parole chiave, niente "Cosa ne ho ricavato", niente proposte locali, niente suggerimenti automatici al caricamento (titolo, categoria, bene).
- Scadenza, emittente, categoria, campi ed eventi arrivano solo da **"Chiedi a Hinthia"** (con il tuo consenso), con la citazione e la pagina d'origine. Il meccanismo delle proposte (accetta, rifiuta, annulla, "Accetta tutto") resta.
- **Senza Hinthia** la scheda mostra il testo letto e la ricerca funziona, ma non propone nulla da sola.
- **Importazione multipla:** i file si raggruppano per **nome** ("bolletta-luce-01.pdf" e "bolletta-luce-02.pdf" propongono un fascicolo "Bolletta luce"); i nomi generici (`scan_0012.pdf`, `IMG_3041.jpg`) non si raggruppano. La categoria si propone solo dalla cartella di Google Drive, se coincide.
- **Cronologia di un fascicolo:** ordinata per data di caricamento (non più per la data letta nel documento).

**Note tecniche:** eliminati `extraction/structured-fields`, `proposals/build`, `proposals/asset-match`, il categorizzatore a parole chiave e `StructuredFieldsSection` (circa 1.100 righe) con i loro test; `findDateContext`, che serve alla validazione dell'analisi di Hinthia, è in `extraction/date-context`. Nessuna migrazione e nessun dato toccato: campi accettati, analisi, vocabolario e rifiuti restano. Tag `pre-interpretazione-locale` sul commit precedente per recuperare le regole (partenza possibile per un'ontologia). Gli e2e delle proposte passano ora dall'analisi simulata (`tests/e2e/hinthia.ts`).

---

## 2026-10-05 (41)

### Elenchi più leggeri, contesto condiviso e test più affidabili

**Cosa fa:**
- **Elenchi più leggeri.** Archivio, beni, capsule, fascicoli, scadenze, tag e dashboard non scaricano più né decifrano il testo letto, la trascrizione, la sintesi e l'analisi di Hinthia di **tutti** i documenti: con 4 documenti i dati trasferiti per pagina passano da circa 25-31 KB a circa 1 KB, e il risparmio cresce con l'archivio. La trascrizione di un audio si legge solo quando la apri.
- **Barra laterale e dashboard** non ricostruiscono più ciascuna per conto proprio tutto l'archivio all'apertura: se la chiedono nello stesso momento, si fa una sola lettura.
- **La creazione di un contenuto** rilegge solo il documento appena salvato e non più tutto l'archivio.
- Il **reset della password con un codice di backup** ha ora un test e2e (e si verifica che il codice sia monouso).

**Note tecniche:** nuovo tipo `DocumentSummary` (senza `transcript`, `extractedText`, `aiSynthesis`, `contentAnalysis`) e `listDocumentSummaries`; chi ha bisogno del contenuto usa `listDocuments`/`getDocumentById` (ricerca, risposte, cronologia dei fascicoli, importazione multipla, esportazione). `buildSummaryContext` per dashboard e avanzamento; `buildAIContext` e `buildSummaryContext` condividono la lettura in corso (`shareWhileLoading`) ma non fanno cache, così un elemento nuovo si vede alla richiesta successiva. `extractTextForExistingDocument` rilegge il testo precedente da sola solo se serve a decidere se l'analisi di Hinthia resta valida. **Test:** i due test di eredità digitale simulano l'invio delle email (prima il controllo scorreva tutti gli utenti del database condiviso e provava a scrivere email vere) e il test dei guardiani verifica a chi verrebbe inviata la richiesta; `import-export` e `archive-proposals` non dipendono più dal menu utente né dalla velocità della lettura. Nessuna migrazione.

---

## 2026-10-03 (40)

### Più veloce: meno chiamate in fila al database

**Cosa fa:**
- L'**Archivio** si apre in circa un terzo del tempo (da circa 0,9 s a circa 0,3 s nella misura fatta con 4 documenti): i dati arrivano tutti insieme invece che in coda.
- La **scheda di un documento** non scarica più tutti gli altri documenti per mostrarne uno solo: con 4 documenti si passa da 27 KB a 1 KB trasferiti, e il vantaggio cresce con l'archivio.
- La **Dashboard** fa 9 richieste invece di 14.
- Le funzioni di Vercel girano ora a Dublino, accanto al database (Irlanda), e non più a Washington.

**Note tecniche:** `getLocalUserId` (`lib/auth/local-user.ts`) legge l'utente dalla sessione già nel browser invece di `auth.getUser()`, che a ogni chiamata interroga il server di autenticazione; usato solo sul percorso di caricamento (avvio della cassaforte, archivio, capsule, notifica delle richieste di amicizia), non nelle azioni che scrivono, che mantengono `getUser()`. `listDocuments` legge i collegamenti ai fascicoli in parallelo (`listAllDossierLinks`) e non dopo; nuovo `getDocumentById` per la scheda. `DocumentsPanel` carica anche la conservazione del cestino in parallelo. Misure con un test e2e temporaneo (4 PDF, navigazioni a cassaforte sbloccata). Non toccato: l'elenco scarica ancora testo letto e analisi di tutti i documenti, e il contesto completo viene ancora costruito più volte (barra laterale, dashboard, ricerca): non pesa con pochi documenti. Nessuna migrazione.

---

## 2026-10-02 (39)

### Reset della password per chi ha la verifica in due passaggi

**Cosa fa:**
- Chi ha attivato l'**autenticazione a due fattori** ora può reimpostare la password: nella pagina "Imposta una nuova password" compare anche il campo **"Codice a 6 cifre o di backup"**, da compilare con il codice dell'app authenticator o con uno dei codici di backup. Chi non ha l'MFA non vede niente di diverso.
- Prima, per questi account, il reset finiva sempre con "La password non è stata accettata": Supabase rifiuta il cambio password a una sessione ottenuta solo con il codice ricevuto per email.
- Un codice sbagliato non cambia la password e non svuota i campi. Il codice ricevuto per email da solo non basta più a prendere un account protetto da due fattori.

**Note tecniche:** il secondo fattore si verifica nella stessa richiesta che cambia la password (`resetPassword`, `verifySecondFactor`), senza un "già verificato" tenuto in un cookie, che si potrebbe falsificare. Con un codice TOTP la sessione sale ad aal2 e la password si cambia normalmente; un codice di backup non fa salire l'AAL (v. `mfa-bypass.ts`), quindi in quel caso si usa l'API admin (`updateUserById`) dopo aver verificato sia il codice email sia quello di backup. Il codice di backup si consuma prima del cambio: se questo fallisce, il codice è perso. La pagina è ora un componente server (`new/page.tsx`) che legge se serve l'MFA e un form client (`NewPasswordForm`). Nuovo test e2e con un utente MFA; il percorso con il codice di backup non ha un test e2e. Nessuna migrazione.

---

## 2026-10-02 (38)

### Reset della password: la conferma resta compilata e gli errori sono chiari

**Cosa fa:**
- Nella pagina "Imposta una nuova password", se qualcosa non va (per esempio la conferma non coincide) **entrambi i campi restano compilati**: prima la conferma si svuotava e un nuovo clic su "Salva nuova password" non faceva niente, perché il campo era obbligatorio e vuoto.
- I messaggi sono più precisi: "La nuova password deve essere diversa da quella attuale", "Questa password è troppo debole o compare in elenchi di password rubate", "almeno 6 caratteri" solo quando è davvero quello il motivo. Prima qualunque errore che nominava la password diceva "almeno 6 caratteri".

**Note tecniche:** il campo di conferma è controllato come il primo (React 19 svuota i campi non controllati dopo ogni invio di una Server Action). `translateAuthError` distingue "different from the old password", password debole/compromessa e lunghezza minima. Due nuovi test e2e in `password-reset.spec.ts`. Nessuna migrazione.

---

## 2026-10-02 (37)

### Occhio per mostrare la password

**Cosa fa:**
- Ogni campo password ha un **occhio** a destra che mostra o nasconde i caratteri: login, registrazione, nuova password dopo il reset, master password (creazione, sblocco, conferma), approvazione di un nuovo dispositivo, blocco del dispositivo, cancellazione e azzeramento dell'account.
- Parte sempre nascosto e ogni campo ha il suo occhio; premerlo non invia il form. Il pulsante si legge come "Mostra caratteri" / "Nascondi caratteri".

**Note tecniche:** nuovo componente `PasswordInput` (`components/ui`), usato da `TextField` quando `type="password"` e direttamente nei tre campi che non usavano `TextField`. Il padding a destra è inline perché `cn()` non risolve i conflitti tra utility Tailwind. Il nome del pulsante evita la parola "password" per non essere trovato da chi cerca il campo (`getByLabel("Password")` negli e2e). Nessuna migrazione.

---

## 2026-10-02 (36)

### Login: dopo una password sbagliata l'email resta nel campo

**Cosa fa:**
- Se sbagli la password al login, **l'email resta scritta** e basta riscrivere la password. Prima tutti e due i campi si svuotavano: premendo di nuovo "Accedi" senza riscrivere non partiva niente (i campi sono obbligatori) e sembrava che il login fosse bloccato.
- La password si svuota comunque, per scelta.

**Note tecniche:** non era un blocco del secondo invio, come si sospettava: riprodotto con Playwright, un secondo invio con i campi riscritti arrivava alla dashboard. La causa era il reset dei campi che React 19 fa dopo ogni Server Action. `signIn` restituisce l'email inviata nello stato di errore (`AuthActionState.email`) e la pagina di login la usa come `defaultValue`. Nuovo test e2e `login-retry.spec.ts`. Nessuna migrazione.

---

## 2026-10-02 (35)

### Content Intelligence: i documenti Word (.docx) si leggono sul dispositivo

**Cosa fa:**
- Un file **Word (.docx)** caricato in Archivio viene **letto sul dispositivo**, come un PDF: il testo entra nella ricerca e può essere analizzato con Hinthia ("Chiedi a Hinthia"), che ne ricava tipo, scadenza, emittente, campi ed eventi.
- Si legge tutto il testo del documento: paragrafi, **tabelle** (una riga per riga, celle separate da " | "), **intestazioni e piè di pagina** (dove spesso c'è l'emittente). Il testo cancellato con le revisioni non conta.
- Un DOCX non ha pagine fisse, quindi la provenienza di un dato dice **"nel testo"** invece di "pagina N", e non c'è la pagina originale da mostrare: si vede il testo letto con la frase evidenziata.
- I documenti Word già salvati prima risultano **"da leggere"** e si leggono con "Rileggi" come gli altri.
- Un file Word che arriva dal browser **senza tipo** (succede dove Word non è installato) viene riconosciuto dall'estensione.
- Un file rovinato, protetto da password o non Word semplicemente non produce testo: si salva comunque.

**Note tecniche:** nessuna libreria nuova. `lib/zip.ts` legge l'indice dello ZIP e apre le voci con `DecompressionStream` (con tetto di 30 MB per voce, controllato su ciò che esce davvero, contro gli archivi costruiti per esplodere in memoria; niente ZIP64 né cifratura). `domain/extraction/docx-extractor.ts` legge `word/document.xml`, intestazioni e piè di pagina e `docProps/core.xml` (titolo, autore, data dichiarati dal file). `lib/file-mime.ts` (`mimeTypeOfFile`) sostituisce `file.type || "application/octet-stream"` in caricamento singolo, multiplo e nel repository. Solo `.docx`: il vecchio `.doc`, XLSX e PPTX restano fuori (MVP-2). Nessuna migrazione.

---

## 2026-10-02 (34)

### Content Intelligence: la pagina originale del PDF con la frase evidenziata

**Cosa fa:**
- Per un PDF, cliccando **"pagina N"** nel riquadro "Cosa ha letto Hinthia" si apre la **pagina originale del documento**, disegnata com'è (impaginazione, immagini), con la **frase che prova il dato evidenziata** e la pagina scorsa fino a lì.
- Un link sotto la pagina permette di passare al **testo letto** (quello inviato a Hinthia) e di tornare alla pagina.
- Se la frase non si riesce a indicare sulla pagina (per esempio una scansione letta con l'OCR), la pagina si vede comunque, con una nota che rimanda al testo letto. Se la pagina non si può disegnare, si vede il testo letto come prima.
- Per immagini, note e documenti letti senza pagine resta il testo letto.

**Note tecniche:** il file si decifra e si disegna sul dispositivo con lo stesso pdf.js dell'anteprima (`renderPdfPageWithText` in `lib/pdf.ts`), quindi nulla esce dal dispositivo. `locateQuote` e `highlightRects` (`domain/ai/analysis/page-highlight.ts`) cercano la frase tra gli elementi di testo della pagina ignorando spazi e maiuscole e la posizionano in percentuale dell'immagine, proporzionalmente ai caratteri dentro ogni elemento: l'evidenziazione è un'approssimazione e il testo ruotato non è evidenziato. I byte del PDF si scaricano una sola volta per tutte le pagine aperte. Nessuna migrazione.

---

## 2026-10-02 (33)

### Content Intelligence: "Cosa ha letto Hinthia" con tipo, dati e pagina d'origine

**Cosa fa:**
- In "Chiedi a Hinthia", sotto le proposte, un nuovo riquadro **"Cosa ha letto Hinthia"** mostra il **tipo di documento** riconosciuto (contratto, polizza assicurativa, fattura... oppure "Documento generico", senza fingere di averlo riconosciuto) e tutti i dati ricavati: categoria, scadenza, emittente, campi del tipo, eventi da ricordare.
- Ogni dato dice **da dove viene**: etichetta **"Letto da Hinthia"** se è solo una lettura, **"Nella Scheda"** (o **"In Scadenze"** per un evento) se l'hai già fatto tuo, più la frase del documento che lo prova.
- La **pagina d'origine è cliccabile**: "pagina 2" apre il testo letto di quella pagina con la frase evidenziata (per i documenti letti senza pagine, "nel testo" apre la sezione). Se il testo è cambiato dopo la lettura, resta una semplice etichetta.
- Una nota ricorda che ogni dato è stato controllato nel testo del documento e, se il documento è molto lungo, quante parti sono state lette su quante.
- La **sintesi** è ora marcata **"Generata da Hinthia"**, con l'avviso che è un riassunto e non una citazione.

**Sulla confidenza:** il modello non restituisce un punteggio e non ne inventiamo uno: un dato compare solo se la sua citazione è stata ritrovata nel testo, altrimenti viene scartato. La "confidenza" mostrata è questa verifica.

**Note tecniche:** `buildAnalysisOverview` (`domain/ai/analysis/overview.ts`) costruisce il modello di visualizzazione dalla lettura salvata; `splitAroundQuote` (`source.ts`) trova la frase nel testo con la stessa tolleranza agli spazi della validazione; `AnalysisOverviewSection` riusa `prepareAnalysis` per ritrovare i segmenti per id. Nessuna migrazione.

---

## 2026-10-02 (32)

### Content Intelligence: gli eventi con data diventano promemoria in Scadenze

**Cosa fa:**
- Quando Claude legge un documento ora cerca anche gli **eventi con una data futura da ricordare** (un appuntamento, una visita, un rinnovo da disdire): ognuno compare tra le Proposte come "Da ricordare", con titolo breve, data e la pagina da cui viene.
- Il pulsante **Aggiungi a Scadenze** crea la scadenza collegata al documento; "Annulla" la rimuove. Si può correggere la data prima di aggiungere, o rifiutare l'evento (non ricompare).
- Non vengono proposti gli eventi già passati né quelli la cui data è già in Scadenze per quel documento. Le date di emissione, stipula o decorrenza e la scadenza del documento stesso non sono eventi.
- Gli eventi non entrano in "Accetta tutto": ognuno si aggiunge di proposito.
- Per verificarli valgono le stesse regole di tutta la lettura: la citazione deve comparire nel testo indicato e la data deve essere coerente con essa, altrimenti l'evento viene scartato.
- Il registro attività riporta "Evento verso Scadenze" senza mai scrivere il contenuto.

**Da sapere:**
- I documenti già letti risultano **da rileggere** (la versione della lettura è salita a 2): gli eventi compaiono dopo una nuova lettura.
- Due eventi nello stesso giorno vengono fusi in uno.

**Note tecniche:** `ProposalKind` "event" con `eventTitle`; `RawEventEvidence`/`ValidatedEvent`; `ANALYSIS_PIPELINE_VERSION = 2`; `createReminder` restituisce l'id; `listDocumentReminderDates` per l'esclusione dei duplicati. **Migrazione da applicare:** `20261004000000_proposal_rejections_event_kind.sql` (senza, rifiutare un evento fallisce).

---

## 2026-10-02 (31)

### Menu Impostazioni a due livelli (Autenticazione e Aspetto)

**Cosa fa:**
- Le voci che raccolgono più funzioni ora le mostrano come **sottovoci con icona**: una funzione alla volta, a tutta larghezza.
- **Autenticazione** (prima "Sicurezza", che ripeteva il nome del gruppo): App Authenticator e Dispositivi fidati.
- **Aspetto**: Tema, Disposizione menu, Voci del menu, Barra in basso, Liste, Capsule, Archivio.
- Da computer le sottovoci compaiono sotto la voce aperta; da smartphone la voce apre prima l'elenco delle sue funzioni, poi la funzione scelta, con il tasto indietro che risale di un livello.
- Le due liste di "Voci del menu" e "Barra in basso" si affiancano su schermi larghi.
- Le voci con una sola funzione restano com'erano.

**Note tecniche:** `TabDef.sections` in `SettingsTabs.tsx`; link diretti con `?tab=appearance&section=theme` (una sezione inesistente ricade sulla prima, `?tab=` da solo resta valido). Il pannello dei codici di backup resta dentro App Authenticator. Test e2e aggiornati ai nuovi nomi e al passaggio in più dei sottomenu.

---

## 2026-10-02 (30)

### Tolta la pagina Cronologia

**Cosa fa:**
- Sparisce la voce **Cronologia** dal menu e la pagina `/timeline` (l'elenco di documenti, beni, scadenze, amici e capsule per data di creazione, raggruppato per mese). La storia delle azioni è in **Impostazioni > Attività**.
- Resta la cronologia **dentro un fascicolo** (i suoi documenti per data).
- In Impostazioni > Aspetto non c'è più l'interruttore elenco/tabella per Cronologia.

**Note tecniche:** rimossi `TimelinePanel`, `lib/timeline.ts`, l'icona e i relativi test (unit ed e2e). Una eventuale preferenza `timeline` già salvata in `profiles.list_view_preferences` viene ignorata dal parser, senza migrazione.

---

## 2026-10-01 (29)

### Registro eventi ridisegnato: tutto in Impostazioni > Attività, con filtri

**Cosa fa:**
- **Ogni evento su un elemento** (contenuti dell'Archivio, Beni, Amici, Capsule, Fascicoli, Categorie) è registrato **agganciato a quell'elemento**. Gli eventi di sistema (accessi, sicurezza, dispositivi fidati, eredità digitale) restano senza elemento. Le Scadenze sono derivate e non hanno eventi propri.
- **Impostazioni > Attività** è l'unico posto dove si consulta il registro: tabella **impaginata dal server** (20/50/100 righe per pagina), caricata subito, con colonna **Elemento** (nome in chiaro a vault sbloccato; per un elemento eliminato definitivamente, il suo titolo con "(eliminato)").
- **Form di filtro**: periodo (da/a e scorciatoie "Ultimi 7/30 giorni"), area, tipo di evento a scelta multipla (ristretto all'area), elemento scelto da un elenco. I filtri attivi compaiono come chip rimovibili, con "Azzera filtri", e **vivono nell'URL** (si condividono, resistono al ricarica).
- Clic su una riga: pannello di dettaglio, con "Mostra tutte le attività di questo elemento".
- La scheda **Cronologia** nel dettaglio di un contenuto è stata tolta; al suo posto il link "Vedi attività di questo contenuto →" apre Attività già filtrata.
- Le letture di Hinthia tornano visibili in Attività.
- Se la scrittura di un evento fallisce compare un avviso, invece di perderlo in silenzio.
- Si riparte da zero: gli eventi precedenti sono stati cancellati.

**Note tecniche:**
- Migrazione `20261003000000_audit_entity_events.sql` (da applicare al DB v3: **svuota** `audit_events`, toglie il CHECK sui tipi, aggiunge `entity_type`, `entity_id`, `encrypted_label` e gli indici; rende superata `20261002000000`). I tipi di evento sono validati nel codice (`AuditEventType`).
- Zero-knowledge: il server vede solo tipo, metadati tecnici e riferimento (tipo + id). Il titolo cifrato con la master key sta in `encrypted_label` solo negli eventi di eliminazione definitiva. Il server non può cercare per nome: si sceglie l'elemento da un elenco decifrato nel browser e si filtra per id.
- `logAuditEvent(supabase, ownerId, type, metadata?, entity?)` restituisce un booleano ed emette `hinthial:audit-write-failed` su errore. Filtri in `domain/audit/filters.ts` (parse/serializzazione dell'URL, tolleranti a parametri non validi).
- Rimossi `DocumentHistorySection`, `document-history.ts` e il relativo test.

---

## 2026-10-01 (28)

### Cronologia del contenuto completa; Attività solo per il resto

**Cosa fa:**
- La scheda **Cronologia** di un contenuto registra anche i **salvataggi**: dettagli della scheda, testo della nota, trascrizione, esclusione da Hinthia (escluso/riammesso) e lettura di Hinthia salvata. Il dettaglio dice quale.
- La **rilettura sul dispositivo** compare come "Testo riletto sul dispositivo", distinta dalla prima lettura ("Testo letto sul dispositivo").
- Gli eventi legati a un contenuto compaiono **solo** nella sua Cronologia; **Impostazioni > Attività** mostra gli eventi non collegati a un contenuto (accessi, sicurezza, amici, capsule, ecc.). Il link "Vedi tutto" nella Cronologia è stato tolto.

**Note tecniche:**
- Nessuna nuova migrazione: i salvataggi usano `document_updated` con `change` (e `excluded`) nei metadati; la rilettura usa `reread` su `document_text_read`. Mai nomi o valori.
- `listAuditEvents` esclude le righe con `metadata->>documentId`; gli eventi registrati prima della Cronologia per documento non hanno quell'id e restano visibili in Attività. Anche le letture di Hinthia (`ai_extraction_used`) sono ora solo nella Cronologia del contenuto.

---

## 2026-10-01 (27)

### Cronologia per documento

**Cosa fa:**
- Nel dettaglio di ogni contenuto dell'Archivio compare la scheda **Cronologia** (dopo "Chiedi a Hinthia"): le ultime azioni fatte su quel contenuto (aggiunto, modificato, scaricato, testo letto sul dispositivo, letto da Hinthia, proposta accettata/rifiutata/annullata, spostato nel cestino, ripristinato), ognuna con data e ora. Più letture di Hinthia ravvicinate (una per blocco di testo) compaiono come una sola.
- **"Vedi tutto"** apre Impostazioni > Attività, il registro completo. Impostazioni ora accetta `?tab=` per aprirsi su una scheda precisa.
- Le proposte dicono **quale** proposta riguardavano (Scadenza, Categoria, Emittente, o il nome del campo), così più "Proposta accettata" di fila non sono più indistinguibili; vale anche per Impostazioni > Attività.
- La lettura di Hinthia distingue **"Documento letto"** (prima volta) da **"Documento riletto"** (Rileggi da capo / nuova lettura di un documento già letto).
- Gli eventi registrati prima di questa modifica restano con la dicitura generica.
- Nessun nome di file né valore compare nella cronologia: solo il tipo di azione, il tipo/nome di campo del vocabolario e la data. Nessuna nuova migrazione.

**Note tecniche:** gli eventi su un contenuto portano `documentId` (UUID, identificativo tecnico) nei metadati di `audit_events`; la cronologia legge con `metadata->>documentId`. Tre nuovi tipi evento (`document_updated`, `document_downloaded`, `document_text_read`): migration additiva `20261002000000_document_history_events.sql` (ricrea il check constraint e aggiunge un indice parziale sul documentId). Cestino/ripristino registrano una riga per documento. Gli eventi precedenti a questa versione non hanno `documentId` e non compaiono nella cronologia del documento. La migration va applicata al database v3 prima di usare la funzione (senza, i nuovi eventi vengono scartati in silenzio, come ogni errore di audit).

---

## 2026-10-01 (26)

### Rifiniture alla ricerca, interruttore elenco/tabella a destra, rimossa la sezione "Novità"

**Cosa fa:**
- Il modale della ricerca (Ctrl+K) ora **oscura tutta la pagina**, comprese le icone dei file in Archivio che prima restavano in primo piano: la finestra è montata direttamente nel `body` e non più dentro la barra di navigazione.
- Le scorciatoie in fondo al modale (↑ ↓, Tab, Invio, Esc) hanno la **cornice** come i tasti; tolta la frase "Cerca sul tuo dispositivo, niente esce".
- L'interruttore **elenco/tabella** delle pagine principali è allineato a destra.
- **Novità eliminata**: voce di menu, pagina `/updates`, componente e codice di dominio. Le preferenze di navigazione già salvate che citano la voce vengono ignorate (il parser scarta gli href non più validi).

**Note tecniche:** le migration `product_updates` e i tipi generati in `src/types/supabase.ts` restano (le migration sono additive e immutabili); la tabella non viene più letta da nessuno.

---

## 2026-10-01 (25)

### Ricerca unificata (Ctrl+K) --- un solo punto di ricerca, anche dentro il testo letto dei documenti

**Cosa fa:**
- La ricerca è ora **un solo posto**: la finestra che si apre con **Ctrl+K** (o dal pulsante "Cerca…" nella navigazione). I campi di ricerca sono stati tolti da Archivio, Beni, Scadenze, Amici e Capsule, che mantengono i propri filtri (categoria, stato, tag).
- La finestra mostra i **chip per area** (Tutto, Archivio, Scadenze, Beni, Amici, Capsule) con il conteggio dei risultati, e i risultati raggruppati per area; in "Tutto" ogni area mostra i primi 3 e un pulsante **Mostra tutti (N)**.
- Si trova per **nome**, per **etichette** (categoria, emittente, tag, ruolo, email, bene collegato) e **dentro il contenuto**: testo letto dei documenti, note, trascrizioni, contenuto delle capsule. Quando il motivo è nel contenuto compare un frammento con la parola evidenziata e l'origine ("Nel testo", "Nelle note", "Trascrizione", "Nel contenuto").
- **Tutte le parole digitate devono comparire** (prima bastava una), senza distinguere maiuscole e accenti; i risultati col nome corrispondente vengono prima di quelli per etichetta, e poi di quelli per contenuto.
- Tastiera: frecce, Invio, Esc, **Tab / Maiusc+Tab** per cambiare area. Se un'area non ha risultati ma altre sì, il messaggio lo dice ("ce ne sono N altrove: prova Tutto").
- I **Fascicoli** hanno ancora il loro campo di ricerca (non sono coperti dalla ricerca unificata).

**Note tecniche:** nuovo modulo `src/domain/search/unified-search.ts` (funzioni pure: `searchEverything`, `countByArea`), separato da `mockAIProvider.search`, che resta invariato per il pannello AI. Tutto avviene in memoria sul contesto già decifrato (`buildAIContext`, ricaricato a ogni apertura): nessuna nuova query, niente esce dal dispositivo. Nessun "Recenti" persistente: sarebbe testo digitato in chiaro da conservare. Test: `tests/unit/search/unified-search.test.ts` e gli e2e `global-search`, `list-filters`, `archive-search-inside-pdf`, `archive-ocr-image`, `transcription` (con l'helper `tests/e2e/search-helpers.ts`).

---

## 2026-10-01 (24)

### Pulizia dell'Archivio e della scheda documento --- "Scarica", "Rileggi da capo" in evidenza, meno rumore dalle proposte locali

**Cosa fa:**
- Nel menu di ogni riga dell'Archivio la voce per i file è ora **Scarica** invece di "Apri" (scaricava già: il dettaglio si apre dal nome). Per le note resta "Apri/Chiudi", che è l'anteprima in riga.
- Nella scheda "Chiedi a Hinthia" **Rileggi da capo** è un pulsante con il bordo, non più un link piccolo: è un'azione che costa una lettura.
- Se Hinthia ha già letto un documento, le **proposte calcolate sul dispositivo** (scheda "Letto dal dispositivo") non vengono più mostrate, perché quelle di Hinthia sono più affidabili; resta una riga che lo spiega, con il collegamento a "Chiedi a Hinthia". Per i documenti che Hinthia non ha letto non cambia nulla: lì le regole locali sono l'unica via, e restano interamente sul dispositivo.

- Se Hinthia ha già letto il documento, anche **"Cosa ne ho ricavato"** (i valori chiave-valore ricavati sul dispositivo) non viene più mostrato; resta "Cosa ho letto", cioè il testo.
- **Indicatore di attività** (nuovo `Spinner`): "Rileggi" in "Letto dal dispositivo" mostra ora una barra di avanzamento con la percentuale; "Chiedi a Hinthia" / "Rileggi da capo" mostra sempre "Hinthia sta leggendo il documento…" (prima, per i documenti brevi, in una sola parte, non appariva nulla).
- **"Risposta di Hinthia non valida" meno frequente:** l'output del modello che arriva come testo JSON invece che come struttura viene rimesso in forma, e se è comunque fuori schema si riprova una volta. Il server registra (solo forma e `stop_reason`, mai contenuti) perché una risposta è stata scartata.

**Note tecniche:** `ArchiveItemDetail` separa `localCandidates` (sempre calcolate) da `localProposals` (vuote se `doc.contentAnalysis` esiste); "Cosa ne ho ricavato" continua a filtrare contro i candidati locali, così i valori già proposti non ricompaiono come semplici fatti. Il test e2e `archive.spec.ts` cerca ora la voce "Scarica".

---

## 2026-10-01 (23)

### Content Intelligence, PR3 (passo B) --- Hinthia cita la pagina, e le pagine lette si salvano cifrate

**Cosa fa:** quando carichi un PDF o un'immagine, le pagine lette sul dispositivo vengono conservate (cifrate, come tutto il resto) e Hinthia le usa per dire **da quale pagina** viene ogni informazione ("pagina 3", con la frase citata) invece di una generica "sezione". I documenti caricati prima non hanno le pagine: per loro c'è **Rileggi**, che le ricostruisce. Le pagine non entrano nell'esportazione e spariscono con il documento: eliminazione definitiva, svuotamento del Cestino, "Cancella tutto" (ora anche per i documenti già nel Cestino, che prima lasciavano i file in Storage) e cancellazione dell'account.

**Dove si vede:** accanto alla citazione di ogni proposta di Hinthia compare il badge "Pagina N" (solo se il documento è stato letto per pagine; per le sezioni non compare). Nella prima versione del passo B la pagina veniva calcolata e salvata ma non mostrata: corretto con `Proposal.page` e `ProposalsSection`.

**Attenzione:** le letture di Hinthia già salvate su un documento con le pagine diventano "da rifare" alla prima apertura, perché la fonte del testo è cambiata (pagine invece di sezioni): il pulsante lo dice prima di spendere qualcosa.

**Note tecniche:** blob `{storagePath}-segments.json` (`documentSegmentsPath`), cifrato con la Master Key, nessuna migration né colonna; `src/domain/documents/segments.ts` (cifratura, validazione contro `extractedText`, salvataggio/lettura/rimozione best-effort). Se i segmenti non ricompongono esattamente il testo salvato non si usano e l'analisi ricade sulle sezioni. `ArchiveItemDetail` e `CreateArchiveItemForm` li caricano con `useDocumentSegments` e, al click su "Chiedi a Hinthia", rileggono pagine e stato della lettura salvata invece di fidarsi dello stato (evita di rifare e pagare una lettura completa se il caricamento non era ancora finito). `wipeVault` ora legge i percorsi con una query leggera su tutti i documenti dell'utente (Cestino incluso). Test in `tests/unit/documents/segments.test.ts`.

---

## 2026-10-01 (22)

### Content Intelligence, PR3 --- "Accetta tutto" anche nella tab di Hinthia

**Cosa fa:** quando Hinthia trova almeno due informazioni da aggiungere (scadenza, emittente, categoria, campi), nella tab di Hinthia compare in cima alle proposte "Hinthia ha trovato N informazioni da aggiungere alla Scheda" con il pulsante **Accetta tutto**. Prima il pulsante esisteva solo nella tab Scheda. Una sola proposta per tipo (per i campi, per chiave); l'azione si può annullare in blocco come quella già esistente.

**Note tecniche:** `ProposalsSection` accetta `acceptAllCount` e `onAcceptAll` (opzionali: le proposte locali non li passano). `onePerSlot` in `ArchiveItemDetail.tsx` è condiviso con la tab Scheda; il pulsante riusa `handleAcceptAll`. Test in `tests/unit/proposals-section.test.tsx`.

---

## 2026-10-01 (21)

### Content Intelligence, PR3 (passo A) --- la lettura di Hinthia si salva, si riprende e non si paga due volte

**Cosa fa:**
- Ciò che Hinthia legge in un documento **non si perde più** chiudendo o ricaricando la pagina: le proposte, la sintesi e il tipo riconosciuto tornano da soli all'apertura della scheda.
- Con un documento lungo la lettura si salva **dopo ogni parte**. Se si chiude la pagina, si preme **Interrompi** o c'è un errore, il pulsante diventa "Riprendi la lettura (X di N)" e riparte dalla parte mancante, non dall'inizio.
- Se la lettura è completa, la scheda dice "Hinthia ha già letto questo documento il …" e **non invia niente** né spende richieste. Se mancava solo la sintesi finale, "Prepara la sintesi finale" rifà solo quel passo.
- **Rileggi da capo** ignora la lettura salvata e rilegge tutto (anche per i documenti già nell'archivio, che non hanno ancora una lettura salvata). Se il testo del documento cambia, la lettura salvata non vale più e la scheda lo dice.

**Note tecniche:** migration additiva `20261001000000_content_analysis_persistence.sql` (da applicare **prima** del codice: `listDocuments` legge le nuove colonne). `documents.encrypted_content_analysis` è cifrata con la Master Key; `analysis_status` (pending/failed/partial/completed) è l'unica parte in chiaro e non dice nulla del contenuto. L'impronta di idempotenza (testo dei blocchi + versioni di schema/pipeline + modelli) sta *dentro* il blocco cifrato ed è un HMAC-SHA256; la chiave HMAC si deriva dalla Master Key cifrando un'etichetta fissa con IV fisso (costruzione non standard, accettabile perché serve solo a un confronto locale e l'output non lascia il dispositivo). Codice in `domain/ai/analysis/persisted.ts`, `pipeline.ts`, `lib/crypto/fingerprint.ts`, `domain/ai/analyze-document.ts`, `domain/documents/repository.ts` (`saveContentAnalysis`). Test in `tests/unit/ai/persisted-analysis.test.ts`.

**Limite noto:** finché il passo B non salva i segmenti per pagina, i documenti ricavano sezioni dal testo (provenienza = sezione, non pagina); al passo B l'impronta cambierà e servirà un "Rileggi". Cestino, eliminazione definitiva, "Cancella tutto", cancella account ed esportazione non coprono ancora i segmenti (passo B).

---

## 2026-10-01 (20)

### Content Intelligence, PR2 --- ritocchi dopo la prova: avanzamento della lettura e categoria più affidabile

**Cosa fa:**
- Con un documento lungo, mentre Hinthia legge compare ora una **barra di avanzamento** con "Leggo la parte X di N…" e, alla fine, "Letto tutto: preparo la sintesi…". Prima, dopo la conferma, la pagina non mostrava nulla. Vale sia sulla scheda del documento sia nel wizard di creazione. Un documento breve (una sola parte) resta com'è: solo "Sto leggendo…".
- La **categoria** proposta per un documento in più parti non è più quella del primo blocco (una copertina o un indice potevano fuorviare), ma quella proposta dal maggior numero di parti; a parità vince la più vicina all'inizio. Inoltre a Hinthia viene chiesto di scegliere la categoria per il tipo di documento nel suo insieme e non per una parola isolata, e di non proporne nessuna se non è davvero adatta o se il blocco non basta per deciderlo.

**Note tecniche:** `analyzeDocumentWithClaude` accetta `onProgress` (fasi `reading`/`merging`), mostrato da `AIAnalysisTrigger`; il voto sulla categoria sta in `domain/ai/analysis/merge.ts`, il testo del prompt in `lib/ai/claude-analysis-provider.ts`. Test aggiunti in `tests/unit/ai/analyze-document.test.ts` (avanzamento a due parti, a una parte, voto della categoria).

**Limite noto:** la categoria dipende anche da come l'utente ha chiamato le sue categorie: a Hinthia arrivano solo i nomi. Se i risultati restano imprecisi, il passo successivo è dare a ogni categoria una breve descrizione.

---

## 2026-10-01 (19)

### Content Intelligence, PR2 --- analisi di Hinthia a blocchi, con la provenienza di ogni lettura

**Cosa fa:**
- Quando chiedi a Hinthia di leggere un documento, ora il testo parte **a parti** (al massimo circa 12.000 caratteri per richiesta) invece che in un colpo solo, quindi anche un documento lungo viene letto per intero e non solo nella parte iniziale. Il messaggio di conferma prima dell'invio dice in quante parti parte; per i documenti molto lunghi avvisa che se ne leggono solo le prime.
- Ogni cosa che Hinthia ricava (scadenza, emittente, categoria, campi come numero di polizza o importo) porta con sé la **citazione esatta** e il **punto del documento** da cui viene. Una lettura la cui citazione non c'è davvero in quel punto, o il cui valore non è quello che la citazione dice (per esempio una data diversa), viene scartata: come prima, un campo mancante costa meno di uno inventato.
- Hinthia riconosce il **tipo di documento** (contratto, referto, fattura, bolletta, polizza, altro) e cerca i campi tipici di quel tipo.
- Per un documento in più parti la sintesi è una sola, fusa dalle sintesi delle singole parti.
- Cosa vedi oggi: le proposte e la sintesi funzionano come prima. Il punto di provenienza (pagina) e il tipo riconosciuto ancora non si vedono: arrivano con l'interfaccia della PR4.

**Note tecniche:** `src/domain/ai/analysis/` (nuovo): `schemas.ts` (registro statico dei tipi, tipo sconosciuto = `generico`), `blocks.ts` (segmenti, blocchi con marcatori `[[id]]`, `MAX_BLOCK_CHARS` 12.000, `MAX_BLOCKS_PER_DOCUMENT` 20), `result.ts` (controllo di forma dell'output strutturato), `validate.ts` (citazione nel segmento indicato + coerenza valore/citazione, date rilette e confrontate in forma normalizzata), `merge.ts`, `types.ts` (interfaccia `AnalysisProvider`). `src/lib/ai/claude-analysis-provider.ts` è l'unico punto che parla con Anthropic per l'analisi: output via tool use forzato (sostituisce `parseClaudeJson`, rimosso con il suo test), modello per stadio in una costante (oggi Haiku 4.5 per blocchi e fusione). `/api/ai/analyze` ora accetta una richiesta per blocco (`mode: "block"`) o per fusione delle sintesi (`mode: "merge"`), mai un documento intero; i controlli di consenso e il loro ordine sono invariati (503 per chiave mancante resta prima di ogni chiamata). `ai_extraction_used` viene registrato per ogni richiesta che porta contenuto fuori, senza contenuti. La verifica delle citazioni resta sul client, che ha i segmenti. Nessuna migration, nessuna variabile d'ambiente nuova.

**Limiti noti:** finché i segmenti non vengono salvati (PR3), l'analisi di un documento già archiviato ricava le sezioni dal testo e la provenienza è la *sezione*, non la pagina; il codice per la pagina c'è ed è testato. Il tetto di costo per sessione (100 richieste) vive nella pagina aperta: è un freno contro un'analisi lanciata per errore, non una difesa lato server. Se un blocco a metà documento fallisce, l'analisi si interrompe con un errore e le letture dei blocchi precedenti non vengono mostrate. Un campo con lo stesso nome ma valori diversi in punti diversi tiene il primo. Un audit di un documento lungo conta una voce per richiesta. Il test e2e `ai-content-analysis.spec.ts` non è stato rieseguito (richiede la chiave API assente).

---

## 2026-09-30 (18)

### Content Intelligence, PR1 --- il contenuto si legge per pagina (nessun cambiamento visibile)

**Cosa fa:**
- Quando Hinthial legge un PDF o una foto sul dispositivo, ora tiene il testo **pagina per pagina** (con il numero reale della pagina) invece che come un unico blocco, e registra anche la **lingua** del testo e alcune **informazioni tecniche** del file (numero di pagine, dimensioni dell'immagine, titolo/autore/data di creazione dichiarati dal PDF, marca e modello della fotocamera, data di scatto).
- Della posizione GPS di una foto si registra soltanto *se c'è*, mai le coordinate.
- Per chi usa l'app nulla cambia: ricerca, testo mostrato e analisi di Claude funzionano come prima. È la base per le PR successive (analisi a blocchi con citazione della pagina, salvataggio cifrato, interfaccia).

**Note tecniche:** nuovo tipo `ExtractedContent` (`text`, `language`, `segments`, `technical`, `extraction`) in `src/domain/extraction/types.ts`; `TextExtractor.extract()` diventa `extractContent()`. `extractText()` mantiene firma e risultato (`(await extractContent())?.text`), quindi i chiamanti esistenti non cambiano; `text` è identico a prima (pagine unite da una riga vuota, normalizzate, tetto `MAX_EXTRACTED_CHARS`), mentre i segmenti non sono tagliati dal tetto (che riguarda la sola ricerca). Le pagine senza testo non producono segmenti e non scorrono la numerazione. Moduli nuovi: `content.ts` (composizione), `language.ts` (stopword it/en/fr/de/es, null se incerta), `technical.ts` (PNG/JPEG/GIF/BMP/WebP-VP8X, EXIF, Info PDF). Nessuna migration, nessuna variabile d'ambiente, nessuna modifica all'AI.

**Limiti noti:** l'OCR vero non gira in jsdom, quindi il ramo `ocrTextExtractor.extractContent` è coperto solo dal typecheck e dalla verifica manuale; il test `main-nav.test.tsx` fallisce già prima di questa PR (cerca un link "AI" che ora si chiama "Hinthia").

---

## 2026-09-30 (17)

### Ambiente v3 avviabile anche in locale (`npm run dev:v3`)

**Cosa fa:**
- Con `npm run dev:v3` l'app gira sul PC (https://localhost:3000) collegata al progetto Supabase **v3**, senza toccare il database di sviluppo della v2. `npm run dev:https` continua a usare il Supabase di sviluppo.
- Passando da un ambiente all'altro la cache di sviluppo viene svuotata da sola, così l'app non resta collegata al database dell'ambiente precedente.

**Note tecniche:** `scripts/dev-v3.mjs` carica `.env.v3.local` in `process.env` (che ha la precedenza su `.env.local`) e avvia `next dev` in HTTPS; `--env-file` non è usabile perché Next lo rifiuta nei processi figli (`NODE_OPTIONS`). `scripts/env-target.mjs`, eseguito nei `predev*`, svuota `.next` quando cambia l'ambiente (marcatore `.next/.env-target`), perché le `NEXT_PUBLIC_*` sono incorporate nella cache. `.env.v3.local` (ignorato da git) contiene ora anche APP_URL locale, Resend, Google Drive, Anthropic e un `CRON_SECRET` proprio.

Verificato: il codice compilato da `dev:v3` contiene il riferimento al Supabase v3 e nessuno a quello di sviluppo.

---

## 2026-09-30 (16)

### Inserimento contenuto: niente striscia sotto il "1" e momento "salvato" prima dei passi di Hinthial

**Cosa fa:**
- Quando si apre "Nuovo contenuto" e c'è solo il primo passo, sotto il cerchio "1" non parte più la linea verde/grigia che finiva contro la cornice del pannello: la linea compare solo se c'è un passo successivo.
- Dopo "Aggiungi all'archivio" i passi 1-3 diventano spunte verdi e sotto i Dettagli compare per circa due secondi il momento **"Salvato e cifrato sul tuo dispositivo"** (cerchio verde che rimbalza con un anello che si espande e il segno che si disegna); poi si ripiega, compare la riga "Da qui in poi lavora Hinthial." e si apre il passo 4 "Lettura dal dispositivo", seguito dal 5 "Analisi di Hinthia". Con `prefers-reduced-motion` niente animazioni.

**Note tecniche:** `step 1` riceve `last={!mode}`; nuovo componente `SavedMoment` (stessa meccanica `.step-body` degli altri passi) pilotato dallo stato `savedMoment` (timer di 1,8 s), durante il quale il passo 4 resta "todo"; keyframe `saved-pop`/`saved-ring` in `globals.css`. Nessun test e2e modificato: `archive-title-and-mobile-add` e `archive-accept-all` passano invariati (l'attesa di default di 5 s copre la pausa).

Verificato: typecheck, lint, e2e archive-title-and-mobile-add, archive-accept-all; controllo visivo con screenshot.

---

## 2026-09-30 (15)

### Inserimento di un contenuto a fisarmonica fluida, in cinque passi

**Cosa fa:**
- Il form "Nuovo contenuto" è ora una **scheda unica a fisarmonica**: il passo completato diventa una spunta verde (il segno si disegna), la linea di collegamento si riempie di verde, il passo si ripiega in un riepilogo con "Modifica" e il successivo si apre in modo fluido. Con `prefers-reduced-motion` niente animazioni.
- Il terzo passo si chiama **"Dettagli"** (era "Aiutaci a ritrovarlo"): categoria, bene collegato, fascicoli, tag e note, come prima.
- Dopo il salvataggio la pagina non cambia più struttura: i primi tre passi restano visibili ma bloccati, sotto la riga "Salvato. Da qui in poi lavora Hinthial." si apre il passo **4 "Lettura dal dispositivo"** (caratteri letti e proposte trovate) e poi il **5 "Analisi di Hinthia"** (facoltativo). In fondo restano "Vai alla scheda del documento" e "Torna all'archivio".
- Su smartphone la linea di collegamento non c'è e il contenuto dei passi occupa tutta la larghezza.

**Note tecniche:** `AccordionStep` usa `grid-template-rows` 0fr→1fr (classi `.step-body/.step-inner/.step-check-path/.step-line-fill` in `globals.css`); il contenuto resta montato per la durata della chiusura (`inert` intanto) e poi si smonta. La riga "Aggiungi all'archivio / Annulla" sotto la scheda resta prima del salvataggio. Il test `archive-accept-all` ora aspetta "Letto sul dispositivo" prima di salvare: senza, il numero di informazioni trovate dipendeva da chi arrivava prima tra lettura e click (2 o 3). Tutti gli e2e che cliccavano "Aiutaci a ritrovarlo" usano "Dettagli"; `archive-title-and-mobile-add` verifica passi 4 e 5.

Verificato: typecheck, lint, e2e archive-title-and-mobile-add, archive-accept-all, archive-create-reads-file, document-categorization, assets, categories, dossiers, tags, reminders, capsules, onboarding-checklist, onboarding-status, list-filters, privacy-panel — passano.

## 2026-09-30 (14)

### Titolo in inserimento e modifica, "+" su smartphone con le scelte del desktop, form di inserimento impilato, Fascicoli/Cestino senza testo descrittivo

**Cosa fa:**
- In Archivio, le viste **Fascicolo** e **Cestino** non hanno più il paragrafo descrittivo sotto i tab: ci pensa il tasto Aiuto (che già riporta, per il Cestino, il periodo di conservazione).
- **Titolo**: in inserimento compare subito (non solo dopo aver scelto il file) anche per il caricamento di un file, e c'è ora anche per audio/video registrati (vuoto = nome della registrazione; l'estensione si conserva). Nella **Scheda** di un documento c'è un campo "Titolo" in cima: si modifica e si salva con "Salva modifiche" (un titolo vuoto non si salva).
- Su smartphone il **"+" blu dell'Archivio** non porta più direttamente a "Carica un file": apre le stesse scelte del tasto desktop (Carica un file, Registra audio/video, Scrivi una nota, Importa più file insieme).
- Su smartphone, nella schermata di inserimento, i pulsanti in fondo (Continua, Aggiungi all'archivio, Annulla, Scatta foto) occupano tutta la riga e stanno uno sotto l'altro, come già i campi; da tablet in su restano com'erano.

**Note tecniche:** `MobileAddFab` accetta un `menu` opzionale (voci `href/label/icon/separated`, `role="menu"`, chiusura al click fuori); gli altri usi (Beni, Capsule, ...) restano un semplice link. `DocumentsPanel` condivide con il tasto desktop la stessa lista `ADD_CONTENT_ITEMS`. `DocumentMetadataInput.title` (opzionale) fa ricifrare `encrypted_filename` in `updateDocumentMetadata`; il titolo di un documento è il suo nome file, quindi cambiarlo non tocca il contenuto. Nuovo `archive-title-and-mobile-add.spec.ts`.

Verificato: typecheck, lint, e2e archive-title-and-mobile-add, archive-accept-all, dossiers, bulk-select-and-trash, archive, archive-proposals, ai, document-categorization — passano. `archive-item-detail` "la scheda ricava data, emittente e scadenza" continua a fallire come prima (già noto).

## 2026-09-30 (13)

### Scheda documento: "Chiedi a Hinthia", "Accetta tutto", voci modificabili per tipo di dato, Scheda impilata su smartphone

**Cosa fa:**
- La tab "Analisi con Hinthia" si chiama ora **"Chiedi a Hinthia"**.
- Nella tab Scheda compare, quando ci sono informazioni trovate (dal dispositivo o da Hinthia), un riquadro "Hinthia ha trovato N informazioni da aggiungere alla Scheda" con il tasto **Accetta tutto**: le accetta in un colpo e un solo "Annulla" le rimette tutte com'erano.
- Le voci libere che finiscono in Scheda (numero polizza, data di nascita, ...) non sono più solo lette: si modificano come gli altri campi e si salvano con "Salva modifiche". Una data si sceglie dal calendario, il resto è testo. Anche il "Modifica" di una proposta usa il calendario quando il valore è una data.
- Su smartphone Categoria, Bene collegato, Scadenza, Fascicoli (select e bottone) stanno uno sotto l'altro a tutta larghezza; da tablet in su restano affiancati.

**Note tecniche:** "Accetta tutto" tiene una sola proposta per tipo (per "campo": per chiave; vince la prima, locale prima di Hinthia) ed esegue `acceptProposal` in sequenza, annullando in ordine inverso. Il tipo di una voce libera non è salvato: `inferFieldInputType` (`domain/structured-fields/value-type.ts`) lo deduce dal valore salvato (data YYYY-MM-DD valida → `type="date"`), e il prompt di lettura chiede ora a Claude di scrivere le date in quel formato. `updateDocumentMetadata` accetta `structuredFields` opzionale (sostituisce l'insieme, le voci svuotate si eliminano); `ArchiveItemDetail` le risincronizza da `doc` chiave per chiave. Nuovo `archive-accept-all.spec.ts` (lettura di Hinthia simulata con `page.route`, nessuna chiamata reale).

Verificato: typecheck, lint, build, e2e archive-accept-all, archive-proposals, archive-thumbnails, document-categorization — passano. `archive-item-detail` "la scheda ricava data, emittente e scadenza" fallisce già senza queste modifiche (verificato con stash): da indagare a parte. Non eseguiti ai-content-analysis/ai-extraction-consent (chiave API reale).

## 2026-09-30 (12)

### Archivio: il tasto Aiuto anche in Fascicoli e Cestino

**Cosa fa:** il tasto "Aiuto" (con Hinthia) che c'era solo in Contenuti compare ora anche nelle schede Fascicoli e Cestino, accanto al titolo "Archivio", con consigli propri di ciascuna (cosa raggruppa un fascicolo, come funziona il ripristino e la rimozione definitiva).

**Note tecniche:** `PageHelp` aggiunto in `DossiersPanel.tsx` (titolo "Fascicoli") e `TrashPanel.tsx` (titolo "Cestino"), stessa posizione che ha in `DocumentsPanel.tsx`. I paragrafi descrittivi sotto le schede restano. `dossiers.spec.ts` verifica il pannello in Fascicoli e la presenza del tasto in Cestino.

Verificato: typecheck, lint, e2e su fascicoli e cestino — passano.

## 2026-09-30 (11)

### Benvenuto dopo il login: wordmark, barra di caricamento, dissolvenza sulla Dashboard

**Cosa fa:** subito dopo un accesso (password, codice a 6 cifre o codice di backup) compare per circa 3 secondi una schermata con solo il wordmark di Hinthial al centro e una barra che si riempie sotto; a barra piena la schermata sfuma in mezzo secondo e appare la Dashboard. Si vede una volta sola per accesso: un refresh o un ritorno alla Dashboard più tardi non la mostrano di nuovo. Chi ha attiva la riduzione del movimento vede la barra già piena.

**Note tecniche:** nuovo `LoginSplash.tsx`; `auth/actions.ts` porta a `/dashboard?justLoggedIn=1` (`signIn`, `signUp` senza conferma email, `verifyMfaCode`); `DashboardPanel.tsx` legge il parametro una volta e lo toglie dall'URL con `router.replace` in un effetto. La Dashboard è già montata sotto l'overlay: la sfumatura rivela, non ricarica. Durata della barra (keyframe `login-splash-fill` in `globals.css`) e `LOADING_MS` in `LoginSplash.tsx` vanno cambiate insieme. Il redirect di guardia in `/login/mfa` resta a `/dashboard`: non è un accesso. Per i test e2e, che fanno decine di login e sarebbero bloccati dall'overlay, `DISABLE_LOGIN_SPLASH=1` (impostato in `playwright.config.ts`) fa tornare i redirect a `/dashboard` semplice; il nuovo `login-splash.spec.ts` apre `/dashboard?justLoggedIn=1` e verifica comparsa, scomparsa e assenza dopo un refresh.

Verificato: typecheck, lint, build di produzione, e2e su login-splash, auth-shell, dashboard-layout, mfa, archive, capsules — tutti passano (auth-shell alla seconda esecuzione: flake noto del modale "Più tardi").

## 2026-09-29 (10)

### Capsule: "Le mie / Condivise con me" nello stile dei tab di Archivio

**Cosa fa:** l'interruttore "Le mie" / "Condivise con me" in Capsule — prima due pulsanti a pillola — ha ora lo stesso stile a barra sottolineata dei tab di Archivio (Contenuti/Fascicolo/Cestino). Il titolo "Capsule" era già sopra e già fisso, quindi non è cambiato.

**Note tecniche:** `CapsulesPanel.tsx` — restano `<button>` con stato locale (`activeTab`), non `<Link>` come in `ArchiveTabs.tsx` (qui sono due viste della stessa pagina, non due route): `role="tab"` + `aria-selected` al posto di `aria-pressed`, stessa classe di `border-b-2`/colore di `ArchiveTabs.tsx`. Aggiornato l'unico test e2e che selezionava il vecchio `role="button"`.

Verificato: typecheck, lint, build di produzione, e2e su Capsule (creazione, condivisione, registrazione, anteprima) — tutti passano.

---

## 2026-09-29 (9)

### Archivio: il titolo torna sopra le schede, e resta sempre "Archivio"

**Cosa fa:** in Archivio, Fascicolo e Cestino il titolo della pagina era sotto le schede (Contenuti/Fascicolo/Cestino) e cambiava testo a seconda della scheda ("Archivio", "Fascicoli", "Cestino"). Ora è sopra le schede e resta sempre "Archivio" — sono le schede stesse a dire dove ci si trova, il titolo identifica la sezione nel suo insieme.

**Note tecniche:** in `DocumentsPanel.tsx`, `DossiersPanel.tsx` e `TrashPanel.tsx` la riga del titolo (con il bottone azione di ciascuna scheda, dove c'è: "+ Aggiungi contenuto" / "+ Nuovo fascicolo") è passata sopra `<ArchiveTabs />`; il testo descrittivo che stava sotto il vecchio titolo di Fascicolo e Cestino resta, ma sotto le schede, senza più un'intestazione propria. Aggiornati i 3 test e2e che controllavano ancora "Fascicoli"/"Cestino" come intestazione.

Verificato: typecheck, lint, build di produzione, e2e su Archivio/Fascicolo/Cestino, import in blocco, capsule e tag — tutti passano.

---

## 2026-09-29 (8)

### Archivio: "+ Aggiungi contenuto" e "Importa più file insieme" uniti in un solo bottone

**Cosa fa:** in Archivio, il bottone "+ Aggiungi contenuto" e il link secondario "Importa più file insieme" (prima due elementi separati nella stessa riga del titolo) sono diventati un solo bottone con una freccia, che apre un menu con quattro scelte: **Carica un file**, **Registra audio/video**, **Scrivi una nota**, **Importa più file insieme**. Le prime tre aprono la pagina "Nuovo contenuto" già sul passo giusto, invece di lasciar scegliere di nuovo la modalità lì dentro.

**Note tecniche:** il menu vive in `DocumentsPanel.tsx` (stesso pattern a tendina di `UserMenu.tsx`: stato locale, chiusura al click fuori). `CreateArchiveItemForm.tsx` legge un parametro opzionale `?mode=upload|record|note` all'apertura (una volta sola, con un ref di guardia) per preselezionare il passo 1 --- il comportamento di sempre (nessuna modalità pre-scelta) resta invariato quando si arriva da "Carica un file" o direttamente su `/archive/new` senza parametro.

Verificato: typecheck, lint, build di produzione. Aggiornati ~30 file di test e2e che cliccavano il vecchio link "+ Aggiungi contenuto" per navigare direttamente (ora prima aprono il menu, poi scelgono "Carica un file" o "Importa più file insieme"); corretta anche una collisione in `bulk-select-and-trash.spec.ts` dove una query generica su "Aggiungi" intercettava per sbaglio anche il nuovo bottone. Il sottoinsieme di test coinvolti (Archivio, import in blocco, capsule, tag) passa per intero.

---

## 2026-09-29 (7)

### Pannello Aiuto: arrivato anche in Archivio, corretto il posizionamento in Cronologia

**Cosa fa:** tre rifiniture alla voce precedente, dopo averla provata:

1. **Il pannello Aiuto arriva anche in Archivio** --- era rimasto fuori dall'elenco delle nove pagine, ma è proprio la pagina da cui è partita l'idea.
2. **In Cronologia il bottone Aiuto non è più attaccato al titolo**: ora è staccato all'altro capo della riga, come in tutte le altre pagine.
3. **In Cronologia l'interruttore elenco/tabella si è spostato dalla riga del titolo alla riga dei filtri** (accanto a "Data inizio", "Data fine" e "Filtra per sezione"), come nelle altre pagine che lo hanno (es. Scadenze).

**Note tecniche:** in `DocumentsPanel.tsx` il paragrafo descrittivo di Archivio lascia il posto al bottone Aiuto, mentre il link secondario "Importa più file insieme" resta dov'era (non era testo descrittivo, ma un'azione). In `TimelinePanel.tsx` la riga del titolo torna a un semplice `justify-between` (titolo a sinistra, Aiuto a destra, senza il contenitore intermedio che li teneva vicini); `ListViewToggle` si sposta nella riga dei filtri, che esiste solo quando ci sono elementi da mostrare --- stessa condizione che prima gestiva la sua visibilità, ora implicita nella posizione.

Verificato: typecheck, lint, build di produzione, e i test e2e su Cronologia, Archivio e le preferenze di visualizzazione --- tutti passano.

---

## 2026-09-29 (6)

### Pannello Aiuto di Hinthia (concept ibrido) su nove pagine, pulizia del trattino "---", icona cestino rimossa dai titoli

**Cosa fa:** tre interventi, dopo aver visto i concept del pannello Aiuto e aver scelto l'ibrido (Concept C):

1. **Il pannello Aiuto arriva su Dashboard, Hinthia, Scadenze, Beni, Amici, Capsule, Cronologia, Novità e Impostazioni** (una versione per ogni tab: Informazioni utente, Sicurezza, Eredità digitale, Scheda d'emergenza, Categorie, Tag, Aspetto, Attività, Importa/Esporta, Hinthia, Zona pericolosa). Ogni pagina perde il paragrafo descrittivo fisso sotto il titolo, sostituito da un bottone "Aiuto" con l'avatar di Hinthia: apre un pannello laterale (lo stesso pattern di scorrimento di "Attività") con 2-3 consigli statici sempre disponibili ("In breve") e, dove ha senso, un campo per fare una domanda vera a Hinthia. La pagina **Hinthia** (`/ai`) riceve solo la parte statica: essendo già per intero una chat, un secondo campo domanda nel pannello sarebbe ridondante.
2. **L'icona 🗑️ sparisce dal tab "Cestino" e dal titolo della sua pagina**, in Archivio --- resta solo la parola.
3. **Il trattino "---" (tre trattini) diventa un vero trattino tipografico (—)** in un giro su tutta l'app: era già così in centinaia di punti, dove funziona benissimo nei commenti del codice ma nei testi rivolti all'utente il browser lo mostrava alla lettera, tre trattini, non un em-dash.

**Note tecniche:** nuovo componente condiviso `src/components/help/PageHelp.tsx` --- il trigger e il pannello in uno solo, `tips` (array statico) più `chatEnabled` (default `true`, `false` per `/ai`). La domanda vera riusa esattamente il motore già dietro `/ai` (`buildAIContext`, `answerWithClaude`/`mockAIProvider`, lo stesso consenso `masterEnabled && chatConsent`) ma con una conversazione locale al pannello, non condivisa con `AIChatProvider`: si azzera lasciando la pagina, niente cronologia mescolata fra pagine diverse. Il campo domanda si disabilita da sé (un avviso al suo posto) quando la master key non è sbloccata, dato che `buildAIContext` ha bisogno di decifrare il vault --- `useMasterKey()`/`useAIProcessingConsent()` sono già forniti da `AppShell` su ogni pagina, quindi nessuna pagina ha dovuto passare `masterKey` a mano. In `SettingsTabs.tsx` un'unica mappa `TAB_HELP` copre le 13 tab: la maggior parte delle sotto-descrizioni di singoli controlli (es. le sei sezioni di "Aspetto") non sono state toccate --- sono etichette funzionali di un controllo specifico, non il paragrafo che descrive l'intera pagina, la sola cosa che questa richiesta voleva eliminare. In `FriendsPanel.tsx` il link funzionale "Vedi chi proteggi", prima dentro il paragrafo rimosso, resta come riga a parte sotto il titolo.

Il giro sul trattino ha toccato 89 righe in .tsx (testi rivolti all'utente: paragrafi, toast, errori, etichette, persino un paio di nomi di file scaricati) più una in un file .ts (un errore lanciato), individuate scrivendo un piccolo script che esclude i commenti (anche quelli su più righe) --- lasciate intenzionalmente intatte le centinaia di occorrenze rimaste nei commenti del codice, che non sono testo rivolto all'utente.

**Scoperta non cercata, ma da segnalare:** verificando un fallimento e2e ho trovato che `.env.local` ha ora una vera `ANTHROPIC_API_KEY` --- `ai-processing-consent.spec.ts` e `ai-extraction-consent.spec.ts` (pensati per girare senza chiave reale, aspettandosi l'errore "non ancora configurata") non sono più sicuri da eseguire: possono provare a contattare davvero Anthropic. Confermato con `git stash` che il fallimento è preesistente e indipendente da questo lavoro. Non esegui più questi due file finché la chiave resta configurata --- da valutare con l'utente se va rimossa da `.env.local` per i test, o se questi due file vanno riscritti per non dipendere dalla sua assenza.

Verificato: typecheck, lint, build di produzione, e un'ampia batteria di e2e sulle pagine toccate (dashboard, ai, reminders, assets, friends, capsules, categories, danger-zone, audit-log, privacy-panel, digital-legacy-settings, bulk-select-and-trash) --- tutti passano tranne i due fallimenti preesistenti già documentati altrove (OCR di archive-item-detail, celle vuote di table-sort) e i due file AI appena scoperti come non sicuri da eseguire.

---

## 2026-09-29 (5)

### Scheda documento --- barra azioni omogenea a sé, pulizia di badge e cornici ridondanti

**Cosa fa:** cinque rifiniture alla scheda del documento, dopo averla provata ancora:

1. **"Salva modifiche", "Scarica" ed "Elimina" hanno ora la stessa forma** (stessi angoli arrotondati, stesso peso) --- prima "Salva modifiche" aveva angoli diversi dagli altri due.
2. **I tre bottoni tornano in una barra a sé**, sopra al riquadro con Anteprima e le tab --- non più dentro la tab "Scheda": tutto il contenuto (Anteprima e le tre tab) sta sotto, non più sopra o accanto.
3. **Nella tab "Letto dal dispositivo"**, le due sezioni ("Cosa ne ho ricavato", "Cosa ho letto") non ripetono più "🔒 sul tuo dispositivo" --- il nome della tab lo dice già.
4. **Nella tab "Analisi con Hinthia"**, il bottone di richiesta lettura non dice più "il testo lascia il dispositivo" --- il nome della tab lo dice già, nell'altro senso.
5. **La stessa richiesta ("Chiedi a Hinthia di leggere questo documento") perde la sua cornice bianca propria** --- ora è già dentro il riquadro della tab, una cornice dentro un'altra cornice era ridondante.

**Note tecniche:** nessuna logica toccata. `AIAnalysisTrigger` perde solo il `<div>` esterno con `rounded-xl border ... bg-white ... p-3` (resta un `flex flex-col gap-2` semplice) e la riga "il testo lascia il dispositivo". `StructuredFieldsSection` e la sezione "Cosa ho letto" (in `ArchiveItemDetail.tsx`) perdono la riga "🔒 sul tuo dispositivo" e il contenitore flex che la affiancava al titolo, tornando a un semplice `<h2>`.

Verificato: typecheck, lint, build di produzione, e i test e2e sulla scheda documento (`archive-item-detail`, `archive-proposals`, `document-categorization`, `reminders`, `dossiers`, `archive`) --- tutti passano tranne il solito fallimento preesistente e indipendente già documentato (`archive-item-detail.spec.ts`, l'OCR di "AZIENDA OSPEDALIERA DI GUBBIO").

---

## 2026-09-29 (4)

### Scheda documento --- Scarica/Elimina vicino a "Salva modifiche", tab in un riquadro con contorno

**Cosa fa:** due rifiniture di layout sulla scheda del documento, dopo averla provata:

1. **"Scarica" ed "Elimina" si spostano vicino a "Salva modifiche"**, dentro la tab "Scheda" --- non più un riquadro a parte sopra le tab, isolato dal resto delle azioni sul contenuto.
2. **Le tre tab (Scheda / Letto dal dispositivo / Analisi con Hinthia) e il loro contenuto vivono in un unico riquadro bianco con contorno**, come l'Anteprima a fianco --- prima galleggiavano senza un bordo proprio.

**Note tecniche:** nessuna logica toccata, solo dove i bottoni/il markup vivono. `handleDownload`/`handleDelete`/`busy`/`kind` restano gli stessi; il bottone "Scarica" resta condizionale su `kind !== "note"`, come prima.

Verificato: typecheck, lint, build di produzione, e i test e2e che toccano la scheda documento (`archive-item-detail`, `archive-proposals`, `document-categorization`, `reminders`, `dossiers`, `archive`) --- tutti passano tranne il solito fallimento preesistente e indipendente già documentato (`archive-item-detail.spec.ts`, l'OCR di "AZIENDA OSPEDALIERA DI GUBBIO").

---

## 2026-09-29 (3)

### Scheda documento --- anteprima fissa, "Scheda" come prima tab, il trigger di analisi dentro "Analisi con Hinthia"

**Cosa fa:** tre correzioni alla scheda fusa Scheda/Modifica appena introdotta (v. voce precedente), dopo averla provata:

1. **L'anteprima resta fissa a sinistra**, sola: prima condivideva la colonna con la Scheda e il trigger di analisi, ora è l'unica cosa sempre visibile senza aprire una tab.
2. **"Scheda" diventa la prima delle tre tab a destra** (prima di "Letto dal dispositivo" e "Analisi con Hinthia"), ed è quella attiva per default all'apertura della pagina --- coerente col fatto che prima era sempre visibile, non nascosta dietro un click.
3. **"Chiedi a Hinthia di leggere questo documento" vive dentro la tab "Analisi con Hinthia"**, non più fissa a sinistra: quella tab è ora sia dove si chiede la lettura sia dove ne arriva il risultato (proposte di Hinthia, sintesi).

**Note tecniche:** `activeTab` passa da `"reading" | "analysis"` a `"scheda" | "reading" | "analysis"`, default `"scheda"`. La sezione `<section aria-label="Scheda">` diventa il contenuto della nuova tabpanel `tabpanel-scheda` (niente più region "Scheda" raggiungibile via `getByRole("region", ...)` --- ora è una tabpanel come le altre due). `AIAnalysisTrigger` si sposta, invariato, in testa alla tabpanel "Analisi con Hinthia", sopra le eventuali proposte di Hinthia e la sintesi.

**Impatto sui test e2e, di due tipi.** Il primo: `document-categorization.spec.ts`/`reminders.spec.ts`/`dossiers.spec.ts` interagivano con i campi della Scheda subito dopo aver aperto la pagina, senza mai cliccare una tab --- continuano a funzionare senza modifiche, perché "Scheda" è ora proprio la tab di default. Il secondo, più esteso, su `archive-proposals.spec.ts` e `archive-item-detail.spec.ts`: i test che restano sulla tab "Letto dal dispositivo" (dove si accetta una proposta) e poi controllano il valore scritto nel campo "Scadenza" ora devono passare esplicitamente dalla tab "Scheda" per leggerlo --- un solo pannello è montato alla volta, non basta più che il campo sia "da qualche parte sulla pagina". Un `page.reload()` a metà test azzera di nuovo la tab attiva su "Scheda": va riaperta la tab giusta anche dopo. `ai-content-analysis.spec.ts` (non eseguito, solo aggiornato meccanicamente) riceve lo stesso trattamento per il trigger di analisi, ora dentro "Analisi con Hinthia".

Un compromesso onestamente accettato con questa scelta: prima, accettare una proposta sulla destra si rifletteva subito, visibilmente, nella Scheda sempre aperta a sinistra. Ora la conferma immediata è solo il banner di annullamento condiviso ("Scadenza impostata al..."); per vedere il campo aggiornato nella Scheda occorre cambiare tab. Non risolto qui, segnalato perché è un cambiamento di comportamento reale, non solo di layout.

Verificato: typecheck, lint, build di produzione, e l'intera batteria dei file toccati direttamente (`archive-proposals`, `archive-item-detail`, `document-categorization`, `reminders`, `dossiers`) --- tutti passano tranne il solito fallimento preesistente e indipendente (`archive-item-detail.spec.ts`, l'OCR di "AZIENDA OSPEDALIERA DI GUBBIO", riconfermato). Una batteria più ampia (`assets`, `capsules`, `categories`, `tags`, `archive`, `ai`, `auth-shell`) ha mostrato alcuni fallimenti isolati (utente di test non pre-creato, un popup di onboarding che intercetta un click) --- rieseguiti singolarmente, passano tutti: contesa fra i tanti test eseguiti in sequenza oggi, non causata da questa modifica.

---

## 2026-09-29 (2)

### HINTHIA come unica IA dell'app, scheda fusa con la modifica (concept E), niente più tab "Proposte"

**Cosa fa:** sei correzioni chieste insieme dopo aver provato "Nuovo contenuto" e la scheda di un documento:

1. **Il passo 1 di "Nuovo contenuto" non parte più su una modalità già scelta** --- "Cosa vuoi aggiungere?" è davvero la prima domanda, non un default silenzioso su "Carica un file" da dover notare e correggere.
2. **Un solo concetto pulito per il caricamento**, non due messaggi sovrapposti: l'intero riquadro (icona, "Trascina qui un documento, o clicca per sceglierlo", tipi ammessi) è insieme zona di trascinamento e zona cliccabile --- una casella `<input type="file">` invisibile ma presente lo ricopre per intero.
3. **HINTHIA è l'unica IA che l'app mostra**: ogni "AI"/"IA"/"Claude" rivolto all'utente --- bottoni, etichette, aria-label, messaggi di errore delle due route server (`api/ai/chat`, `api/ai/analyze`), la voce "Attività", persino la voce di navigazione principale (prima "AI", ora "Hinthia") --- diventa "Hinthia". Mai più un nome di provider in vista: dietro c'è sempre Claude (Anthropic), ma l'utente non deve saperlo per usare l'app.
4. **L'avatar di Hinthia sostituisce il lucchetto 🔒** ovunque comparisse per l'analisi con IA: il bottone "Chiedi a Hinthia", l'intestazione "Analisi con Hinthia" sulla scheda, la stessa sezione nei passi post-salvataggio di "Nuovo contenuto".
5. **Scheda e Modifica sono la stessa pagina.** Niente più `/archive/[id]/edit`: i campi (Categoria, Bene, Fascicoli, Scadenza, Emittente, Tag, Note) sono sempre modificabili direttamente sulla scheda, con un "Salva modifiche" che si accende solo quando c'è davvero qualcosa da salvare.
6. **"Proposte" non è più una tab a sé.** Quello che c'è da accettare o rifiutare vive già dentro "Letto dal dispositivo" (le proposte locali) o "Analisi con Hinthia" (quelle di Hinthia) --- a seconda di dove viene, non in una terza vetrina separata. L'eventuale annullamento resta visibile sopra le due tab, condiviso, così non sparisce cambiando tab.

**Note tecniche:** `ArchiveItemDetail.tsx` guadagna un `fields` locale (`DocumentMetadataFieldsValue`) sincronizzato da `doc` con tre `useEffect` distinti, uno per campo (`categoryId`/`expiresAt`/`issuer`) --- mai un ricalcolo unico dell'intero oggetto, che sovrascriverebbe una modifica in corso su un campo diverso non toccato da una proposta appena accettata. `handleSaveFields` richiama `updateDocumentMetadata` (la stessa funzione già usata dalla vecchia pagina di modifica, ora rimossa insieme a `EditArchiveItemForm.tsx`). `ProposalsSection` perde la sua sezione `<section aria-label="Proposte">`/l'header "Hinthial propone"/il banner di annullamento interno: il genitore ne monta due istanze (proposte locali dentro "Letto dal dispositivo", proposte di Hinthia dentro "Analisi con Hinthia") e possiede lui il banner di annullamento, una volta sola sopra le tab. `DocumentMetadataFields` --- condiviso con la creazione --- guadagna un `<Link>` sul nome di ogni fascicolo nel chip: prima era solo etichetta, ma sulla scheda fusa è anche l'unico modo di arrivare al fascicolo da un documento, non essendoci più una vista di sola lettura a parte. `DocumentsPanel.tsx` perde la voce di menu "Modifica" (ridondante col nome del contenuto, che porta già alla stessa pagina fusa) e lo stato `showUpdatedMessage`/`?updated=1` (nessuna pagina scrive più quella query string per un documento).

**Impatto ampio sui test e2e, in due ondate distinte.** La prima: rimuovere la pre-selezione del passo 1 (punto 1) rompe **44 controlli in 28 file** che caricavano un file subito dopo aver aperto "Nuovo contenuto", assumendo (correttamente, prima di oggi) che il passo del file fosse già pronto --- ognuno ora seleziona esplicitamente "Carica un file" (o "Scrivi una nota", dov'è il caso) prima di procedere. La seconda, sulla fusione Scheda/Modifica: gli stessi test che prima passavano per `/archive/[id]/edit` restano sulla stessa pagina e usano "Salva modifiche" al posto di "Salva modifiche" + redirect a `/archive?updated=1`; la voce di menu "Modifica" viene sostituita dal click sul nome del contenuto. In `document-categorization.spec.ts` la ricerca di `getByLabel("Categoria")` è diventata ambigua con la nuova checkbox di esclusione dall'analisi di Hinthia ("...anche con la categoria abilitata"), ora sulla stessa pagina --- risolto con `exact: true`. `assets.spec.ts` meritava attenzione a parte: già apriva il passo 3 prima di scegliere il file per un motivo suo (v. voce precedente, il suggerimento automatico di categoria da "contratto-affitto.txt") --- la nuova scelta esplicita del passo 1 va comunque prima di quell'apertura, non al suo posto; verificato che l'ordine combinato dei due accorgimenti funzioni ancora, in isolamento e non solo dentro la batteria intera.

**Due bug reali scoperti scrivendo questi test, non causati dai test in sé:**
- In `dossiers.spec.ts`, ricaricare subito dopo "Salva modifiche" (senza aspettare la conferma) rischiava di leggere lo stato prima che la scrittura asincrona fosse arrivata al server --- stessa famiglia del bug "Torna all'archivio" trovato nella voce precedente. Risolto aspettando il toast "Modifiche salvate." prima di ricaricare in tutti i punti che lo fanno.
- Il banner di annullamento condiviso (`role="status"`) collideva con quello dei toast globali (`ToastProvider`, anche lui `role="status"`): un `getByRole("status")` senza distinzione trovava il toast sbagliato. Risolto con un `aria-label="Ultima proposta"` sul banner delle proposte.

Verificato: typecheck, lint, build di produzione, e l'intera batteria di e2e realmente eseguiti tra i file toccati (oltre trenta, incluse le sei sopra citate) --- tutti passano tranne i due fallimenti preesistenti e indipendenti già documentati nella voce precedente (`archive-content-kinds.spec.ts`, `table-sort.spec.ts`), più `archive-item-detail.spec.ts` (l'OCR di "AZIENDA OSPEDALIERA DI GUBBIO"), tutti riconfermati identici su `master` pulito con `git stash`. `ai-content-analysis.spec.ts`/`ai-extraction-consent.spec.ts`/`ai-processing-consent.spec.ts` non eseguiti per il solito motivo (`ANTHROPIC_API_KEY` reale in `.env.local`), solo aggiornati meccanicamente per il rebranding e la tab "Hinthia" in Impostazioni.

---

## 2026-09-29

### Nuovo contenuto --- concept C (a tappe) e concept D (passi dopo il salvataggio)

**Cosa fa:** la pagina "Nuovo contenuto" adotta il secondo dei concept discussi con l'utente --- tre passi ad accordion invece di un unico form lungo: **1. Cosa vuoi aggiungere?** (tipo di contenuto, tessere più grandi), **2. Aggiungi il contenuto** (file/registrazione/nota) e **3. Aiutaci a ritrovarlo** (categoria, bene, fascicoli, tag, note) --- un passo alla volta, gli altri si riducono a un riepilogo con "Modifica". Scadenza ed emittente non si chiedono più in questa fase: in creazione non ha più senso indovinarli, emergono come proposta subito dopo il salvataggio, insieme a tutto il resto che Hinthial ha letto. Il vecchio riquadro "✓ Ho letto il documento" sparisce: un piccolo segno verde accanto al nome del file basta.

Dopo aver premuto "Aggiungi all'archivio", **non si torna più direttamente all'elenco**: compare una schermata con i passi di cosa succede dopo --- salvataggio (fatto), lettura sul dispositivo (con quel che ha trovato, se qualcosa), e la possibilità di chiedere subito l'analisi a Claude, senza dover prima aprire la scheda. In fondo, la scelta è esplicita: **"Vai alla scheda del documento"** o **"Torna all'archivio"**.

**Note tecniche:** `uploadDocument`/`createTextNote` ora ritornano l'id del documento creato (prima `Promise<void>`), necessario per ricaricarlo subito dopo il salvataggio con `listDocuments` e mostrargli i passi con dati veri (non ricostruiti a mano lato form). `DocumentMetadataFields` guadagna `showIssuer` (di default `true`, come `showExpiry`) --- il form di creazione passa `false` a entrambi, editare e modifica inline restano invariati. I passi post-salvataggio riusano `buildProposals`/`readingStateFor`/`AIAnalysisTrigger`/`analyzeDocumentWithClaude` così come sono su `ArchiveItemDetail.tsx`, non una copia: le proposte vere si accettano solo sulla scheda, qui sono solo informative con un link.

Impatto ampio, deliberato, sui test e2e: il ritorno diretto a `/archive` dopo il salvataggio era verificato in 28 file (43 controlli) --- quasi tutti lo usano solo come passo preliminare per testare altro. Aggiornato un click esplicito su "Torna all'archivio" ovunque, più l'apertura del passo 3 dove un test interagiva con categoria/bene/fascicoli/tag durante la creazione. In quei casi il file va scelto **prima**, per due motivi distinti trovati testando: (1) aprire il passo 3 chiude il passo 2, portando via di mezzo l'`<input type="file">`; (2) un nome file può far scattare il suggerimento automatico di categoria (v. `heuristicCategorizer`, es. "contratto-affitto.txt" → 🏠 Casa) --- un controllo su un campo ancora vuoto va fatto PRIMA di scegliere il file, non dopo, altrimenti trova già valorizzato ciò che si aspettava vuoto (`assets.spec.ts`). Riscritto `archive-create-reads-file.spec.ts`: il test sulla correzione della scadenza in creazione non ha più senso (il campo non c'è più) --- la logica pura che verificava (`findDateContext`) resta comunque coperta da `tests/unit/extraction/structured-fields.test.ts`, mai stata legata a quella UI.

**Bug reale scoperto proprio scrivendo questi test, non un problema dei test stessi:** il nuovo link "Torna all'archivio" in fondo ai passi post-salvataggio condivide la sottostringa con quello, preesistente, in cima al form ("← Torna all'archivio", sempre presente finché il salvataggio è in corso). `getByRole("link", { name: "Torna all'archivio" })` senza `exact: true` trovava e cliccava SUBITO quello vecchio (sempre già presente, quindi già "azionabile") invece di aspettare quello vero in fondo ai passi --- navigava via prima ancora che il salvataggio finisse, e il documento non veniva mai verificato come salvato. Impercettibile a mano (un umano aspetta istintivamente), quasi garantito in automazione che non aspetta. Risolto aggiungendo `exact: true` a tutti i 43 controlli.

Verificato: typecheck, lint, build di produzione, l'intera suite unit (481 test) senza regressioni, e l'intera batteria di e2e realmente eseguiti tra i file toccati (`archive-content-kinds`, `archive-create-reads-file`, `tags`, `categories`, `dossiers`, `archive`, `archive-thumbnails`, `archive-item-detail`, `archive-proposals`, `assets`, `capsules`, `danger-zone`, `dashboard-layout`, `document-categorization`, `export`, `list-filters`, `onboarding-checklist`, `onboarding-status`, `privacy-panel`, `reminders`, `table-sort`, `timeline`, `transcription`, `audit-log`, `archive-search-inside-pdf`) --- tutti passano tranne due fallimenti preesistenti e indipendenti, entrambi confermati riproducibili identici su `master` pulito con `git stash` (quindi non causati da questo lavoro, non risolti qui): `archive-content-kinds.spec.ts` (un `getByText` su un link icona+nome nell'elenco) e `table-sort.spec.ts` (le celle della vista a tabella risultano vuote subito dopo tre caricamenti in sequenza). `ai.spec.ts`/`ai-content-analysis.spec.ts` non eseguiti per il solito motivo (`ANTHROPIC_API_KEY` reale in `.env.local`), solo aggiornati meccanicamente.

---

## 2026-09-28 (3)

### Scheda documento --- concept 1: identità fissa a sinistra, tab a destra

**Cosa fa:** la scheda di un documento era arrivata ad affiancare troppe cose sulla stessa pagina (Scheda, campi eterogenei, bottone AI, sintesi di Claude, Proposte, Letto dal dispositivo). Ora l'identità del documento --- Anteprima, Scheda e il bottone "Chiedi a Claude" --- resta fissa in una colonna a sinistra, sempre visibile; il resto vive in tre tab a destra: **Proposte** (con il conteggio, se ce ne sono), **Letto dal dispositivo** (l'estrazione locale, prima "Cosa ne ho ricavato"/"Cosa ho letto") e **Analisi di Claude** (la sintesi, o la dichiarazione onesta che non è stata ancora chiesta). Dopo un'analisi Claude riuscita la pagina salta da sola sulla tab con qualcosa di nuovo da vedere.

**Note tecniche:** unico file di produzione toccato, `ArchiveItemDetail.tsx` --- nessuna modifica a `ProposalsSection`/`StructuredFieldsSection`/`ReadingSection`: il loro `<section aria-label="...">` interno resta la region raggiungibile via `getByRole`, il tab è solo il contenitore attorno (`role="tablist"`/`role="tab"`/`role="tabpanel"`, un solo pannello montato alla volta, come `SettingsTabs.tsx`). La griglia a container query (`@container`/`@3xl`) diventa un flex fisso-a-sinistra (`@3xl:w-[380px] @3xl:shrink-0`)/tab-a-destra, stesso breakpoint di prima.

**Due bug preesistenti scoperti verificando, non causati da questa modifica:** (1) `archive-proposals.spec.ts` cliccava un link "Impostazioni" ambiguo con quello di `AIAnalysisTrigger` ("Impostazioni → Intelligenza artificiale", introdotto dalla FASE 22) --- latente da allora, mai eseguito questo test dopo. Corretto con un `exact: true` nel test. (2) `archive-item-detail.spec.ts` si aspetta "AZIENDA OSPEDALIERA DI GUBBIO" nel testo OCR di `ocr-scansione.pdf`, ma non lo trova più --- riproducibile identico anche su `master` prima di questa modifica (verificato con `git stash`), quindi non causato da questo lavoro. Non risolto qui: fuori dallo scopo di questa voce.

Verificato: typecheck, lint, build di produzione; `archive-item-detail.spec.ts`, `archive-thumbnails.spec.ts`, `archive-proposals.spec.ts` (8 test su 9 passano; il nono è il bug OCR preesistente sopra). `ai-content-analysis.spec.ts`/`ai-extraction-consent.spec.ts` non eseguiti, stesso motivo di sempre (`ANTHROPIC_API_KEY` reale in `.env.local`).

---

## 2026-09-28 (2)

### Campi eterogenei per documento: vocabolario personale e sintesi di Claude

**Cosa fa:** la Scheda di un documento non è più limitata a categoria/bene/scadenza/emittente/tag/note: quando Claude legge un documento (v. FASE 22) e trova un fatto puntuale che non rientra in nessuno di questi (un numero di polizza, una targa, un luogo di nascita, ...), lo propone come un campo nuovo --- accettato, compare in Scheda con la sua etichetta, come tutti gli altri. La prima volta che accetti una chiave nuova, Hinthial se la ricorda: sui prossimi documenti dello stesso tipo la ritroverai con lo stesso nome, non uno leggermente diverso ogni volta. In più, oltre ai campi puntuali, Claude scrive ora anche una breve **sintesi** in prosa di cosa dice il documento nel suo insieme --- non è una proposta da accettare, è solo una lettura d'insieme che si aggiorna da sola a ogni rilettura.

**Note tecniche:** nuova tabella `structured_field_vocabulary` (owner_id, field_key, label), plaintext come le categorie --- cresce alla prima accettazione di una chiave, mai forzata a priori. I valori vivono in `documents.encrypted_structured_fields`, un oggetto `{chiave: valore}` cifrato come `encrypted_tags` (un oggetto invece di un array); la sintesi in `encrypted_ai_synthesis`/`ai_synthesis_generated_at`, stesso schema di `extractedText`/`extractedAt` --- un solo valore, sostituito a ogni lettura, mai accumulato. Scadenza/categoria/emittente non sono stati toccati: il nuovo contenitore è additivo, solo per i campi che quelle colonne non coprono.

`Proposal`/`ProposalKind` guadagnano il kind `"field"` (con `fieldKey`/`fieldLabel`); `acceptProposal`/`undoAcceptance` per questo kind leggono lo stato più recente del blob direttamente dal database prima di scrivere (`mergeStructuredField`), non un `doc` potenzialmente stantio chiuso nella closure di "Annulla" --- altrimenti un campo accettato nel frattempo da un'altra proposta andrebbe perso. Una nuova `normalizeFieldKey` (minuscolo, snake_case, senza accenti) tiene "Numero Polizza" e "numero_polizza" sulla stessa chiave --- usata sia lato client sia nel prompt a Claude, a cui viene passato il vocabolario noto come suggerimento (preferirlo, non un vincolo: può sempre proporne uno nuovo).

**Bug preesistente trovato e corretto lungo il percorso:** `proposal_rejections.kind` non era mai stato allargato a `'issuer'` dalla FASE 24 --- rifiutare una proposta di emittente falliva silenziosamente contro il vincolo del database. Scoperto scrivendo il test di integrazione per questa stessa migrazione, corretto nella stessa migrazione.

Verificato: typecheck, lint, build di produzione, nuovo test di integrazione contro il database reale (`repository.integration.test.ts`, 4 casi: accetta e registra il vocabolario, annulla senza perdere un campo accettato nel frattempo, rifiuta con la chiave giusta, il bug dell'emittente è risolto) più 12 nuovi unit test (`normalizeFieldKey`, `buildAIProposals` sul kind `"field"`, validazione delle citazioni) e l'intera suite (481 test) senza regressioni. La UI (Scheda + blocco sintesi) vive per ora nel posto più semplice disponibile, non uno dei tre concept di redesign discussi con l'utente --- verrà spostata quando ne sceglierà uno.

---

## 2026-09-28

### FASE 22 --- Analisi dei contenuti con Claude, con consenso a tre assi

**Cosa fa:** sulla scheda di un documento compare ora **"🔒 Chiedi a Claude di leggere questo documento"** --- a differenza della lettura locale (FASI 17-19b), qui il testo lascia davvero il dispositivo, quindi niente di automatico: un clic esplicito per documento, con conferma prima dell'invio. Il permesso è a tre assi: **funzione** (il cancello generale e "Estrazione avanzata" già esistenti), **categoria** (in Impostazioni → Intelligenza artificiale, ogni categoria ha ora il proprio consenso permanente --- Salute compresa, non più un'eccezione a parte con un checkbox suo) e **singolo documento** (un'esclusione permanente che vince su tutto, e un permesso "solo questa volta" che non tocca nessun consenso salvato). Se la categoria di un documento non è ancora abilitata, compare la scelta tra "Solo questa volta", "Abilita questa categoria per 30 giorni" o andare direttamente alle Impostazioni. Ogni lettura vera finisce in Attività, con la categoria e il permesso usato --- mai il contenuto.

Quello che Claude propone (scadenza, categoria, emittente) passa dallo stesso meccanismo di accetta/modifica/rifiuta della FASE 19, con una badge "🔒 letto da Claude" per distinguerlo da una proposta locale.

**Note tecniche:** ritirata `profiles.ai_health_consent` (FASE 22-prep, 2026-09-22): il consenso per la categoria "Salute" vive ora in `categories.ai_extraction_enabled`, come per qualunque altra categoria, invece di un caso speciale a parte --- generalizzazione, non una funzione nuova. Nuove colonne `categories.ai_extraction_enabled`/`ai_extraction_enabled_until` (il secondo per il consenso a scadenza) e `documents.ai_extraction_excluded`. Nuova route `app/api/ai/analyze/route.ts` (parallela a `api/ai/chat`, stessa disciplina: chiave solo server-side, consenso riverificato sul database non sul client) --- tre controlli in cascata: funzione, categoria (salvo scope "once"), esclusione del documento (vince sempre, anche su "once"). Il prompt richiede a Claude una citazione verbatim per ogni campo restituito; `domain/ai/analyze-document.ts` la verifica di nuovo lato client (stessa tolleranza di normalizzazione di `flattenForSearch`) e scarta in silenzio ciò che non torna --- stessa disciplina anti-hallucination già in `buildProposals`. Nuova `buildAIProposals`, parallela a `buildProposals` (non toccata): stessi filtri (niente su campi già compilati, niente già rifiutato, dedup) ma sui candidati AI, marcati `aiGenerated: true`. Nuovo evento Attività `ai_extraction_used`, con `{ category, scope }` in metadata.

Verificato: typecheck, lint, build di produzione, 16 nuovi unit test (validazione delle citazioni, filtri di `buildAIProposals`, consenso di categoria con scadenza) più l'intera suite (463 test) senza regressioni. Riscritto `ai-extraction-consent.spec.ts` (non più valido dopo il ritiro del checkbox Salute) e aggiunto `ai-content-analysis.spec.ts`, non eseguiti in questa sessione: `.env.local` contiene una `ANTHROPIC_API_KEY` reale, ed entrambi presuppongono che manchi per verificare il messaggio di errore senza spendere una vera chiamata --- da eseguire con la chiave temporaneamente rimossa.

---

## 2026-09-24

### Motore di estrazione locale più forte: più candidati, emittente proponibile, niente più importo

**Cosa fa:** quando un documento nomina più di una possibile scadenza, Hinthial ora le mostra **tutte** come proposte separate invece di scommettere su una sola --- accetti quella giusta e le altre spariscono. Lo stesso vale per **l'emittente**, ora un campo vero del documento, proponibile come scadenza e categoria, riconosciuto anche per marchi/enti comuni senza forma societaria esplicita (Enel, TIM, Vodafone, WindTre, Iliad, INPS, INAIL, Poste Italiane). **Importo** è stato rimosso del tutto, su richiesta esplicita: non era mai proponibile, e il "totale delle spese" per fascicolo non esiste più.

**Note tecniche:** `domain/extraction/structured-fields.ts` --- `expiry`/`issuer` restituiscono più candidati con la propria fonte ciascuno. Nuovo campo cifrato `documents.encrypted_issuer` (migrazione `20260924000000_document_issuer.sql`), testo libero e non un id/data come scadenza/categoria. Nuovo kind `"issuer"` in `domain/proposals`, che richiede la Master Key per cifrare/decifrare (a differenza di scadenza/categoria, in chiaro). Corretto un bug latente in `ProposalsSection.tsx`: lo stato di "modifica" era tenuto per tipo di proposta, non per singola proposta. Rimossi `AMOUNT_WITH_CURRENCY`/`AMOUNT_WITH_LABEL`/`parseItalianAmount`, `dossierTotalAmount`, `formatAmount`, e la colonna "Totale" fascicoli.

Verificato: typecheck, lint, unit test aggiornati, suite Archivio/Fascicoli/Import rieseguita senza regressioni. Trovato e corretto in verifica: la migrazione non era applicata al database di sviluppo, causa di un errore di scrittura silenzioso mascherato da un timeout e2e.

---

## 2026-09-23 (5)

### Gestione dei tag

**Cosa fa:** in Impostazioni → Privacy e dati → **Tag** trovi l'elenco di tutti i tag usati in Archivio, con quanti documenti li portano: da lì puoi **rinominare** un tag (confluisce in uno esistente se il nome coincide, senza duplicati) o **eliminarlo** (tolto dai documenti, senza cancellarli). Un tag nuovo si crea solo aggiungendolo a un documento in Archivio. Cliccando un tag su un documento, la lista si filtra su quel tag (con una ✕ per togliere il filtro).

**Note tecniche:** i tag non sono un'entità a sé nel database: ogni documento porta il proprio array cifrato (`documents.encrypted_tags`), quindi `domain/documents/tags.ts` li aggrega scorrendo i documenti già decifrati in memoria, raggruppando case-insensitive ("Casa"/"casa" erano sempre stati due tag distinti, ora si uniscono automaticamente, mostrando la grafia più frequente). Rinomina ed eliminazione ripetono `updateDocumentMetadata` per ogni documento interessato, come le azioni in blocco di Archivio. Nuova icona `TagIcon`.

Verificato: typecheck, lint, nuovo test unitario (15 casi: duplicati, rinomina con/senza merge, aggregazione), nuovo e2e dedicato, `categories.spec.ts`/`archive.spec.ts` senza regressioni.

---

## 2026-09-23 (4)

### Selezione multipla in Archivio, e il Cestino

**Cosa fa:** in Archivio ogni documento ha ora una casella di selezione (tabella ed elenco), con "seleziona tutto" in testa. Selezionando uno o più documenti compare una barra con tre azioni in blocco --- **Categoria**, **Tag**, **Fascicolo** --- oltre a **🗑️ Elimina**, che ora sposta nel **Cestino** (nuova scheda di Archivio) invece di cancellare subito. Da lì un documento si ripristina o si elimina per sempre con "Elimina ora" (anche in blocco), o si vuota tutto il cestino insieme. Ogni documento nel Cestino mostra un conto alla rovescia prima dell'eliminazione automatica; la permanenza (5-30 giorni) si imposta in Impostazioni.

**Note tecniche:** `documents.deleted_at`/`purge_at` (migrazione `20260923000000_document_trash.sql`); `purge_at` si calcola una sola volta al momento dello spostamento (`computePurgeAt`, funzione pura) e non si ricalcola mai --- cambiare poi i giorni di permanenza non sposta la data di documenti già nel cestino. L'eliminazione definitiva resta un'unica funzione (`deleteDocument`), usata sia da "Elimina ora" sia dal cron di pulizia (`runTrashPurge`, `/api/cron/trash-purge`, stesso schema `CRON_SECRET` del cron `digital-legacy`). Le operazioni in blocco su categoria/tag/fascicolo ripetono `updateDocumentMetadata`/`replaceDocumentDossierLinks` per documento; spostamento e ripristino nel cestino sono invece vere operazioni bulk a query singola.

Verificato: typecheck, lint, nuovo `domain/documents/trash.test.ts` (5 casi), nuovo e2e dedicato (`bulk-select-and-trash.spec.ts`), suite Archivio/Fascicoli/Dashboard senza regressioni.

---

## 2026-09-23 (3)

### Revisione import massivo più ricca, e rilevamento duplicati veri

**Cosa fa:** "Importa più file insieme" mostra ora una barra di riepilogo in cima (quanti file categorizzati, da rivedere, possibili duplicati, provenienza). Ogni riga distingue una categoria **suggerita dal contenuto** ("✨") da una scelta manuale, e un file senza categoria è evidenziato in ambra. Un file che sembra già presente (stesso nome e dimensione, nell'archivio o nello stesso lotto) viene segnalato in rosa con **"Escludi dall'importazione"**. Il footer mostra quanti file sono pronti e quanti fascicoli verranno creati.

**Note tecniche:** `detectDuplicates` (`domain/bulk-import/duplicates.ts`) è una funzione pura --- corrispondenza esatta su nome e dimensione, mai una somiglianza vaga --- confrontata sia con l'archivio esistente sia con gli altri file del lotto. `DraftFile` guadagna `suggestedCategoryId` (fotografia del suggerimento, smette di coincidere se l'utente cambia categoria) e `duplicateOf`. Nuova `excludeDraft()` per togliere un file dal lotto prima di importare.

Verificato: typecheck, lint, nuovo test unitario per `detectDuplicates` (7 casi, inclusi i negativi), `bulk-import.spec.ts` invariato, nuovo e2e dedicato (duplicati segnalati, uno escluso, il resto importato).

---

## 2026-09-23 (2)

### Rimossi i totali di spesa

**Cosa fa:** "Totali di spesa" non esiste più, su richiesta esplicita dell'utente --- nessuna sostituzione.

**Note tecniche:** rimossi `src/app/(app)/archive/totals/`, `SpendingTotalsPanel.tsx`, `domain/bulk-import/totals.ts` e i relativi test --- nessun altro punto del codice dipendeva da questa logica. `HINTHIAL_MVP.md` (FASE 21) aggiornato di conseguenza.

Verificato: typecheck, lint, unit test rieseguiti senza altre modifiche (425 test, due file in meno).

---

## 2026-09-23

### Import da Google Drive (FASE 25), con un file browser proprio

**Cosa fa:** in "Importa più file insieme" compare **Importa da Google Drive**, un file browser con la grafica di Hinthial (non il selettore nativo di Google, la cui grafica non è personalizzabile --- v. Note tecniche): navighi le cartelle del Drive e scegli file o cartelle intere, che seguono poi lo stesso percorso dei file scelti da disco. Importando una cartella intera, il suo nome diventa un suggerimento di categoria per i file al suo interno (solo se il contenuto non ne suggerisce già una migliore) --- un aiuto, non un nuovo modo di organizzare l'archivio: i Fascicoli coprono già quel bisogno.

**Note tecniche:** prima versione basata sul Picker di Google, sostituita in giornata perché la sua grafica (un iframe controllato da Google) non è personalizzabile. La versione attuale (`domain/google-drive/client.ts`, `GoogleDriveBrowser.tsx`) interroga direttamente la Drive API v3, il che richiede lo scope più ampio `drive.readonly` --- dichiarato nella bozza di informativa insieme alla verifica standard che Google richiede per quello scope prima dell'uso pubblico. Tutto lato client: token OAuth e chiamate Drive API restano nel browser, il server non li vede. Una cartella scelta per intero viene espansa a tutti i suoi file solo al momento dell'importazione, non durante la navigazione. `BulkImportForm.tsx` resta refattorizzato per separare "come arrivano i file" da "cosa se ne fa".

**Limiti noti:** nessun rilevamento di duplicati tra fonti diverse, nessun conteggio "N elementi" su cartelle non ancora aperte. Il flusso OAuth reale non è testabile in automatico: verificato manualmente.

Verificato: typecheck, lint, unit test invariati, `bulk-import.spec.ts` passato senza modifiche dopo il refactoring.

---

## 2026-09-22 (4)

### Consenso preparatorio per estrazione avanzata, Salute, trascrizione e avvisi proattivi

**Cosa fa:** in Impostazioni → Intelligenza artificiale compaiono quattro nuove preferenze SI/NO --- **Estrazione avanzata dei contenuti**, **Trascrizione audio/video**, **Generazione di avvisi proattivi**, e **includi anche la categoria Salute** (subordinata alla prima, attivabile solo se questa è attiva). Nessuna delle funzioni esiste ancora: attivarle prepara solo la preferenza per quando saranno costruite (FASI 22, 22b, 24). "Avvisi proattivi" resta disabilitata finché "Estrazione avanzata" non è attiva.

**Note tecniche:** quattro nuove colonne su `profiles`; spegnere `ai_master_enabled` spegne anche queste, e spegnere `ai_extraction_consent` spegne a cascata `ai_health_consent`/`ai_proactive_alerts_consent` --- riaccenderla non le riaccende da sola. Scartato un modello dati generico "a tre assi" (funzione × categoria × file) in favore di una sequenza piatta di interruttori, più semplice e sufficiente per preferenze che oggi non pilotano ancora nulla.

Verificato: typecheck, lint, nuovo e2e sulla cascata di dipendenze (entrambe le direzioni, persistenza dopo refresh), suite AI senza regressioni.

---

## 2026-09-22 (3)

### Indicatore di caricamento nella chat con Hinthia

**Cosa fa:** mentre aspetti una risposta, al posto del silenzio compare una bolla con tre puntini animati accanto all'avatar di Hinthia --- per far capire che la domanda è partita, non che l'app si sia bloccata.

**Note tecniche:** l'animazione (`ai-typing-bounce`) vive in `globals.css`, come già `unlock-scanner` per lo sblocco biometrico --- un keyframe non ha un equivalente pratico come utility Tailwind. Rispetta `prefers-reduced-motion`. Compare quando `asking` è vero, riorganizzando la condizione tra stato vuoto e thread messaggi invece di un terzo stato separato.

Verificato: typecheck, lint, e2e invariati. Verificato a schermo con una route intercettata e ritardata apposta, poi rimossa.

---

## 2026-09-22 (2)

### Restyle della pagina AI: "Parla con Hinthia"

**Cosa fa:** la pagina dell'assistente si chiama ora "Parla con Hinthia". Il consenso si apre da un tasto ⚙ in un pannello laterale, non più nel corpo della pagina. Ogni messaggio ha un piccolo avatar e un orario; messaggi consecutivi mostrano l'avatar solo sull'ultimo. Il tasto "Chiedi" diventa un'icona di invio circolare. Rimossa "Cose da tenere d'occhio" (già tolta dalla Dashboard per lo stesso motivo, ripeteva altre informazioni).

**Note tecniche:** `AIConsentSettings` (già esistente) è riusato pari pari nel `SidePanel` della pagina, invece di duplicare la logica in `AIPanel`. `ChatMessage` guadagna `createdAt` solo per l'orario, non un log persistito. Rimossi come codice orfano `SuggestionsList`, `mockAIProvider.suggest()`, il tipo `AISuggestion`. `app/(app)/ai/page.tsx` diventa Server Component (legge il profilo con `getCurrentUser()`), con un guscio client `AIPage.tsx` come tramite verso `AIPanel` (una render-prop non è serializzabile Server→Client).

Verificato: typecheck, lint, 427 unit test invariati (i 6 falliti in `guardian-verification.integration.test.ts` sono un'integrazione preesistente non toccata qui), `ai.spec.ts`/`ai-processing-consent.spec.ts` (riscritto per il pannello ⚙)/`dashboard-layout.spec.ts` passati. Verificato a schermo.

---

## 2026-09-22

### La prova generale dell'eredità digitale, e la scheda d'emergenza stampabile

**Cosa fa:** due funzioni nuove in Impostazioni.

**La prova generale** (scheda "Eredità digitale") --- un pulsante che apre uno scenario completo: se il monitoraggio si attivasse oggi, quando succederebbe cosa, con date vere calcolate dalle impostazioni attuali. Mostra anche chi verrebbe interpellato tra i guardiani veri (con la regola di quorum scelta) e chi riceverebbe cosa tra le capsule già condivise. Senza guardiani collegati, la simulazione si ferma onestamente dopo averli "interpellati". Nessun accesso reale concesso, nessuna email inviata davvero.

**La scheda d'emergenza** (nuova scheda) --- pochi campi (gruppo sanguigno, allergie, condizioni, farmaci), un **medico di riferimento** a sé e uno o più contatti di emergenza, per generare una tessera stampabile. Il medico è staccato dai contatti generici: chi presta soccorso ha due domande diverse, chi avvisare e chi conosce la storia clinica.

**Note tecniche:** `domain/digital-legacy/rehearsal.ts` (`buildDigitalLegacyRehearsal`, `groupSharedCapsulesByRecipient`), funzioni pure sulla stessa disciplina di `computeDigitalLegacyTransition`, proiettata in avanti in un colpo. Vive dietro il proprio `RequireMasterKey` (guardiani e capsule sono cifrati). Nuova tabella `emergency_cards` (una riga per account, cifrata come ogni altro contenuto anche se lo scopo finale è mostrarsi in chiaro una volta stampata), riusa il meccanismo di stampa già in uso per il kit di recovery.

Verificato: 8 unit test (calendario, incluso zero guardiani; raggruppamento destinatari), due nuovi e2e, suite Eredità digitale/Archivio/Autenticazione invariata. Un bug di layout reale (pannello anteprima che intercettava i click della colonna accanto) trovato e corretto durante questa verifica.

---

## 2026-09-21 (4)

### Restyle di "Configura la cifratura", ultimo angolo rimasto prima di Halo

**Cosa fa:** la schermata di creazione master password / salvataggio recovery key passa al linguaggio "Halo" già usato per sblocco e login/registrazione: due passi scanditi da "Passo 1 di 2"/"Passo 2 di 2", ciascuno con un proprio medaglione (lucchetto/chiave). Il confronto "password account / master password" diventa una card con un punto colorato sulla riga che conta; i tre bottoni scarica/copia/stampa diventano chip leggere.

**Note tecniche:** la nota di confronto è riscritta in locale in `SetupMasterKeyForm.tsx`, non nel componente condiviso `PasswordComparisonNote` (usato anche da `MasterKeyIntroModal`, non toccato). Il bottone "Scarica come .txt" perde il "come" ("Scarica .txt").

Verificato: l'intera suite che passa da questa schermata, più `archive.spec.ts`/`recovery-kit.spec.ts` invariati. Verificato a schermo, chiaro e scuro, con una recovery key reale.

---

## 2026-09-21 (3)

### Un documento in più fascicoli insieme, e il linguaggio "Halo" esteso a login/registrazione/password

**Cosa fa:** due rifiniture. Un documento può ora appartenere a **più fascicoli insieme** (es. un documento d'identità che serve a più vicende): "Fascicolo" diventa "Fascicoli", si aggiungono uno alla volta e compaiono come etichette rimovibili. Ogni fascicolo mostra quel documento nella propria cronologia; toglierlo da uno non tocca l'altro. L'allegare un fascicolo intero a una capsula segue automaticamente la stessa logica.

Il linguaggio visivo "Halo" si estende a login, registrazione, password dimenticata/reimpostazione e verifica in due passaggi (opt-in sul componente `TextField`, non il nuovo default ovunque).

**Note tecniche:** `documents.dossier_id` (relazione singola) diventa tabella ponte `document_dossiers` (molti-a-molti), stesso schema di `capsule_share_keys`. L'insieme dei fascicoli si sostituisce cancellando e reinserendo (`replaceDocumentDossierLinks`). `DocumentListItem.dossierId: string | null` diventa `dossierIds: string[]` --- ogni punto che lo leggeva/scriveva è stato aggiornato. `TextField.tsx` guadagna una `variant?: "default" | "halo"` opzionale invece di un secondo componente duplicato.

Verificato: nuovo e2e end-to-end (due fascicoli, un documento in entrambi, rimozione di uno senza toccare l'altro), suite Archivio/Fascicoli/Import/Capsule/Autenticazione/Privacy rieseguita.

---

## 2026-09-21 (2)

### Restyle della schermata di sblocco, con animazione durante la verifica biometrica

**Cosa fa:** la schermata "Sblocca" passa da un elenco di campi senza cornice a una card centrata --- medaglione con alone morbido dietro il lucchetto, pulsanti a pillola, un solo link per recovery key/sblocco da dispositivo fidato. Sbloccando con impronta o Face ID, il medaglione diventa per qualche istante uno scanner: un anello blu ruota mentre il testo dice "Verifica in corso…".

**Note tecniche:** nato da tre concept discussi con l'utente (Aura/Ledger/Halo); implementato "Halo", il più adatto a raddoppiare come stato di caricamento biometrico. Nuovo `FingerprintIcon` in `nav-icons.tsx`. Anello e impronta sono due `@keyframes` in `globals.css` (conic-gradient mascherato), non utility Tailwind --- rispettano `prefers-reduced-motion`. Nessuno stato "riuscito" da mostrare: se `unlockWithDeviceLock()` risolve, `RequireMasterKey` smonta il form nello stesso istante --- l'animazione copre solo l'attesa, onestamente. Il campo password torna a un markup dedicato (serviva `rounded-2xl`, non il `rounded-md` del `TextField` condiviso, fuori scope per un restyle di una sola schermata).

Verificato: `archive.spec.ts`/`device-lock.spec.ts`/`device-pairing.spec.ts` invariati contro il nuovo markup. Verificato a schermo, chiaro e scuro.

---

## 2026-09-21

### FASE 20b --- Fascicolo come seconda scheda, badge in elenco, capsule intere, privacy aggiornata

**Cosa fa:** quattro rifiniture a FASE 20.

- **Fascicolo è ora una scheda di Archivio**, non più una voce separata in nav: due linguette "Contenuti"/"Fascicolo" portano a `/archive` e `/dossiers` come prima.
- **Un badge a forma di cartellina** sull'icona di ogni contenuto in elenco segnala l'appartenenza a un fascicolo.
- **Una capsula può allegare un fascicolo intero**: nel form, oltre ad allegare un documento alla volta, si sceglie un fascicolo e si allega tutto ciò che contiene *in quel momento* --- uno scatto, non un collegamento vivo.
- **Impostazioni > Privacy** elenca ora anche quanti promemoria/scadenze e fascicoli (aperti/chiusi) il server vede in chiaro, e a quale categoria/bene/fascicolo è collegato ogni contenuto.

**Note tecniche:** `/dossiers` resta una route separata --- la "scheda" è un componente `ArchiveTabs` con `<Link>` reali e `aria-current="page"` (non `role="tab"`, che implicherebbe pannelli sulla stessa pagina). Il badge (`ContentTypeIcon`) è `aria-hidden`. L'allegare un fascicolo intero non introduce nuovo modello dati: `DocumentAttachmentPicker` filtra i documenti per `dossier_id` e li aggiunge alla stessa lista `selected`.

Verificato: nuovi e2e (cambio scheda, badge, allegare un fascicolo intero), suite Archivio/Fascicoli/Import/Capsule/Privacy rieseguita. Un e2e preesistente ("chiudere una capsula copia il contenuto...") risulta instabile anche sulla base di partenza --- non è una regressione di questa fase.

---

## 2026-09-20 (3)

### FASE 21 --- Import massivo: il Blocco A è chiuso

**Cosa fa:** una nuova pagina, **"Importa più file insieme"**, per caricare molti documenti in una volta. Scegli i file insieme, Hinthial li legge e mostra un **riepilogo per gruppi**, non una conferma per ciascuno.

Se due o più file hanno lo **stesso emittente riconosciuto** (FASE 18), Hinthial propone di creare un fascicolo già selezionato per loro (es. *"Questi 3 documenti hanno lo stesso emittente... Vuoi creare il fascicolo «ENEL ENERGIA S.p.A.»?"*); se l'emittente coincide con un fascicolo esistente, propone di aggiungersi a quello. *"Importa tutto"* salva, categorizza e collega tutto in un colpo.

Una seconda pagina, **"Totali di spesa"**, mostra la somma degli importi riconosciuti per anno e categoria --- una lettura, non un cruscotto: un anno senza importi non compare, invece di mostrare "€0,00".

**Con questa fase si chiude il Blocco A** ("valore senza rischio", FASI 17-21): tutto ciò che Hinthial sa fare oggi gira sul dispositivo, senza che un byte di contenuto ne esca.

**Note tecniche:** lo scope è più stretto del piano originale ma completo --- "rilevamento di serie ricorrenti" e "proposta di fascicoli" sono implementate come **un solo meccanismo deterministico** basato sull'emittente di FASE 18 (una forma societaria o un'intestazione maiuscola, non una somiglianza di significato): coerente col principio già seguito in FASI 18-19, **nel dubbio, non si propone nulla**. Nuovo modulo `domain/bulk-import/` (distinto da `domain/import/`, l'import CSV di beni/amici/scadenze). `groupByIssuer` è generica sul tipo di file per portare in giro i campi modificabili del riepilogo. Scope deliberatamente più stretto del caricamento singolo: niente bene collegato né scadenza nel riepilogo di massa. Un fascicolo nuovo si crea una volta per gruppo, non per file.

Verificato: 15 unit test (soprattutto i casi in cui il raggruppamento deve tacere), due e2e con browser vero (import con emittente comune, totali di spesa), suite Archivio/Beni/Categorie/Scadenze/Fascicoli (39 e2e) rieseguita.

---

## 2026-09-20 (2)

### FASE 20 --- Fascicoli: le vicende che durano nel tempo

**Cosa fa:** un nuovo oggetto in Archivio --- il **Fascicolo** --- per le vicende che attraversano più categorie (un problema di salute, l'acquisto di una casa): una categoria è un cassetto, un fascicolo mette insieme documenti che vivono in cassetti diversi.

Si crea da **Fascicoli** in nav: titolo e descrizione, nasce sempre aperto. I documenti si collegano dal loro form con il nuovo campo **"Fascicolo"** (indipendente da categoria e bene). La scheda mostra:

- la **cronologia**, ordinata per la data letta *dentro* il documento (FASE 18) quando c'è, non per data di caricamento;
- il **totale**, la somma degli importi riconosciuti nei documenti collegati --- "—" e non "€0,00" quando nessuno ne ha uno.

Si chiude e riapre con un clic; eliminarlo scollega i documenti senza eliminarli.

**Note tecniche:** nessuna IA in questa fase --- creazione e collegamento sono manuali. `dossier_id` su `documents`, indipendente da `category_id`/`related_asset_id`, `ON DELETE SET NULL`. Cronologia e totale sono funzioni pure calcolate al volo sul testo già decifrato, non salvate: nessuna migrazione se la logica cambia. Il totale somma in **centesimi interi**, non in virgola mobile.

**Bug preesistente scoperto lungo il percorso:** aggiungere il campo "Fascicolo" al form ha fatto ripartire test e2e già esistenti perché `handleFileChange` (FASE 19b) azzerava tutti i metadati a ogni scelta di file, comprese categoria/bene/tag/note impostati un istante prima --- violava la regola stessa della FASE 19b ("non si tocca ciò che è già compilato"). Corretto: si azzera solo il segno "suggerito da Hinthial", mai i valori.

Verificato: 9 unit test su cronologia e totale (incluso il caso 0,10+0,20 in virgola mobile), un e2e end-to-end completo, suite Archivio/Beni/Categorie/Scadenze (oltre 35 e2e) rieseguita.

---

## 2026-09-20

### Miniature: aprire la scheda di un documento non lo riscarica più per intero

**Cosa fa:** ogni PDF e immagine caricati in Archivio ottengono ora una **miniatura** cifrata, salvata accanto al documento. Da questo momento **aprire la scheda di un contenuto non riscarica più il file intero**, solo la miniatura.

**Perché conta:** in un'architettura zero-knowledge non c'è cache locale --- ogni apertura della scheda riscaricava e decifrava il file intero. Misurato con un browser reale: su un'immagine da 1,4 MB la scheda ora scarica 166 KB invece del file intero (~8,7 volte meno); il guadagno cresce con la dimensione del documento, dato che la miniatura ha dimensione tendenzialmente fissa (900px al lato massimo).

**Cosa vede l'utente:** quasi niente --- la scheda si apre più in fretta, con la didascalia "Anteprima. Usa «Scarica» per l'originale" (per un PDF, "…pagina per pagina", perché la miniatura non porta il numero di pagine).

**Note tecniche:** la miniatura vive come oggetto separato nello stesso bucket cifrato (`<id>-thumb.json`), non come colonna in `documents` --- l'elenco Archivio legge quella tabella a ogni caricamento pagina, e appesantirla avrebbe reso caro l'unico percorso oggi gratis. Resta solo un booleano (`has_thumbnail`). Cifrata direttamente sotto la Master Key (come note/tag), non con una chiave documento dedicata: è dato derivato. Generata al momento del caricamento, quando il file è già in chiaro in memoria per l'estrazione testo. JPEG, 900px, qualità 0,72: pensata per riconoscere il documento, non per leggerlo.

**Bug trovato dal test:** il primo backfill falliva in silenzio con "resource already exists" quando un caricamento precedente aveva lasciato una miniatura orfana --- l'upload riusava la funzione del contenuto principale (`upsert: false` deliberato, per non sovrascrivere in silenzio). Per la miniatura quella regola è sbagliata, essendo dato idempotente: nuova `uploadEncryptedThumbnail` (`upsert: true`) dedicata.

**Backfill senza banner dedicato:** si aggancia agli stessi due percorsi già esistenti per il testo estratto ("Leggili ora"/"Rileggi"), generando la miniatura nello stesso momento in cui i byte sono già in chiaro --- nessuna migrazione forzata su tutto l'archivio.

Verificato: 11 unit test su `lib/thumbnail.ts`, 3 e2e che distinguono i due percorsi dalla didascalia mostrata, suite Archivio (23 e2e) rieseguita, un test preesistente aggiornato per la nuova didascalia.

---

## 2026-09-18 (9)

### Ritocchi all'Archivio: il link senza sottolineatura, e la scheda riordinata

**(1) Il nome di un documento non si sottolinea più al passaggio del mouse** (rumore in un elenco lungo) --- passa al **blu Hinthial**, il colore che segnala in tutta l'app ciò su cui si può agire.

*Nota tecnica:* nel tema scuro si usa un blu più chiaro --- il token `--brand` identico nei due temi renderebbe il nome meno leggibile su fondo quasi nero.

**(2) Nel dettaglio di un documento, "Cosa ne ho ricavato" si è spostato sotto "Scheda"**, nella colonna di destra: sono la stessa cosa vista da due parti, ciò che il documento **è** e ciò che il documento **dice**. *"Cosa ho letto"* e *"Hinthial propone"* restano in fondo a tutta larghezza (l'unica che chiede una risposta, e una domanda stretta in colonna è una domanda che nessuno vede).

Affiancando i due riquadri sono emerse due ripetizioni: ora *"Cosa ne ho ricavato"* mostra solo ciò che **non si legge già altrove nella stessa schermata** --- niente scadenza se già impostata nella scheda, niente titolo (non applicabile da quella pagina, vive dov'è utile, al caricamento).

---

## 2026-09-18 (8)

### FASE 19b --- il documento si legge da solo appena lo scegli

**Cosa fa:** carichi un file e, **prima di salvare**, il form è già compilato. Scegli `scan_0012.pdf` e trovi un riquadro *"✓ Ho letto il documento"* con emittente, data e importo (ognuno con la riga da cui viene), **Categoria** e **Bene collegato** suggeriti, **Scadenza** trovata nel testo, e un titolo pronto con un clic. Premi Salva e basta.

**Perché serviva:** la FASE 19 aveva costruito il meccanismo delle proposte nel posto meno frequentato dell'app --- una scheda che si apre solo andandola a cercare. Chi carica venti documenti senza aprirne nessuno non avrebbe mai visto una proposta; il momento in cui hai la testa sul documento è proprio quello in cui lo carichi.

**La lettura parte quando scegli il file, non quando premi Salva:** avviene mentre compili tag e note, quindi quando arrivi in fondo ha già finito.

**Il bene collegato è l'aggancio più forte che ci sia:** targa/IBAN/numero di polizza che compaiono nel documento non sono una somiglianza, sono una certezza, e portano con sé anche la categoria giusta.

**Correggi una data e Hinthial ritrova la frase da cui viene** --- utile soprattutto quando ne trova cinque (emissione, decorrenza, scadenza, stampa) e sceglie quella sbagliata. Il confronto è tra **date**, non tra stringhe, altrimenti "14 marzo 2026" non troverebbe mai `2026-03-14`. Quando non trova nulla lo dice: *"Questa data nel documento non l'ho trovata. La salvo lo stesso."*

**Note tecniche --- due regole imparate strada facendo:** in creazione si precompila, sulla scheda si chiede (non c'è ancora nulla dell'utente da sovrascrivere, e rivedere un form riga per riga *è* il consenso). Il titolo però **si propone e non si impone**: la prima versione lo precompilava, e dieci e2e sono diventati rossi perché i documenti non si chiamavano più come il loro file --- a differenza di categoria/bene/scadenza (campi vuoti), il nome del file c'è sempre, e sostituirlo d'ufficio viola la regola della FASE 19 ("non si tocca ciò che è già compilato"). Il campo Scadenza compare ora anche in creazione. Il segno *"✨ suggerito da Hinthial"* sparisce appena tocchi il campo.

Verificato: 21 unit test nuovi (riconoscimento beni, titolo, ritrovamento data nel testo), 3 e2e sul percorso completo, 24 e2e dell'Archivio rieseguiti in blocco.

---

## 2026-09-18 (7)

### FASE 19 --- Hinthial propone, tu decidi

**Cosa fa:** sulla scheda di un contenuto compare un riquadro **"Hinthial propone"** con quello che ha capito, con tre risposte per proposta: **Accetta**, **Modifica**, **No grazie**. Accetti una scadenza proposta e compare in **Scadenze** con tutte le altre.

**Questa fase non porta funzioni: porta il permesso di scrivere.** Fino alla 18 Hinthial mostrava soltanto; qui nasce il meccanismo di accetta/modifica/rifiuta che rende sicuro scrivere per conto dell'utente.

**"Modifica" è il caso più frequente, non l'opzione di mezzo:** una proposta è spesso giusta per metà, e senza una terza via l'utente rifiuterebbe e rifarebbe tutto a mano, smettendo di leggere le proposte.

**Quello che rifiuti non ti viene richiesto più**, ma vale per quel valore, non per quel tipo: rifiutare "3 giugno 2027" non esclude che una rilettura ne proponga un'altra data.

**Tutto è annullabile e tutto lascia traccia** in *Impostazioni → Attività*.

**Note tecniche:** il vincolo *il server può proporre, solo il client può scrivere* è rispettato in modo strutturale: `buildProposals` è una funzione pura che gira nel browser sul testo già decifrato. Il valore **rifiutato** è cifrato con la Master Key --- a differenza di un valore accettato (che finisce comunque in chiaro in `documents.expires_at`), un rifiuto non esisterebbe altrimenti in chiaro sul server, quindi il confronto tra una proposta nuova e i rifiuti passati avviene sul client.

Tre regole su quando tacere: niente proposte su campi già compilati (svuotare il campo le fa tornare); niente proposte già rifiutate; niente proposte senza una fonte da mostrare nel documento. Proponibili oggi solo scadenza e categoria --- data documento, importo ed emittente restano visibili ma non proponibili. Il categorizzatore euristico guarda ora anche dentro il documento, ma solo con parole chiave curate (non la corrispondenza col nome categoria, che su tremila caratteri darebbe troppi falsi positivi).

Verificato: 12 unit test su `buildProposals` (soprattutto i casi in cui deve tacere), 4 e2e sulle due promesse non verificabili da unit test (accettare scrive davvero, rifiutare viene ricordato dopo un ricaricamento).

**Limite dichiarato:** l'annullamento vale finché resti sulla pagina --- un registro di undo persistente sarebbe sproporzionato rispetto al guadagno.

---

## 2026-09-18 (6)

### FASE 18 --- dal testo ai campi: "cosa ne ho ricavato"

**Cosa fa:** sulla scheda di un contenuto compare un riquadro con ciò che Hinthial ha **capito** leggendo il documento: data del documento, scadenza, importo, emittente --- ognuno con il pezzo di documento da cui viene. Una scadenza può anche essere **calcolata** (es. da "controllo tra dodici mesi" più la data del prelievo), etichettata come tale per distinguere un conto da una data letta. Non scrive niente nella scheda, lo dice esplicitamente: la scrittura automatica arriva con la FASE 19, che porta accetta/modifica/rifiuta.

**Note tecniche:** sono schemi, non ragionamento --- nessun modello, nessun download. Non si salva nulla nel database: i campi si calcolano al volo dal testo già decifrato in memoria, quindi nessuna migrazione e valgono da subito su tutto l'archivio esistente.

Le regole restrittive contano più di quelle permissive: un numero con la virgola non è un importo (serve un simbolo di valuta o un'etichetta di totale attaccata, altrimenti "Glicemia 92,50" ne sarebbe uno); una data qualunque non è una scadenza (serve una parola che la qualifichi); il punto non separa le date (altrimenti ogni "art. 2.1.3" lo sarebbe); le scadenze a intervallo si calcolano solo con una data del documento da cui contare e una parola che le apra (*controllo*, *rinnovo*); il titolo di un documento non è chi l'ha emesso (una lista di parole che aprono un titolo scarta le righe tipo "CERTIFICATO DI RESIDENZA").

Le quattro sezioni della scheda hanno ora un `aria-label` (vere *region* per lo screen reader, e i test le puntano per nome).

Verificato: 41 unit test (metà sui casi che **non** devono essere riconosciuti, dove una regex troppo larga farebbe danni), un e2e end-to-end sulla scansione (OCR → testo → schemi → interfaccia).

### La trascrizione audio/video si sposta nel blocco B

Era l'ultimo pezzo della FASE 17, spostato non per stanchezza ma perché la tecnologia locale non sa ancora farlo bene: un modello vocale in-browser pesa 40-75 MB contro i 5,6 MB dell'OCR, è spesso più lento del tempo reale su un telefono, e in italiano sbaglia abbastanza da rendere la trascrizione un danno --- a differenza dell'OCR, produce frasi *plausibili* anche quando ha capito male, e il filtro anti-spazzatura non è replicabile per l'audio. Diventa la FASE 22b, con un modello vero dietro consenso esplicito. Nel frattempo la scheda dichiara onestamente *"non so ancora ascoltare gli audio"*, e la trascrizione si scrive a mano. **La FASE 17 si chiude qui.**

---

## 2026-09-18 (5)

### FASE 17e --- la scheda di un contenuto: "cosa ho letto"

**Cosa fa:** ogni elemento dell'Archivio ha ora una pagina sua, raggiungibile dal nome nell'elenco o dai risultati della ricerca globale (prima portavano genericamente all'Archivio). Mostra l'anteprima, la scheda (categoria, bene, scadenza, tag, note) e un riquadro **"Cosa ho letto"** con il testo che Hinthial ha ricavato dal file, per intero.

**L'anteprima vale anche per i PDF:** se ne disegna la prima pagina con lo stesso pdf.js dell'OCR, con il numero totale di pagine sotto. Audio e video non si scaricano da soli (possono pesare decine di MB).

**Perché conta più di quanto sembri:** dalla FASE 17 Hinthial legge i documenti, ma l'unica traccia visibile era uno spezzone nei risultati di ricerca. Vedere esattamente cosa è stato letto è la dimostrazione della promessa *"niente esce dal tuo dispositivo"*.

**I quattro stati finalmente si distinguono** (prima, in tre casi su quattro, il testo risultava semplicemente vuoto): *mai letto* (tasto "Leggilo ora"), *letto ma senza testo trovato*, *letto con successo* (tasto "Rileggi" se l'OCR ha sbagliato), *non so ancora ascoltare gli audio*.

**Il testo estratto ora conserva l'impaginazione** (prima ogni a capo veniva schiacciato in uno spazio, illeggibile su un referto di più pagine). I documenti caricati prima restano nella vecchia forma finché non si preme "Rileggi" --- deliberatamente nessuna migrazione forzata.

**Note tecniche:** `normalizeExtractedText` compatta gli spazi dentro la riga senza schiacciare tutto, usando `hasEOL` di pdf.js. Per non rompere la ricerca su testo multi-riga, `flattenForSearch` (con test dedicati) appiattisce dove si cerca e dove si costruisce lo spezzone. Nuovo `lib/pdf.ts` unifica la preparazione di pdf.js tra estrattore e anteprima (JPEG, non PNG: una pagina scansionata è una fotografia). Nuovo `domain/extraction/reading-state.ts` (7 test), funzione pura che decide quale dei quattro stati raccontare. `formatSize`/`formatDate` estratte in `lib/format.ts`, erano due copie divergenti.

**Di proposito NON c'è**, pur essendo pronto ad accoglierlo: nessun riquadro vuoto per campi estratti/proposte/fascicolo/consenso (fasi future) --- una pagina piena di sezioni "in arrivo" sembra finita e non lo è. Il testo letto resta in sola lettura (renderlo modificabile lo confonderebbe con le Note, e una rilettura cancellerebbe la correzione).

Verificato: 10 unit test, due e2e (testo mostrato con gli a capo reali; recupero di un documento riportato a "mai letto"). Corretti di passaggio due e2e (`list-filters`, `transcription`) rimasti indietro dalla FASE 17a, rotti da allora senza che nessuno li rieseguisse.

---

## 2026-09-18 (4)

### FASE 17d --- anche i PDF che sono solo una scansione

**Cosa fa:** un PDF che è solo la fotografia di un foglio scansionato (il caso più comune nei documenti sanitari e burocratici italiani) non conteneva testo e restava muto. Ora, quando Hinthial si accorge che un PDF non ha testo, ne disegna le pagine e le legge con l'OCR, come farebbe con una foto.

**Note tecniche:** la soglia è "il testo è sotto i 40 caratteri?" e non "è vuoto?", perché un PDF scansionato porta quasi sempre qualche carattere di scarto. Otto pagine al massimo (un faldone da cento bloccherebbe l'utente per minuti, per un guadagno che il tetto di 200.000 caratteri taglierebbe comunque); 1700px di larghezza (l'intervallo dove Tesseract legge bene); il filtro anti-spazzatura vale per pagina, non per documento, così il retro bianco di un foglio non rovina le pagine leggibili.

Verificato con un e2e su un PDF con un unico JPEG e nessun livello di testo (confermato che `getTextContent()` restituisce stringa vuota) --- se la ricerca trova una parola lì dentro, l'ha letta l'OCR.

---

## 2026-09-18 (3)

### FASE 17c --- Hinthial legge dentro le foto

**Cosa fa:** fotografi uno scontrino, una ricetta, un referto stampato --- e Hinthial legge il testo nell'immagine, cercabile da quel momento per il contenuto, non solo per il nome del file. Vale anche all'indietro: le immagini già in archivio compaiono nell'avviso "Leggili ora". L'attesa è annunciata con una percentuale ("Sto leggendo l'immagine… 42%"), non subita in silenzio.

**Come per i PDF, non esce niente:** il riconoscimento avviene sul dispositivo. La prima volta Hinthial scarica una tantum il motore di lettura (~5,6 MB) **dal proprio dominio, non da una CDN esterna** --- scaricarlo da terzi rivelerebbe comunque "questo utente sta leggendo un documento ora".

**Note tecniche:** Tesseract.js (WebAssembly) dietro la stessa interfaccia `TextExtractor` di pdf.js. Un solo file di motore (variante SIMD/solo-LSTM, non tutte e sei le varianti, ~12 MB) e solo italiano, per limitare il download iniziale. Il filtro anti-spazzatura scarta ciò che sta sotto una soglia di confidenza *o* che non ha almeno tre gruppi di caratteri di lunghezza credibile (la confidenza da sola può essere altissima su due lettere) --- senza, un muro o una firma restituirebbero comunque simboli slegati che inquinerebbero la ricerca. Il motore resta acceso un minuto dopo l'ultima immagine, per non ricompilare il WebAssembly venti volte recuperando venti foto dal banner. I file del motore non sono in git: copiati da `node_modules` da `scripts/sync-ocr-assets.mjs`.

Verificato: 13 unit test (filtro anti-spazzatura in ogni caso limite), un e2e che carica un'immagine vera e cerca una parola che esiste solo dentro i pixel (unico modo di esercitare l'intero percorso: Web Worker, WebAssembly, cifratura, rilettura).

**Resta fuori, per il passo successivo:** i PDF fatti di sole scansioni (un'immagine dentro un PDF, dove pdf.js non trova testo).

---

## 2026-09-18 (2)

### FASE 17b --- il perché dei risultati, e i documenti già in archivio

**Cosa fa:** tre rifiniture alla lettura dei PDF introdotta poco fa. **(1)** Il risultato di ricerca mostra ora lo spezzone di testo attorno alla parola trovata, evidenziata (non compare se la parola è già nel nome del file). **(2)** Il pulsante di caricamento dice *"Sto leggendo il documento…"* mentre legge e *"Salvataggio…"* mentre salva, invece di "Salvataggio…" per tutta l'attesa. **(3)** I documenti caricati prima di questa fase si recuperano: un avviso in Archivio con **"Leggili ora"** li scorre uno per uno mostrando l'avanzamento.

**Note tecniche:** nuova colonna `extracted_at` distingue tre stati prima indistinguibili (mai tentata, tentata con esito, tentata a vuoto --- tipicamente una scansione in attesa dell'OCR). Il recupero è sequenziale, non parallelo (un file illeggibile viene contato e non ferma gli altri). Nuovo `lib/text-snippet.ts` (8 test): sceglie il primo termine presente, conserva la forma del testo, allinea il taglio al confine di parola solo quando è vicino.

Verificato: 8 unit test sullo spezzone, e2e esteso (spezzone solo cercando per contenuto, recupero funzionante di un documento "mai letto").

**Resta fuori, deliberatamente:** l'avviso "nessun testo leggibile" per le scansioni (l'OCR lo risolverà un passo dopo) e lo spezzone nella ricerca globale (passa da `AISource`, dove oggi viaggiano solo metadati verso Claude).

---

## 2026-09-18

### FASE 17, primo passo --- la ricerca guarda dentro i PDF

**Cosa fa:** quando carichi un PDF in Archivio, Hinthial ne legge il testo **sul tuo dispositivo** e lo salva cifrato insieme al resto. Da quel momento la ricerca trova un documento anche per una parola scritta **dentro** il file, sia in Archivio sia nella ricerca globale (Ctrl+K).

**Nessun consenso richiesto, perché non esce niente:** l'estrazione avviene nel browser, prima della cifratura. I PDF fatti di sole scansioni non contengono testo e restano per ora invisibili: li leggerà l'OCR, secondo passo di questa fase.

**Note tecniche:** nuovo modulo `domain/extraction`, un'interfaccia `TextExtractor` (oggi solo pdf.js, a cui OCR e trascrizione si aggiungeranno) sullo stesso schema a provider di `Categorizer`/`AIProvider`. Agganciata dentro `uploadDocument`, l'unico punto in cui il contenuto è già in chiaro in memoria. È best-effort e non lancia mai: un PDF malformato non impedisce di salvare il file. Nuova colonna `encrypted_extracted_text`, distinta da `encrypted_transcript` (quella scritta a mano dall'utente, questa derivata e rigenerabile) --- tenerle insieme avrebbe permesso a un'estrazione automatica di sovrascrivere testo dell'utente. Testo tagliato a 200.000 caratteri.

Due trappole trovate scrivendo: pdf.js "detacha" il buffer che riceve, quindi gli si passa una copia; il build moderno di pdf.js non funziona fuori dal browser (loader ESM di Node), quindi si usa il build `legacy` che pdf.js stesso raccomanda per Node.

Verificato: 6 unit test su un PDF vero costruito nel test, un e2e che copre pdf.js col suo worker in un browser vero (carica, cerca una parola presente e una assente).

**Nota non correlata:** `tests/unit/crypto/aes-gcm.test.ts` va in timeout su questa macchina --- verificato con `git stash` che fallisce identico anche sul codice pulito, quindi non è una regressione di questa fase (cifra 4 MB in jsdom con un limite di 20s, macchina più lenta di prima). Da rivedere a parte.

---

## 2026-09-17 (13)

### La voce AI ha la faccia di HINTHIA al posto delle due stelline

**Cosa fa:** nel menu (e in Impostazioni > Intelligenza artificiale) l'icona della voce AI non è più il solito paio di stelline, ma la faccia sorridente di HINTHIA disegnata a tratto come le altre icone di sistema.

**Note tecniche:** un glifo 24x24 `currentColor`, non un avatar a colori (a 19px una PNG non si leggerebbe e ignorerebbe gli stati attivo/hover). Occhi più curvi del previsto per compensazione ottica: a 19px un arco poco profondo si appiattisce in un trattino, e il sorriso diventa assonnato. Escluso il germoglio (si riduce a una macchiolina a quella misura) e due varianti scartate dopo averle renderizzate (asta diagonale che leggeva come Marte ♂; semicerchi pieni). Verificato nell'app reale, stato normale e attivo.

---

## 2026-09-17 (12)

### Le tabelle si adattano allo schermo nascondendo le colonne secondarie

**Cosa fa:** con lo schermo stretto, le tabelle di Archivio, Beni, Scadenze, Amici e Capsule non sforano più verso destra: le colonne meno importanti si nascondono da sole finché la tabella entra nello spazio disponibile, e ricompaiono appena c'è di nuovo posto. Il menu azioni e la colonna identificativa (Nome/Titolo) non spariscono mai --- richiesta esplicita dell'utente, è il punto da cui si fa tutto.

**Note tecniche:** container queries (`@container` + `hidden @xl:table-cell`), non breakpoint di viewport --- tengono conto dello spazio vero del riquadro, quindi anche della barra laterale aperta o chiusa. Ordine di comparsa deciso per valore informativo, uno per tabella. Scelto di non misurare le larghezze in JavaScript: soglie fisse per contenitore danno lo stesso risultato senza un ciclo misura-ridisegna a ogni resize.

Verificato: overflow reale a 0px a 915/1100/1500px (con menu azioni sempre presente), suite e2e delle viste a tabella (ordinamento, impaginazione, filtri) invariata.

---

## 2026-09-17 (11)

### Rimossa la sezione "Da tenere d'occhio" dalla Dashboard

**Cosa fa:** la Dashboard non mostra più "Da tenere d'occhio" in fondo. Restano i contatori e i tre riquadri (Prossime scadenze, Aggiunti di recente, Elementi da completare); i suggerimenti proattivi restano in Assistente AI, dove si chiedono esplicitamente.

**Note tecniche:** discusso con l'utente, misurando la sovrapposizione reale --- due delle tre righe ripetevano dati già mostrati sopra, il resto erano metriche di completezza che misurano l'ordine, non un rischio: costruita su regole deterministiche che contano sempre qualcosa, la sezione aveva sempre qualcosa da dire, e così smetteva di significare qualcosa. Eliminati `WatchlistWidget.tsx` (non più usato) e `VaultHealthWidget.tsx` (era già codice morto, non renderizzato da nessuna parte pur avendo ancora un test che lo copriva).

**Ipotesi per il futuro, non implementata:** una sezione "Avvisi" generata dall'IA reale --- utile perché potrebbe restare vuota quando non c'è nulla da dire, ma richiederebbe un consenso proprio e una cadenza controllata.

---

## 2026-09-17 (10)

### HINTHIA compare nell'intestazione della pagina AI

**Cosa fa:** l'avatar di HINTHIA affianca ora il titolo della pagina "Assistente AI" --- primo punto dell'interfaccia in cui il personaggio si vede davvero.

**Note tecniche:** copia ridotta a 128px (8 KB), non l'originale da 1,3 MB. `alt` vuoto di proposito (il titolo accanto già dice cos'è la pagina). Resta aperta la scelta di prodotto se "Hinthia" debba sostituire "Assistente AI" nel titolo.

---

## 2026-09-17 (9)

### "Novità" aggiornata dal 15 al 17 settembre

**Cosa fa:** la pagina "Novità" era ferma al 13 settembre (segnalato dall'utente) --- aggiunte 10 voci per ciò che vale la pena raccontare da allora: sblocco biometrico e pairing via QR, capsule condivise davvero apribili, avvisi email/popup, Eredità digitale, riorganizzazione di Impostazioni, novità di Amici.

**Note tecniche:** nuova migrazione di backfill, stesso criterio di curatela già usato (niente bug fix, niente restyling puro), esclusa deliberatamente la voce sul "guardiano non collegato" (sostituita il giorno dopo dal modello Amici v2, mai annunciata).

---

## 2026-09-17 (8)

### Amici v2: PERSONA vs AMICO, e il Guardiano richiede consenso

**Cosa fa:** ripensato da zero il modello di Amici. Ogni contatto nasce **PERSONA** --- privato, un solo verso, nessuna notifica, può comunque ricevere capsule. Se l'indirizzo corrisponde a un account Hinthial esistente, compare **"Richiedi amicizia"**: email e popup al destinatario, che accetta o rifiuta. Se accetta, **entrambi** compaiono come **AMICO** nella rispettiva lista. Solo un AMICO può ricevere una richiesta di **diventare guardiano**, anch'essa da accettare esplicitamente (non più un interruttore che il proprietario azionava da solo su un amico ignaro). Chi accetta vede quella persona come "protetto" nella nuova pagina **Protetti**, da cui può dimettersi senza consenso del proprietario; il proprietario può invece rimuovere un guardiano direttamente --- serve consenso solo per assumere il ruolo, non per lasciarlo o toglierlo.

**Conseguenza per chi ha già usato la funzione:** ogni amico esistente diventa una PERSONA. Chi aveva già configurato Eredità digitale si ritrova con zero guardiani confermati finché ciascuno non accetta la nuova richiesta --- scelta esplicita dell'utente, sapendo che comporta questo.

**Note tecniche:** due nuove tabelle, `friend_requests` e `guardian_role_requests`, con RLS a due identità e transizioni di stato solo tramite funzioni `security definer` (mai una policy di update diretta: altrimenti il mittente potrebbe scriversi da solo "accepted"). `friends.is_friend` diventa true solo dentro `accept_friend_request`, che aggiorna in un colpo le righe di entrambe le parti; se il destinatario non aveva ancora una riga per il mittente, il client la crea usando nome/email presi dalla richiesta (l'unico modo per conoscerli, non essendo mai stati cifrati per lui). La policy di insert su `guardian_role_requests` verifica `is_friend = true` nel database, non solo lato client. Popup in Dashboard con Accetta/Rifiuta diretti (non un semplice "ho capito", qui serve una decisione).

Verificato: nuovo test di integrazione end-to-end contro il database reale (`friend-and-guardian-requests.integration.test.ts`, 11 casi), più un giro reale con due sessioni browser. Riscritti i test che si appoggiavano al vecchio flusso a interruttore singolo.

---

## 2026-09-17 (7)

### Amici: eliminato lo stato "In attesa"

**Cosa fa:** ogni nuovo amico nasce ora direttamente "Attivo". Lo stato "In attesa" non serviva a nulla di voluto --- nascondeva l'amico dal selettore dei destinatari finché non lo si segnava a mano come attivo, senza alcun indizio del perché. Restano solo "Attivo" e "Revocato".

**Note tecniche:** `FriendStatus` passa da 3 a 2 valori; migrazione promuove a "active" ogni riga ancora "pending" e stringe il check constraint. Rimossi da `FriendsPanel.tsx` la voce "Segna come attivo" e il filtro "In attesa".

Verificato: test aggiornati (`friends.spec.ts`, `capsules.spec.ts`, `list-filters.spec.ts`, `dashboard-counters.test.tsx`), suite completa passante.

---

## 2026-09-17 (6)

### Amici: badge "Su Hinthial" spostato sull'avatar

**Cosa fa:** "✓ Su Hinthial" non è più un badge testuale --- compare invece un tondo blu con una "H" bianca sull'avatar dell'amico. Con stato, Guardiano e "Su Hinthial" tutti in riga, su smartphone sforavano lo schermo.

**Note tecniche:** `Avatar` accetta una prop `linked` che aggiunge il badge in overlay, scalato con la taglia. Resta accessibile (`role="img"` + `aria-label`/`title`) senza il testo visibile. Aggiornati 4 e2e per cercare il badge via `getByTitle`.

---

## 2026-09-17 (5)

### Menu di Impostazioni: intestazioni di gruppo più grandi, blocchi separati su smartphone

**Cosa fa:** i nomi delle aree in Impostazioni sono più grandi, sia da desktop sia su smartphone. Su smartphone ogni area ha ora il proprio riquadro separato, con il nome sopra e fuori, non più come prima riga al suo interno.

**Note tecniche:** solo `SettingsTabs.tsx` toccato --- intestazioni da `text-xs` a `text-sm`; l'elenco mobile rende ogni gruppo come coppia intestazione + `<ul>` proprio invece di un unico elenco continuo diviso da `divide-y`. Verificato visivamente a 1600px e 390px.

---

## 2026-09-17 (4)

### Eredità digitale usa tutta la larghezza disponibile in Impostazioni

**Cosa fa:** la scheda "Eredità digitale" usa ora tutto lo spazio disponibile, come "Aspetto". I valori personalizzati si dispongono su più colonne sugli schermi larghi; su smartphone restano a colonna singola.

**Note tecniche:** rimosso `max-w-2xl` dal contenitore esterno, rimesso solo sui paragrafi discorsivi. I sei campi numerici più il quorum sono ora in griglia (`sm:grid-cols-2 lg:grid-cols-3`).

---

## 2026-09-17 (3)

### Impostazioni riorganizzate in macro-aree

**Cosa fa:** le 11 voci di Impostazioni, prima tutte allo stesso livello, sono ora raggruppate in **Sicurezza** (Sicurezza, Eredità digitale, Attività), **Privacy e dati** (Privacy, Intelligenza artificiale, Categorie, Importa/Esporta), **Personalizzazione** (Aspetto, Onboarding) --- con "Informazioni utente" in cima e "Zona pericolosa" in fondo, fuori da ogni gruppo. Stesso comportamento di sempre, solo più facile da scorrere.

**Note tecniche:** discusso a fondo con l'utente, verificando voce per voce se ogni funzione fosse al posto giusto --- "Intelligenza artificiale" e "Categorie" passate a "Privacy e dati", "Onboarding" sotto "Personalizzazione". Solo `SettingsTabs.tsx` toccato: nessuna modifica al modello dati né ai test esistenti.

---

## 2026-09-17 (2)

### FASE 12, quarto e ultimo passo --- verifica formale, attesa finale, apertura capsule

**Cosa fa:** completate le ultime tre fasi della roadmap. Dopo la conferma dei guardiani, l'account entra in una verifica formale, poi in un'attesa finale (durate configurabili), con un'ultima email al proprietario all'inizio dell'attesa finale --- l'ultimo momento in cui un accesso annulla tutto. Se anche l'attesa finale scade senza risposta, **le capsule già condivise dal proprietario diventano leggibili ai destinatari da quel momento**, indipendentemente dalla data di apertura originale, con un'email di avviso a ciascuno. In Impostazioni > Eredità digitale compare un riquadro con lo stato del proprio processo e i conteggi di quanti guardiani hanno risposto (mai i nomi, cifrati).

**Note tecniche:** nuova colonna `digital_legacy_triggered_at`, deliberatamente separata da `digital_legacy_state` (che può tornare "normal" con un accesso successivo) --- una volta impostata non viene mai azzerata: l'accesso già concesso ai destinatari non si può ritirare. Le policy RLS sui contenuti condivisi concedono la lettura in OR tra `open_at` della capsula già raggiunta oppure `digital_legacy_triggered_at` non nullo --- una capsula mai condivisa non è mai coinvolta. `runDigitalLegacyCheck` accetta un orologio iniettabile solo per i test, dato che le fasi lunghe non si possono simulare aspettando né retrodatando `state_entered_at` (finirebbe prima di `last_sign_in_at`, scatenando il reset).

Verificato con un test di integrazione end-to-end esteso contro il database reale: una capsula con `open_at` nel futuro non è leggibile prima dell'attivazione, lo diventa subito dopo, e resta leggibile anche dopo che il proprietario torna ad accedere.

**Cosa resta fuori, deliberatamente:** la revisione legale/sicurezza richiesta dalla roadmap prima di toccare dati reali in produzione; una vista per il guardiano che elenchi "di chi sono guardiano" prima di una richiesta attiva.

---

## 2026-09-17

### FASE 12, terzo passo --- coinvolgimento dei guardiani

**Cosa fa:** quando il periodo di grazia scade senza risposta, ogni guardiano collegato riceve un'email --- *"[Nome] ti ha indicato come guardiano, hai sue notizie?"* --- con un link dove rispondere (richiede login, mai un click anonimo). Una sola risposta "sta bene" annulla tutto. Se abbastanza guardiani confermano di non riuscire più a raggiungerlo (quorum scelto in Impostazioni: tutti/maggioranza/uno solo), il proprietario riceve un ultimo avviso e l'account entra in un'attesa che una fase futura dovrà raccogliere.

**Note tecniche:** nuova tabella `guardian_verification_requests` con RLS a due identità. Registrare la risposta nel registro Attività *del proprietario* (non del guardiano che risponde) richiede una funzione SECURITY DEFINER (`respond_to_guardian_verification_request`), stesso schema di `log_failed_login_attempt`. La logica del quorum e l'estensione della macchina a stati pura restano prive di accesso a database, testate con 12 nuovi casi.

Verificato con un test di integrazione end-to-end contro il database reale, due account veri: richiesta creata, lettura sotto RLS, risposta via RPC, quorum raggiunto, evento registrato sotto l'account giusto. La vera attesa per inattività non è simulabile in test (un accesso reale ha sempre `last_sign_in_at` più recente di qualunque retrodatazione) --- risolto avviando il test già nello stato "awaiting_guardians".

---

## 2026-09-16 (7)

### Amici: un guardiano senza account collegato avvisa che non potrà essere raggiunto

**Cosa fa:** segnare come guardiano un contatto senza account Hinthial collegato è ancora permesso, ma un popup lo conferma subito e il badge "🛡️ Guardiano" diventa arancione finché quel contatto non si collega.

**Note tecniche:** un guardiano non collegato è oggi irraggiungibile dal server per definizione (la sua email è cifrata con la master key del proprietario) --- la fase futura di coinvolgimento potrà contare solo i guardiani con `linked_user_id` non nullo. Nessuna modifica al modello dati, solo interfaccia.

---

## 2026-09-16 (6)

### FASE 12, secondo passo --- rilevamento inattività e promemoria, opt-in esplicito

**Cosa fa:** in Impostazioni > Eredità digitale compare un interruttore "Attiva Eredità digitale", spento di default --- **nessuna email parte finché non lo si accende esplicitamente**, qualunque preset sia già configurato. Da acceso, un controllo quotidiano osserva l'ultimo accesso di ciascun account: superata la soglia di inattività arriva un'email, ripetuta secondo la cadenza scelta; senza risposta, dopo l'ultimo promemoria comincia il periodo di grazia (email più esplicita: un solo accesso annulla tutto). **Ancora nessun coinvolgimento dei guardiani né apertura di capsule** --- il periodo di grazia scaduto lascia l'account in attesa di una fase futura.

**Note tecniche:** "attività" oggi significa solo "accesso" (`auth.users.last_sign_in_at`, gestito da Supabase). Il cuore della logica (`computeDigitalLegacyTransition`) è una funzione pura, interamente testabile con date finte (19 nuovi test, incluso il reset su un accesso avvenuto dopo l'inizio dello stato corrente). L'orchestrazione (`runDigitalLegacyCheck`) pagina tutti gli utenti via l'API admin, applica l'azione, manda l'email (best-effort) e registra l'evento in Attività --- eseguita una volta al giorno da un cron Vercel protetto da `CRON_SECRET` (senza quella variabile, la route rifiuta ogni richiesta con 401 invece di girare senza protezione). Cinque nuove colonne su `profiles` per lo stato della macchina a stati.

**Da fare, solo l'utente può farlo:** impostare `CRON_SECRET` sia in `.env.local` sia su Vercel --- senza, il cron non farà mai nulla.

---

## 2026-09-16 (5)

### FASE 12, primo passo --- Impostazioni > Eredità digitale: solo i parametri, nessuna automazione ancora

**Cosa fa:** una nuova scheda "Eredità digitale" dove scegliere la strategia che deciderà --- in una fase futura, non ancora costruita --- quando le capsule arrivano davvero a chi le doveva ricevere. Tre preset rapidi (Prudente/Normale/Rilassato) più "Personalizza i valori" (soglia di inattività, promemoria, periodo di grazia, quorum guardiani, verifica formale, attesa finale), con un riepilogo in linguaggio semplice che si aggiorna in tempo reale. **Importante:** solo configurazione --- nessun rilevamento, promemoria o apertura di capsule è ancora costruito.

**Note tecniche:** discusso a fondo con l'utente prima di scrivere codice (nome, terminologia guardiano/protetto, flusso a 7 fasi, valori dei preset). Otto nuove colonne su `profiles`, con vincoli `check` contro configurazioni assurde, applicati anche client-side (`clampDigitalLegacyField`). Diagnosticati e corretti durante la verifica due difetti pre-esistenti scoperti per caso, non causati da questa modifica: un placeholder di ricerca mai aggiornato dopo la rinomina "Contatti fiduciari" → "Amici"; un'ambiguità tra una riga di tabella e un popup di conferma omonimo.

---

## 2026-09-16 (4)

### Rimossa la checklist "Onboarding" dal corpo della pagina Dashboard

**Cosa fa:** la Dashboard non mostra più la checklist "Onboarding" tra i propri contenuti --- resta consultabile dall'indicatore persistente in barra laterale, che apre la stessa lista in un pannello.

**Note tecniche:** rimossa la card da `DashboardWidgets` e la mini-checklist da `DashboardPanel` (sostituita da un link "vai all'archivio"). Nessuna modifica alla logica di calcolo dei passi né al gadget in barra laterale, unico punto rimasto da cui la checklist è raggiungibile.

---

## 2026-09-16 (3)

### Bug corretto: il tasto "+" tondo su smartphone poteva apparire spostato oltre il bordo destro dello schermo, con scorrimento orizzontale indesiderato

**Cosa fa:** su smartphone, il tasto "+" tondo in sovraimpressione poteva finire fuori dal bordo destro visibile --- un effetto mai voluto.

**Note tecniche:** `<html>` ha già `overflow-x: hidden`, ma non basta su alcuni browser mobile: un elemento `position: fixed` può calcolare il proprio `right` rispetto alla larghezza reale del documento se un altro contenuto la eccede anche di poco. Serve tagliare anche su `<body>`, ma non con un secondo `overflow-x: hidden` (due `hidden` avevano già causato, in precedenza, un accoppiamento indesiderato che rompeva `position: sticky` di Sidebar/TopNav/MobileNavBar). Usato invece `overflow: clip` su `<body>`, che non crea un contenitore scrollabile e quindi non soffre dello stesso accoppiamento.

Verificato: `position: sticky` continua a funzionare (suite `sticky-nav.spec.ts` e affini).

---

## 2026-09-16 (2)

### Bug corretto: chi condivide una capsula la ritrovava anche nel proprio elenco "Condivise con me"

**Cosa fa:** dopo aver condiviso una capsula, il mittente non la vedeva più (per errore) tra le proprie "Condivise con me".

**Note tecniche:** `listCapsulesSharedWithMe` leggeva `capsule_shares` senza filtro esplicito, affidandosi solo a RLS --- che ha due policy SELECT separate (proprietario/destinatario) combinate in OR da Postgres, quindi tornava le righe in entrambi i ruoli. Corretto aggiungendo `.eq("recipient_user_id", user.id)` alla query, senza toccare la RLS. Diagnosticato da una segnalazione su un account reale.

### Bug corretto: "Decryption failed" nella pagina Capsule per chi ha ricevuto una capsula ma non ne possiede ancora nessuna propria

**Cosa fa:** un account senza capsule proprie, ma con una capsula ricevuta, vedeva un errore di decifratura invece della propria lista vuota.

**Note tecniche:** stessa classe di difetto della voce precedente, in `listCapsules`: nessun filtro su `owner_id`, solo RLS (che ammette anche le righe condivise CON l'utente, il cui `encrypted_payload` è cifrato con la Master Key del *proprietario*). Corretto aggiungendo `.eq("owner_id", user.id)`.

---

## 2026-09-16

### Avvisi di condivisione capsule (email + popup in Dashboard), messaggi di conferma come popup, avatar al posto del ☰ su smartphone

**Cosa fa:** quattro miglioramenti richiesti dall'utente. (1) Il tasto menu su smartphone è ora l'avatar dell'account. (2) Chi riceve una capsula condivisa riceve anche un'email di avviso. (3) I messaggi di conferma appaiono ora come popup in sovraimpressione che sparisce da solo, invece di spostare il contenuto sotto di sé. (4) Chi riceve una capsula trova, la prima volta che apre la Dashboard dopo la condivisione, un popup che non ricompare più per quella capsula una volta chiuso.

**Note tecniche:** l'email (`notifyCapsuleShared`) è una Server Action best-effort chiamata da `shareCapsule`/`syncCapsuleSharesForLinkedFriend` --- un fallimento non blocca la condivisione. L'indirizzo del destinatario è risolto server-side con l'API admin a partire dal solo id, mai conosciuto dal chiamante. Il popup "per sempre" si appoggia a `capsule_shares.dismissed_at` con una policy RLS dedicata. I popup di conferma condividono un nuovo `ToastProvider`, che sostituisce interamente il vecchio `SuccessMessage` in cinque pannelli. Durante la verifica, scoperto e corretto un difetto pre-esistente della FASE 13: il tasto "Sblocca con un dispositivo fidato" rende ambiguo qualunque test che cerchi "Sblocca" senza `exact: true`.

---

## 2026-09-15

### FASE 13, ultimo passo --- elenco e revoca di tutti i dispositivi fidati, da qualunque dispositivo

**Cosa fa:** in Impostazioni > Sicurezza trovi ora l'elenco di *tutti* i dispositivi resi fidati --- nome, registrazione, ultimo accesso --- gestibile da qualunque dispositivo. Revocarne uno diverso da quello in uso gli fa perdere lo sblocco biometrico al prossimo tentativo. Registrazione e revoca compaiono ora nel registro Attività.

**Note tecniche:** ultimo dei quattro passi di FASE 13. Nessuna nuova tabella: riuso di `forgetTrustedDevice` (identica sia rimuovendo se stessi sia un altro dispositivo, con la sola differenza che rimuovere se stessi svuota anche la copia locale del Master Key). Un dispositivo diverso si autoguarisce al suo prossimo tentativo di sblocco (`findActiveTrustedDevice` non lo trova più tra i non revocati).

### FASE 13, secondo passo --- sblocca un dispositivo nuovo facendolo approvare da uno già fidato, via QR code

**Cosa fa:** su un dispositivo nuovo, nella schermata di sblocco puoi scegliere "Sblocca con un dispositivo fidato": compare un QR code. Inquadralo con un dispositivo già fidato e conferma lì con la master password una volta --- il primo dispositivo si sblocca da solo in pochi secondi, senza che tu l'abbia mai digitata lì.

**Note tecniche:** riusa lo scambio ECDH effimero-effimero già scritto per FASE C1: nessuna delle due parti ha una chiave permanente, entrambe derivano lo stesso segreto condiviso (proprietà simmetrica dell'ECDH) con cui si cifra il Master Key. Nuova tabella `device_pairing_requests` fa da tramite --- il server vede solo due chiavi pubbliche effimere e un blob già cifrato, mai il Master Key; righe a vita breve (5 minuti), cancellate non appena consumate. Il QR incorpora solo un URL (`/pair/<id>`), niente lettore di QR scritto apposta.

Verificato con un e2e a due browser context separati: un dispositivo genera la richiesta e resta in attesa (polling), l'altro la approva, il primo si sblocca da solo.

### FASE 13, primo passo --- sblocca il vault con l'impronta o Face ID, non solo con la master password

**Cosa fa:** in Impostazioni > Sicurezza puoi "rendere fidato" il dispositivo in uso (richiede la master password una volta): da quel momento puoi sbloccare con l'impronta o Face ID. "Dimentica questo dispositivo" annulla la fiducia in un clic.

**Note tecniche:** primo dei quattro passi di FASE 13. Usa l'estensione PRF di WebAuthn (`lib/crypto/device-lock.ts`): a differenza del normale uso per il login, PRF restituisce un valore pseudo-random legato alla credenziale, mai il segreto sottostante --- il suo output alimenta HKDF, come per password/recovery key. La chiave derivata cifra una copia del Master Key che vive solo in `localStorage`; il server sa solo che il dispositivo esiste, mai il segreto che lo sblocca. Sciolta consapevolmente la decisione architetturale della spec (Master Key *non-extractable*): `unlockMasterKeyWithPassword` accetta un flag `extractable`, usato solo in questo punto.

Verificato con un vero autenticatore WebAuthn (l'autenticatore virtuale di Chrome DevTools Protocol, `hasPrf: true`, non mockato).

### Bug corretto: il tasto ☰ poteva restare senza effetto subito dopo il login

**Cosa fa:** in alcuni casi, toccare ☰ appena arrivati sulla Dashboard non apriva il menu --- bastava cambiare sezione e tornare indietro perché funzionasse di nuovo. Ora si apre subito, anche al primissimo tocco.

**Note tecniche:** diagnosticato isolando una sequenza riproducibile (chiudere il popup "Crea la tua master key" e toccare subito ☰) e tracciando i render di `useMountedTransition`. Il momento critico coincide sempre con il montaggio di altri componenti dentro il cassetto appena apparso --- corretto con un effetto separato che riafferma lo stato "montato" se il primo tentativo non ha avuto seguito.

### Bug corretto: il menu di navigazione (☰ su smartphone, barra laterale sopra) scorreva via con la pagina

**Cosa fa:** su una pagina più alta di una schermata, il menu ☰ e la barra laterale ora restano sempre visibili scorrendo, invece di scorrere via col resto del contenuto.

**Note tecniche:** due cause. (1) `<aside>` non aveva un'altezza propria né `position: sticky` --- per flexbox seguiva l'altezza di `<main>`, finendo alto migliaia di pixel su pagine lunghe. Aggiunto `md:sticky md:top-0 md:h-screen` a Sidebar, `sticky top-0` a TopNav/MobileNavBar. (2) `overflow-x: hidden` era impostato sia su `<html>` che su `<body>`: la regola CSS che accoppia gli assi trasformava entrambi in contenitori di scroll verticale ambigui, e un elemento sticky si ancorava a quello sbagliato. Rimosso da `<body>`, lasciato solo su `<html>`.

Verificato con `sticky-nav.spec.ts`. Nota separata: emerso un secondo bug distinto, non ancora corretto --- il cassetto mobile non si apre se aperto dalla pagina Impostazioni specificamente.

### FASE C1 --- una capsula chiusa e condivisa diventa davvero apribile da chi la riceve

**Cosa fa:** se un amico "✓ Su Hinthial" è tra i destinatari di una capsula, chiudendola e condividendola la ritrova in "Condivise con me", con lo stesso countdown. Dalla data di apertura compare "🔓 Apri", che mostra il contenuto decifrato sul suo dispositivo con la sua Master Key, mai con la tua.

**Note tecniche:** ogni account guadagna una coppia di chiavi ECDH (P-256), pubblica in chiaro e privata cifrata dalla Master Key del proprietario. Le capsule cifrano il payload direttamente con la Master Key del proprietario (non con una Document Key indipendente): condividerlo richiede quindi una seconda cifratura parallela --- alla chiusura, una coppia ECDH effimera deriva una chiave AES-256-GCM condivisa con la chiave pubblica del destinatario, che cifra una copia del contenuto in una nuova tabella (`capsule_share_keys`). Il destinatario rideriva la stessa chiave con la propria privata (proprietà simmetrica di ECDH). La data di apertura è verificata dal database stesso via RLS, non solo dal client. Non è ancora il Dead Man's Switch --- resta apertura manuale a data fissa.

Verificato con un e2e dedicato (due account reali) e un unit test sullo scambio di chiavi che prova che il segreto condiviso è lo stesso su entrambi i lati e che un terzo non può derivarlo.

## 2026-09-14

### Bug corretto: un amico collegato a un account non si scollegava più cambiandogli l'email

**Cosa fa:** se un amico "✓ Su Hinthial" cambia email, il collegamento (e la foto reale mostrata) ora si azzera subito, invece di restare agganciato all'account di prima. Si ricollega da solo se la nuova email corrisponde a un altro account.

**Note tecniche:** `updateFriend()` non toccava mai `linked_user_id`, e `checkLinkedAccounts` riprova il collegamento solo per chi non ne ha già uno --- combinati, un amico già collegato non veniva più ricontrollato per il resto della sua vita. `EditFriendForm` confronta ora l'email scritta con quella originale e passa un flag `emailChanged` a `updateFriend()`, che azzera `linked_user_id` nella stessa scrittura (mai `avatar_path`, indipendente dall'email).


### Ottimizzazioni di velocità: meno un giro di rete per pagina, meno codice caricato a vuoto

**Cosa fa:** le pagine dovrebbero rispondere un po' più svelte, in particolare al login e nel passaggio tra sezioni --- nessun cambiamento visibile in interfaccia.

**Note tecniche:** misurato con un confronto reale dev-vs-produzione (buona parte della "lentezza" percepita in sviluppo è Turbopack che compila ogni pagina al primo accesso, assente in produzione). Due interventi validi: `getCurrentUser()` non richiama più `supabase.auth.getUser()` ma legge la sessione già verificata da `src/proxy.ts`; la libreria `qrcode` (solo per il QR del kit di recovery) passa da import statico (spedito con ogni pagina protetta da `RequireMasterKey`) a import dinamico, caricato solo quando serve.

### "Novità" diventa una voce di menu a sé, non più una card in Dashboard

**Cosa fa:** la card "Novità" sparisce dalla Dashboard --- una nuova voce di menu apre una pagina a sé con le ultime 10 modifiche in tabella e un tasto "Vedi tutte".

**Note tecniche:** `UpdatesPanel` riusa lo stesso `domain/product-updates/repository.ts`, un solo caricamento di tutte le righe. Voce di menu con `requiresEncryption: false`: contenuto globale, non serve la master key.

### Voci del menu principale: quali mostrare, e in che ordine

**Cosa fa:** in Impostazioni > Aspetto si sceglie ora quali voci compaiono nel menu principale e in quale ordine --- stesso meccanismo già usato per la barra in basso su smartphone.

**Note tecniche:** nuova colonna `profiles.main_nav_items` (jsonb) e `lib/main-nav.ts`/`useOrderedNavItems()`. A differenza della barra in basso, nascondere una voce qui non toglie l'accesso: resta raggiungibile da Dashboard o dalla ricerca globale.

### Impostazioni: Aspetto a due colonne, contenuto a piena larghezza ovunque

**Cosa fa:** in Impostazioni > Aspetto le sezioni si affiancano su due colonne su schermi larghi. In generale, ogni scheda di Impostazioni usa ora tutta la larghezza disponibile.

### Onboarding: rispetta "Nascondi" anche in Dashboard

**Cosa fa:** una volta scelto "Nascondi" per il gadget Onboarding, la checklist non ricompare più nemmeno come card in Dashboard.

### Foto di un amico/del profilo: fotocamera e galleria, ognuna il suo tasto

**Cosa fa:** "Carica foto" apre sempre la galleria; "Scatta foto" apre sempre la fotocamera (prima entrambi aprivano la fotocamera su smartphone). Su desktop, "Scatta foto" accende ora davvero la webcam con anteprima dal vivo.

**Note tecniche:** due `<input type="file">` distinti invece di uno con `capture` attivato al volo (quel trucco dipende dal blur, che su alcuni browser/OS mobile non scatta mai dopo aver annullato la fotocamera). Su desktop, `getUserMedia` con un fotogramma catturato su `<canvas>`.

### Amici: foto profilo, anche per gli account collegati

**Cosa fa:** ogni amico può avere una foto (caricata a mano, con lo stesso ritaglio a quadrato del profilo) oppure, se già un account Hinthial collegato, la sua foto vera in automatico. Una foto caricata a mano vince sempre su quella reale.

**Note tecniche:** `AvatarPickerCrop` estrae il ritaglio già scritto per `AvatarUploadForm` in un componente riusabile. Nuova colonna `friends.avatar_path` (bucket pubblico, in chiaro, come l'avatar del profilo). Per la foto reale di un account collegato, una funzione dedicata `get_linked_friend_avatar_path` (SECURITY DEFINER) restituisce solo il path, verificando il possesso della riga `friends` --- niente accesso diretto alla riga `profiles`, che ha parecchie colonne non pertinenti.

### Il "Nome" degli amici diventa "Nome visualizzato"; aggiunti Nome e Cognome

**Cosa fa:** il campo "Nome" diventa "Nome visualizzato". Due nuovi campi facoltativi, Nome e Cognome, aggiornano da soli il Nome visualizzato come "Nome Cognome" finché non lo si tocca direttamente.

**Note tecniche:** due nuove colonne cifrate `encrypted_first_name`/`encrypted_last_name`, nullable. La sincronizzazione vive lato client (`displayNameEdited`, booleano che smette di seguire dopo il primo tocco diretto); in modifica, lo stato iniziale si deduce confrontando il nome salvato con "nome cognome" attuale.

### Novità in Dashboard: la storia di Hinthial raccontata a te

**Cosa fa:** una nuova sezione "Novità" in Dashboard mostra le ultime 5 modifiche, spiegate in modo amichevole e rivolte all'utente --- non il changelog tecnico. "Vedi tutte" apre un pannello cercabile.

**Note tecniche:** nuova tabella `product_updates` (title, description, published_on), la prima senza `owner_id`: contenuto uguale per tutti, una sola policy RLS in lettura, nessuna scrittura dal client --- si popola solo da migrazioni. Backfill storico curato a mano, riscritto in seconda persona.

### Il countdown delle capsule diventa un cartellino che scatta; puoi nasconderlo

**Cosa fa:** il conto alla rovescia verso l'apertura di una capsula è ora un cartellino animato con giorni/ore/minuti/secondi, aggiornato dal vivo (i primi tre con un "flip" meccanico). Oltre i 100 giorni un numero secco lo sostituisce; una volta raggiunta la data, un badge "🔓 Disponibile da adesso". Un interruttore in Impostazioni > Aspetto lo nasconde ovunque.

**Note tecniche:** `computeCountdownParts` scompone il tempo restante per difetto (mai arrotondato, a differenza dell'etichetta testuale già esistente, fonte dell'aria-label). Un solo `setInterval` al secondo condiviso da ogni `CapsuleCountdown` montato, non uno per riga.

### Il conto alla rovescia della capsula scende a ore e minuti; compare solo dopo la chiusura

**Cosa fa:** sotto un giorno, il conto alla rovescia dice "si aprirà tra 16 ore" invece di "oggi", e sotto l'ora i minuti. Compare solo sulle capsule chiuse o condivise, non sulle bozze (dove la data può ancora cambiare).

**Note tecniche:** `computeCountdown` ramifica sulla differenza esatta in millisecondi da `openAt`, non solo sulla data di calendario, con i valori clampati (23h/59min) per evitare che un arrotondamento al bordo mostri "24 ore".

### La data di apertura di una capsula diventa data e ora

**Cosa fa:** "Si aprirà il ..." chiede ora anche l'orario, non solo il giorno, mostrato ovunque compaia una data di apertura.

**Note tecniche:** `CapsuleOpenAtField` passa da `<input type="date">` a `<input type="datetime-local">`; verso l'esterno `value`/`onChange` restano un ISO datetime UTC, come ogni altra data dell'app. Colonna `capsules.open_at` da `date` a `timestamptz`.

## 2026-09-12

### "Condivise con me" dentro Capsule (FASE B della condivisione capsule)

**Cosa fa:** in Capsule c'è ora una scheda "Condivise con me" --- le capsule che altri amici (già collegati a un account Hinthial) hanno condiviso: da chi, quando, e la data di apertura. Il contenuto non è ancora consultabile, arriverà con lo scambio di chiavi di una fase futura. Se un amico riceve una capsula prima di registrarsi, la capsula compare comunque retroattivamente non appena il suo account viene riconosciuto.

**Note tecniche:** nuova tabella `capsule_shares`, creata da `shareCapsule()` per ogni destinatario già collegato, e retroattivamente da `syncCapsuleSharesForLinkedFriend()`. Due nuove policy RLS lasciano al destinatario solo status/data apertura/nome mittente --- `encrypted_payload` resta illeggibile per lui quanto per il server.

Verificato end-to-end con due account reali, incluso lo scenario retroattivo completo.

### Hinthial riconosce da solo quali amici hanno un account (FASE A della condivisione capsule)

**Cosa fa:** in Amici, ogni amico la cui email corrisponde a un account Hinthial registrato mostra un badge "✓ Su Hinthial", anche se registrato *dopo* essere stato aggiunto. Ricontrollo automatico a ogni apertura della pagina. Non concede ancora alcun accesso: è il primo passo (di quattro) verso la condivisione reale del contenuto di una capsula.

**Note tecniche:** nuova colonna `friends.linked_user_id`, risolta da `lookup_friend_account(target_email)` (SECURITY DEFINER) che verifica una email alla volta contro `auth.users`/`profiles` --- mai un elenco bulk, perché l'email dell'amico resta cifrata con la Master Key di chi lo ha aggiunto. Tetto di 200 verifiche al giorno per chi chiama, per mitigare l'uso come oracolo di enumerazione account.

### "Contatti fiduciari" diventa "Amici"; il flag "amico" diventa "Guardiano"

**Cosa fa:** la sezione "Contatti"/"Contatti fiduciari" diventa **Amici** ovunque nell'app. Il flag che segnala chi riceve un avviso in caso di inattività prolungata diventa **Guardiano**.

**Note tecniche:** rinominati route, componenti (`TrustedContactsPanel` → `FriendsPanel`, ecc.), dominio (`domain/contacts` → `domain/friends`, `isFriend` → `isGuardian`) e ogni riferimento interno (categorie audit, timeline, contatori). Migrazione DB: tabella `trusted_contacts` → `friends`, colonna `is_friend` → `is_guardian`. Formato di esportazione dati portato a `hinthialExportVersion: 2`. Nessun dato reale da preservare (progetto in sviluppo).

### Ridotto al minimo lo spazio riservato in fondo lista per il "+" in sovraimpressione

**Cosa fa:** lo spazio vuoto in fondo alle liste su smartphone, per non coprire l'ultima riga col "+" (v. voce precedente), è ora molto più piccolo.

**Note tecniche:** il fix precedente sommava due riserve invece di sottrarle (`<main>` riserva già `pb-24` per la barra di navigazione fissa, e il fix aggiungeva l'intero ingombro del FAB sopra), lasciando ~134px di troppo. Corretto calcolando solo la differenza (`pb-[calc(3rem+env(safe-area-inset-bottom))]`): margine sceso a ~30px, ancora senza sovrapposizione.

### Bug corretto: il "+" in sovraimpressione bloccava il menu azioni dell'ultima riga di una lista

**Cosa fa:** in fondo a una lista lunga su smartphone, il tasto "⋮" dell'ultima riga non finisce più coperto dal "+" tondo.

**Note tecniche:** il FAB occupa un rettangolo fisso in basso a destra; l'ultima riga di una lista lunga ci finiva sotto, e il tocco veniva intercettato dal FAB (z-index più alto). Riservato un padding-bottom pari all'ingombro del FAB più margine su ognuno dei cinque componenti interessati.

### Su smartphone, il tasto "aggiungi" diventa un "+" tondo in sovraimpressione

**Cosa fa:** in Archivio, Beni, Contatti, Scadenze e Capsule, su smartphone il tasto "aggiungi" è ora un pulsante rotondo fisso in basso a destra, sempre raggiungibile senza scorrere. Su desktop e tablet nulla cambia.

**Note tecniche:** nuovo componente condiviso `MobileAddFab.tsx` (`sm:hidden`); il tasto originale diventa `hidden sm:block` in ciascuno dei cinque componenti.

### Barra di navigazione in basso: 5 voci invece di 4, e ora riordinabili da Impostazioni

**Cosa fa:** in Impostazioni > Aspetto si scelgono ora fino a 5 voci (prima 4) per la barra in basso su smartphone, e il loro ordine (trascinamento o frecce ▲▼).

**Note tecniche:** `MAX_BOTTOM_NAV_ITEMS` da 4 a 5. Corretto anche un bug per cui `BottomNavBar.tsx` ignorava del tutto l'ordine scelto, renderizzando sempre l'ordine fisso di `NAV_ITEMS` --- riordinare non aveva mai avuto effetto visibile finché non risolto qui.

### Su smartphone, il tasto "aggiungi" scende sotto il titolo per lasciare tutta la larghezza alla descrizione

**Cosa fa:** su smartphone il tasto "+ Aggiungi/Crea" compare ora in una riga propria sotto titolo e descrizione, che guadagna così tutta la larghezza. Su desktop e tablet nulla cambia.

**Note tecniche:** il fix precedente (`min-w-0 flex-1`) risolveva lo spreco orizzontale ma non lo "sfratto" del testo, dato che il contenitore condivideva ancora la riga col tasto. Cambiato il contenitore esterno a `flex flex-col items-start gap-4 sm:flex-row sm:justify-between` in tutti e cinque i componenti.

### Intestazione allineata nelle pagine con tasto "aggiungi": titolo e descrizione ora usano tutta la larghezza

**Cosa fa:** la descrizione sotto il titolo non va più a capo prematuramente lasciando spazio vuoto prima del tasto "+ Aggiungi/Crea".

**Note tecniche:** il contenitore titolo+descrizione non aveva `flex-1`, restando shrink-to-fit invece di espandersi. Aggiunto `min-w-0 flex-1` in tutti e cinque i componenti.

### Capsule: descrizione più corta, spiegazione completa solo su richiesta

**Cosa fa:** sotto il titolo di Capsule compare ora una sola riga breve; il dettaglio completo resta disponibile aprendo "Come funziona chiudere una capsula".

**Note tecniche:** nessuna perdita di sicurezza --- l'avviso sull'irreversibilità era già ripetuto nella conferma al momento di chiudere per davvero. Disclosure nativa (`<details>`/`<summary>`).

### Bug corretto: icone di Impostazioni quasi invisibili sulle schede con nome lungo

**Cosa fa:** le icone di "Informazioni utente" e "Intelligenza artificiale" si schiacciavano quasi fino a sparire per via delle etichette lunghe --- ora restano sempre alla loro dimensione piena.

**Note tecniche:** le icone non avevano `flex-shrink: 0`, restringendosi fino quasi a zero pixel in un contenitore stretto col testo senza a capo. Aggiunto `shrink-0` e allargata la colonna della barra laterale.

### "Intelligenza artificiale" è ora una scheda a sé in Impostazioni

**Cosa fa:** il consenso all'IA reale ha ora una scheda dedicata, allo stesso livello di Sicurezza/Privacy/Categorie, invece di vivere dentro Privacy.

**Note tecniche:** `PrivacyPanel.tsx` tornato alla sua forma precedente; `AIConsentSettings` renderizzato da un nuovo caso `"ai"` in `SettingsTabs.tsx`.

### Consenso all'IA reale a due livelli: cancello generale + funzioni specifiche

**Cosa fa:** in Impostazioni > Privacy compare un interruttore generale ("Consenti l'uso di IA esterna"), spento di default, che sblocca la possibilità di accendere una per una le funzioni specifiche sotto (oggi solo "Chat"). Spegnere il cancello generale spegne anche tutte le funzioni; riaccenderlo non le riaccende da sole. Ogni domanda che raggiunge Claude lascia traccia in Impostazioni > Attività.

**Note tecniche:** `profiles.ai_processing_consent` rinominata in `ai_chat_consent` + nuova colonna `ai_master_enabled`. La route `/api/ai/chat` riverifica entrambi i valori sul database, non il solo stato client, e registra un nuovo evento audit (`ai_chat_used`).

## 2026-09-10

### FASE 11 --- prima fetta di HINTHIAL AI reale ("Explicit AI processing")

**Cosa fa:** nella pagina AI compare un interruttore "Attiva risposte reali" (spento di default): attivato, le domande vengono elaborate da Claude invece che dal solo motore locale. Solo la domanda e i pochi elementi dei dati effettivamente pertinenti vengono inviati, mai l'intero archivio né il testo delle capsule (solo titolo/stato/data).

**Note tecniche:** implementa il vincolo di privacy di HINTHIAL_MVP.md sezione 8 ("Explicit AI processing"). Il retrieval resta locale e gratuito (`mockAIProvider.retrieve()`): decide quali elementi sono pertinenti prima che un byte lasci il dispositivo, poi li proietta sui campi essenziali (`projectSource`) e li invia a `POST /api/ai/chat`, l'unico punto di contatto con l'API Anthropic (`ANTHROPIC_API_KEY` solo lì) --- la route riverifica il consenso sul database, non sul solo stato client.

### "Asset" rinominato in "Beni"

**Cosa fa:** la sezione "Asset" si chiama ora "Beni" in tutta l'app --- era l'unica voce di navigazione rimasta in inglese.

**Note tecniche:** rinomina di sola interfaccia --- nomi di file/route/colonne DB restano in inglese (`/assets`, `AssetIcon`, ecc.), dato che "asset" ne è già la traduzione corretta.

### Impostazioni su smartphone: elenco -> dettaglio invece della fila di schede

**Cosa fa:** su smartphone, Impostazioni mostra ora un elenco di voci; toccandone una si vede solo il suo contenuto, con "← Torna alle impostazioni" per uscirne. Da desktop nulla cambia.

**Note tecniche:** due blocchi indipendenti in `SettingsTabs.tsx` (`md:hidden`/`hidden md:flex`), che condividono la stessa `renderPanel(activeTab)`. Transizione con dissolvenza (`useCrossfade`) tra elenco e dettaglio.

### Tasto "Scatta foto" per aggiungere contenuto all'Archivio da smartphone

**Cosa fa:** nel form "Carica un file" di Archivio, su smartphone compare "📷 Scatta foto" che apre direttamente la fotocamera, invece della libreria file.

**Note tecniche:** nessun secondo `<input type="file">` nel DOM --- lo stesso input riceve `accept="image/*"`/`capture="environment"` un istante prima del click, perdendoli al `blur` successivo.

### Vista a elenco forzata su smartphone, dove la tabella non ha spazio

**Cosa fa:** su schermi stretti, ogni sezione con liste mostra sempre la vista a elenco, anche se la preferenza salvata è "tabella". La preferenza resta intatta e si applica di nuovo su schermi più larghi.

**Note tecniche:** nuovo `useMediaQuery`; `ListViewPreferencesProvider.modeFor` forza `"list"` sotto i 768px, a monte delle 6 sezioni.

### Barra di navigazione fissa in basso su smartphone

**Cosa fa:** su smartphone compare una barra fissa in basso con le voci di navigazione scelte dall'utente (fino a 4, di default Dashboard/Archivio/Scadenze/Capsule); quelle non scelte restano nel menu con le 3 lineette.

**Note tecniche:** nuova colonna `profiles.bottom_nav_items` (jsonb) sincronizzata sul server, letta lato server come `nav_orientation` per evitare un lampo delle icone sbagliate. Nuovi file: `lib/bottom-nav.ts`, `BottomNavItemsProvider.tsx`, `BottomNavBar.tsx`, `BottomNavItemsSettings.tsx`.

### Bug corretto: la dissolvenza tra le schede di Impostazioni non cambiava mai contenuto

**Cosa fa:** cliccando una scheda diversa in Impostazioni, il contenuto restava fermo sulla prima --- corretto lo stesso giorno in cui la dissolvenza era stata introdotta.

**Note tecniche:** `useCrossfade` faceva scambio del contenuto e programmazione del fade-in nello stesso effetto React: lo scambio (`setDisplayed`) faceva ripartire l'effetto, la cui pulizia cancellava il frame d'animazione appena programmato, che quindi non scattava mai. Diviso in due effetti indipendenti.

### Vista a elenco delle capsule: senza il testo del messaggio

**Cosa fa:** l'elenco delle capsule non mostra più il testo del messaggio, già leggibile in "Modifica" o nell'anteprima.

### Dashboard: niente più scorrimento orizzontale su smartphone

**Cosa fa:** su schermi stretti, contatori e card della dashboard restano entro i bordi dello schermo.

**Note tecniche:** `min-w-0` sui contenitori flex/grid (un elemento a larghezza intrinseca, come un nome file lungo, può impedire alla colonna/griglia di restringersi sotto quella larghezza) più `overflow-x: hidden` su `html`/`body` come rete di sicurezza.

### Dashboard: "Da tenere d'occhio" in una riga a sé

**Cosa fa:** il riquadro "Da tenere d'occhio" ha ora una riga propria a piena larghezza, invece di stare nella colonna stretta con "Onboarding".

### Animazioni di entrata/uscita per barra laterale, menu mobile, pannelli e popup

**Cosa fa:** diversi passaggi dell'interfaccia (comprimere la barra laterale, aprire il menu mobile, i pannelli laterali, il cambio scheda in Impostazioni, la ricerca globale, l'anteprima capsula) sono ora fluidi invece di scattare di colpo.

**Note tecniche:** due hook condivisi, nessuna libreria di animazione. `useMountedTransition(open, durationMs)` tiene un elemento montato per tutta la durata della transizione di uscita (altrimenti React lo toglierebbe dal DOM prima che l'animazione inizi). `useCrossfade(value, durationMs)` gestisce una dissolvenza tra due contenuti diversi. Il "mount" deve avvenire nello stesso render in cui `open` diventa vero, non un render dopo tramite un effetto, altrimenti un effetto del chiamante (es. il focus in `GlobalSearch`) troverebbe l'elemento non ancora nel DOM.

---

## 2026-09-09

### Anteprima capsula più larga

**Cosa fa:** il popup "Così la vedrà chi la riceve" è ora più largo su schermi ampi --- su mobile invariato.

**Note tecniche:** `max-w-lg` → `max-w-4xl` in `CapsulePreview.tsx`.

### Le capsule scritte come una lettera, non un form

**Cosa fa:** scrivere e modificare una capsula ha ora il tono di una lettera, non di un modulo --- destinatari mostrati come su una busta (iniziali colorate + nome sotto "A"), data di apertura come frase ("Si aprirà il ..."), messaggio scritto su una vera superficie di carta calda con un interruttore "Scrittura semplice / A mano" che passa a un font manoscritto (Caveat, salvato con la capsula). Gli allegati audio/video diventano un'aggiunta discreta dietro "+ Aggiungi un allegato".

**Note tecniche:** nuovo campo `contentStyle` ("simple" | "handwritten") cifrato nel payload come ogni altro campo. Nuovi componenti condivisi: `CapsuleOpenAtField`, `CapsuleLetterEditor`. Font Caveat caricato via `next/font/google` (solo peso 600).

### Hinthial installabile come app (PWA)

**Cosa fa:** Hinthial può ora essere installata sul dispositivo --- su Android/Chrome/Edge il browser propone l'installazione da sé, su iOS/Safari va aggiunta a mano.

**Note tecniche:** `app/manifest.ts` con `display: "standalone"`. Icone in due varianti da `public/brand/logo.svg`: "any" e "maskable" (con margine extra, per il ritaglio a maschera di Android). `public/sw.js` minimo, richiesto per l'installabilità --- **nessuna cache offline**, di proposito: richiederebbe decidere con cura se conservare contenuti decifrati sul dispositivo, cosa che lo zero-knowledge non prevede oggi.

### Bug corretto: modificare una capsula/un contenuto d'Archivio poteva silenziosamente scartare le modifiche

**Cosa fa:** modificare il titolo o la data di apertura di una capsula esistente a volte non salvava la modifica, pur mostrando "Capsula aggiornata."

**Note tecniche:** l'effetto che carica i dati esistenti nel form (`refresh()`) viene invocato due volte in sviluppo da React StrictMode; senza protezione, se la prima invocazione risolve dopo la seconda, sovrascrive silenziosamente ciò che l'utente ha già modificato nel frattempo. Riprodotto in modo affidabile (75% su 4 tentativi) isolando il test e2e. Corretto in `EditCapsuleForm.tsx` ed `EditArchiveItemForm.tsx` con un contatore di richieste (`useRef`) che scarta il risultato di una fetch superata, stesso principio del flag `cancelled` già usato in `MasterKeyProvider`.

### Titolo di ogni pagina: stesso carattere del logo, colore brand

**Cosa fa:** il titolo principale di ogni pagina usa ora lo stesso carattere della scritta "Hinthial" nel logo (Baloo 2) ed è del blu del brand invece di nero.

**Note tecniche:** Baloo 2 applicato solo a `h1` in `globals.css`. Il colore non può passare dalla stessa regola CSS (ogni `<h1>` ha già una classe Tailwind di colore, che vince su un selettore d'elemento) --- corretto cambiando quella classe in `text-brand` su ognuno dei 29 file con un `<h1>`. Esclusa la hero della homepage e il kit di recovery stampabile (colori fissi per la stampa).

### Pagine di inserimento/modifica a piena larghezza

**Cosa fa:** le pagine di inserimento e modifica usano ora tutta la larghezza disponibile, invece di restare compresse in una colonna centrale.

**Note tecniche:** rimosso `max-w-2xl` dal contenitore esterno in tutti e 9 i file --- i campi dentro erano già organizzati con `flex-wrap`/`flex-1`, non hanno richiesto altre modifiche.

### Icona "Informazioni utente" allineata alle altre in Impostazioni

**Cosa fa:** l'icona della scheda "Informazioni utente" non appare più più piccola delle altre.

**Note tecniche:** `UserIcon` aveva una geometria (testa+spalle sottili) che riempiva meno del riquadro rispetto a icone più "piene" --- allargata per occupare lo stesso spessore visivo.

### Icona lucchetto aperto sul bottone "Sblocca"

**Cosa fa:** il bottone "Sblocca" ha ora un'icona a forma di lucchetto aperto.

### Identità visiva "Fresh Clarity" su homepage e schermate di autenticazione

**Cosa fa:** la homepage e le schermate di login/registrazione/verifica/password dimenticata adottano lo stile del mockup "FreshHero": sfondo grigio-azzurro con una "bolla" mint decorativa dietro l'hero, badge "Zero-knowledge davvero", bottone principale con freccia e ombra colorata, card più arrotondate. Le pagine di autenticazione vivono ora dentro una vera card bianca.

**Note tecniche:** la "bolla" è un `background` (radial-gradient) su un `<div aria-hidden>` assoluto, non un'immagine posizionata, per non alterare le dimensioni della pagina. Un solo `<main>` per pagina (due landmark "main" confonderebbero uno screen reader).

Verificando con l'intera suite e2e sono emersi due problemi, corretti: 21 asserzioni in 11 file cercavano ancora il vecchio testo con emoji rimossa in una modifica precedente di oggi; la nuova frase "Hai già un account? Accedi" nell'hero duplicava il link "Accedi" già presente in alto, ambiguo per 2 test.

**Bug scoperto, non di questa modifica**: `capsules.spec.ts` --- dopo aver modificato il titolo di una capsula già creata, l'elenco non mostra il titolo aggiornato. Riproducibile due volte su due, non collegato a modifiche di oggi (verificato sul diff), segnalato all'utente.

### Icone in Impostazioni, icone di sistema color-logo, dati personali affiancati

**Cosa fa:** tre ritocchi --- ogni scheda di Impostazioni ha ora un'icona a linea accanto all'etichetta; tutte le icone di sistema sono dello stesso blu del logo (eccetto "Zona pericolosa", nel proprio rosso); in Dati personali, Nome/Cognome/Data di nascita sono ora affiancati su schermi larghi.

**Note tecniche:** 7 nuove icone in `icons/nav-icons.tsx`, colore passato esplicitamente come `className="text-brand"` (non più ereditato da `currentColor`, altrimenti lo sfondo della voce attiva lo renderebbe invisibile). I tre campi di "Dati personali" affiancati via container query (`@container`/`@xl:grid-cols-3`, non `sm:`/`md:`), per reagire allo spazio vero del pannello e non a quello della finestra.

### Identità visiva: colore e tipografia "Fresh Clarity"

**Cosa fa:** l'accento blu è più vivo, e i titoli passano da un font generico a Manrope (corpo del testo a Work Sans) --- direzione visiva scelta dopo aver mostrato all'utente alcune proposte di stile.

**Note tecniche:** il colore è cambiato in un solo punto (`--brand`/`--brand-hover`), propagato senza toccare i singoli componenti perché l'app usa già quelle variabili invece di classi Tailwind fisse.

### Identità visiva: icone di sistema "Fresh Clarity"

**Cosa fa:** le icone della barra di navigazione, dei contatori e dei badge di stato non sono più emoji ma icone a linea, nello stesso stile del mockup. Le emoji restano dove sono una scelta dell'utente o un ornamento nel testo di un bottone.

**Note tecniche:** nuovo `components/icons/nav-icons.tsx` (SVG 24x24, `stroke="currentColor"`). `NavItem.icon` passa da `string` (emoji) a un componente React. Nuovo `components/ui/SuccessMessage.tsx`, estratto invece di ripetere l'icona in 5 pannelli.

### Identità visiva: bottoni e nav attiva "Fresh Clarity"

**Cosa fa:** i bottoni principali hanno angoli più smussati; la voce attiva nella barra di navigazione diventa una pillola azzurro chiarissimo con testo blu, non più un riquadro blu piatto.

**Note tecniche:** individuato il pattern ricorrente `rounded-md bg-brand ... hover:bg-brand-hover` (54 occorrenze in 34 file) e portato a `rounded-xl`. Nav attiva: `bg-brand text-white` diventa `bg-brand/10 text-brand`, funzionando automaticamente sia su sidebar bianca che su sfondo scuro.

### Identità visiva: angoli, ombre e sfondo "Fresh Clarity"

**Cosa fa:** card e contenitori con bordo hanno ora angoli più arrotondati e un'ombra leggera, su uno sfondo grigio-azzurro molto chiaro invece di bianco puro; barra laterale e barre di navigazione restano bianche per contrasto.

**Note tecniche:** individuato il pattern ricorrente `rounded-lg border border-zinc-200 ... dark:border-zinc-800` (52 occorrenze in 35 file) e sostituito con uno script mirato (`rounded-2xl` + ombra, solo dove non c'era già uno sfondo esplicito diverso). `--background` (chiaro) da `#ffffff` a `#f7fafb`. Il tema scuro non è cambiato.

---

## 2026-09-08

### Email inviate da Hinthial: invito contatto, cancellazione/reset account

**Cosa fa:** tre funzionalità inviano email vere, la prima volta che Hinthial lo fa da sé: **invita un contatto** (checkbox nel form, un invio non riuscito non impedisce di salvare); **cancella il tuo account** (nuova sezione in Zona pericolosa, cancella per sempre account e dati, richiede master password e frase di conferma); **reimposta l'account** (prima "Cancella tutto", ora richiede anche la master password).

**Note tecniche:** email inviate via l'API REST di Resend, da Server Actions, mai dal browser (`RESEND_API_KEY` non lo lascia mai). La cancellazione account usa `auth.admin.deleteUser`: ogni riga collegata ha già `ON DELETE CASCADE`, solo gli oggetti di Storage vengono ripuliti a mano. La master password si verifica riprovando a sbloccare (`unlockWithPassword`) --- l'unico modo, dato lo zero-knowledge.

### Popup "Crea la tua master key" al primo accesso

**Cosa fa:** subito dopo il login, chi non ha configurato la cifratura vede un popup che spiega la differenza tra password dell'account e master password, con un tasto che porta al modulo di creazione. Compare una sola volta.

**Note tecniche:** `profiles.master_key_intro_seen` sincronizzato sul server. Nei test e2e, un `page.addLocatorHandler()` lo chiude automaticamente per ogni test che non lo riguarda esplicitamente.

### Onboarding: meno "scatola", più spiegazione

**Cosa fa:** il checklist "Onboarding" non ha più il riquadro attorno alla lista, e sotto il titolo spiega in una riga di cosa si tratta.

### Onboarding: pannello laterale invece del riquadro flottante

**Cosa fa:** il gadget "Onboarding" apre ora un pannello laterale a tutto schermo, invece di un piccolo riquadro ancorato al pulsante --- da quando ogni passo mostra anche una descrizione, il contenuto era diventato troppo alto per il vecchio riquadro.

### Prima esperienza: meno disorientamento al primo accesso

**Cosa fa:** cinque correzioni al percorso di chi usa Hinthial per la prima volta: il modulo "Configura la cifratura" spiega ora la differenza password/master password; l'indicatore Onboarding mostra i primi due passi anche prima di sbloccare il vault; il checklist completo mostra una breve spiegazione sotto ogni passo; l'ordine mette prima i passi concreti; le voci di nav che richiedono la cifratura mostrano un pallino finché non è configurata.

**Note tecniche:** il pallino è espresso via `aria-describedby` su uno `<span>` a parte, mai testo dentro l'etichetta del link, per non rompere la ricerca per nome esatto. Nuova `computeBasicOnboardingSteps()`, gli stessi due oggetti-passo usati anche dalla checklist completa.

### Data di nascita nel profilo

**Cosa fa:** un nuovo campo facoltativo "Data di nascita" in Informazioni utente e in registrazione.

**Note tecniche:** `profiles.birth_date`, in chiaro come nome/cognome --- un dato anagrafico, non del vault.

### Impostazioni: schede riorganizzate e in verticale

**Cosa fa:** le schede di Impostazioni sono ora una barra verticale a sinistra su schermi larghi, in un nuovo ordine.

### Correzione: il gadget "Onboarding" nascosto poteva ricomparire

**Cosa fa:** "Nascondi" ora vale per davvero anche a un login successivo o su un altro dispositivo, non solo per il browser in cui è stato cliccato.

**Note tecniche:** la preferenza passa da solo-`localStorage` a sincronizzata sul server, stesso pattern di `nav_orientation`.

### Impostazioni > Privacy: lista aggiornata

**Cosa fa:** "Quello che vediamo" riflette ora anche la data di nascita, la visibilità del gadget onboarding, e segnala che IP/dispositivo/browser di ogni accesso sono registrati in Attività.

### Impostazioni > Attività: registro interrogabile, con molti più eventi

**Cosa fa:** invece di caricare sempre tutto il registro, ora si interroga per data e categoria; un click su una riga apre un pannello con i dettagli. Nuovi eventi: tentativi di login falliti, verifiche MFA fallite, attivazione/rimozione 2FA, distinzione tra login con password/TOTP/codice di backup, IP e dispositivo di ogni login riuscito.

**Note tecniche:** `audit_events` guadagna una colonna `metadata jsonb` invece di continuare a esplodere l'enum `event_type`. Un tentativo di login errato non ha sessione autenticata: registrato tramite `log_failed_login_attempt` (SECURITY DEFINER) che non rivela mai se l'email corrisponde a un account esistente.

**Bug noto, scoperto ma non risolto (pre-esistente):** in `/login`, dopo un primo tentativo con credenziali sbagliate, un secondo submit (anche con la password corretta) non naviga alla dashboard --- verosimilmente un'interazione tra `useActionState`/Server Actions e i cookie di sessione. Un refresh prima di riprovare aggira il problema.

### Menu di navigazione responsive

**Cosa fa:** su schermi piccoli, la barra laterale è sostituita da un tasto menu (☰) che apre la stessa navigazione in sovraimpressione.

**Note tecniche:** nuovo `MobileNavBar`, montato sempre accanto a `Sidebar`/`TopNav` (nascosti via CSS sotto la soglia `md`, non smontati, per non perdere lo stato di compressione).

### Cronologia: filtri per data e sezione

**Cosa fa:** un filtro per data inizio, data fine e sezione, applicato subito senza un tasto "Cerca".

---

## 2026-09-07

### MFA: codici di backup

**Cosa fa:** in Impostazioni > Sicurezza è ora possibile generare **10 codici di backup monouso**, da usare se si perde l'accesso al dispositivo con l'app authenticator.

**Note tecniche:** salvati come hash SHA-256 in `mfa_backup_codes`, mai in chiaro se non all'istante della generazione. Verificare un codice di backup non alza da sé il livello AAL della sessione per Supabase: un cookie dedicato (`lib/auth/mfa-bypass.ts`) segna "secondo fattore verificato con un codice di backup", cancellato a ogni nuovo login.

**Esplorato ma non implementato: passkey (WebAuthn) come fattore alternativo.** Il codice è stato scritto e verificato fino al punto in cui Supabase lo permetteva, ma il dashboard Authentication non espone alcun modo per attivare "WebAuthn come fattore MFA" (solo per il login primario con passkey, funzionalità diversa). Rimosso in attesa di un percorso stabile.

### Autenticazione a due fattori (TOTP)

**Cosa fa:** nuova scheda "Sicurezza" per attivare l'autenticazione a due fattori con un'app come Google Authenticator. Si possono registrare più dispositivi, ognuno rimovibile.

**Note tecniche:** interamente basata sull'MFA nativo di Supabase Auth --- nessuna crypto custom, non tocca mai la master key. `signIn()` reindirizza a `/login/mfa` quando la sessione è solo `aal1` e può salire ad `aal2`. Un codice non dichiara per quale dispositivo è stato generato: viene provato su ogni fattore registrato.

### Impostazioni > Privacy: "Cosa sa Hinthial di te"

**Cosa fa:** una scheda che confronta, con dati reali dell'account, cosa il server vede in chiaro con cosa non vedrà mai.

**Note tecniche:** ogni query legge solo colonne mai cifrate, quindi non serve la master key sbloccata.

### Impostazioni > Attività: registro degli eventi dell'account

**Cosa fa:** una scheda che mostra il registro tecnico già scritto ad ogni login/logout o contenuto aggiunto/eliminato, raggruppato per giorno e filtrabile per categoria. Mai nomi di file o contatti, solo il tipo di evento.

### Kit di recovery stampabile con QR

**Cosa fa:** alla creazione della master password, "Stampa kit di recovery" accanto a copia/download .txt --- un foglio con la recovery key in grande e un QR code.

**Note tecniche:** il QR è generato interamente lato client, la chiave non lascia mai il browser.

### Modifica di una capsula: stessi tre passi della creazione

**Cosa fa:** la modifica di una capsula è ora organizzata negli stessi tre passi della creazione, invece di un unico form.

### Onboarding: nascondibile dalla barra, e una pagina dedicata in Impostazioni

**Cosa fa:** il pannello Onboarding ha ora un pulsante "Nascondi" per questo dispositivo. L'avanzamento resta consultabile in una nuova voce "Onboarding" tra le schede di Impostazioni, con lista completa dei passi e stato di ciascuno.

**Note tecniche:** la preferenza "nascosto" vive solo in localStorage, condivisa tramite un nuovo `OnboardingWidgetVisibilityProvider` (necessario perché la barra di navigazione resta montata attraversando le pagine).

### Rifiniture: logo e colore dell'indicatore Onboarding

**Cosa fa:** il logo nella barra orizzontale è ora della stessa dimensione della home page pubblica. L'anello dell'indicatore diventa verde al 100%.

### Disposizione del menu di navigazione

**Cosa fa:** in Impostazioni > Aspetto si sceglie ora come disporre il menu: barra laterale a sinistra/destra, o orizzontale in alto --- sincronizzato su tutti i dispositivi.

**Note tecniche:** nuova colonna `profiles.nav_orientation`, letta lato server e passata come prop iniziale ad `AppShell` (deve essere nota prima del primo render, decidendo la struttura dell'intera shell). Corretto anche un effetto collaterale: il popover dell'indicatore Onboarding si apriva sempre verso destra, uscendo dallo schermo con la barra a destra.

### Onboarding, home page pubblica e rifiniture

**Cosa fa:** l'indicatore si chiama ora "Onboarding" (era "Primi passi"), senza più passi "opzionali" (tutti gli 8 contano allo stesso modo). Il carosello della home page avanza da solo ogni 6 secondi (pausa al passaggio del mouse, disattivato con `prefers-reduced-motion`); sotto di esso, sezioni "Perché Hinthial" e "Come funziona".

**Note tecniche:** corretto un bug nel carosello: il mouse resta fermo sopra il componente dopo un click, quindi una pausa-al-focus in più lo avrebbe bloccato per sempre --- risolto tenendo solo la pausa al passaggio del mouse.

### Dead Man's Switch semplificato per le capsule (fase 1 di 3)

**Cosa fa:** ogni capsula richiede ora una data di apertura obbligatoria. Ogni utente deve avere almeno un contatto marcato come "amico" (🤝), prerequisito diventato un passo obbligatorio nell'onboarding.

**Note tecniche:** `capsules.open_at` diventa una colonna in chiaro (era solo nel payload cifrato) --- unica eccezione consapevole allo zero-knowledge in questa tabella, necessaria perché una fase successiva possa sapere *quando* una capsula è pronta senza decifrare nulla. Prima di tre sotto-fasi: mancano ancora la soglia di inattività con promemoria e lo scambio di chiavi che permetterà a un destinatario di decifrare davvero.

### Dashboard: contatori e indicatore di avanzamento

**Cosa fa:** i contatori sono ora centrati, con icona più grande. Nuovo indicatore "Primi passi" sempre visibile nella barra laterale.

**Note tecniche:** la logica dei passi è stata estratta in `domain/onboarding/steps.ts`, condivisa tra dashboard e indicatore, per evitare due liste disallineate.

### Home page pubblica

**Cosa fa:** la pagina pubblica ha ora una barra in alto e un corpo da vera landing page, con un carosello di 5 schermate.

### Documentazione

- Allineata la "Roadmap sintetica" di `HINTHIAL_MVP.md` alle fasi già scritte in dettaglio.
- Aggiunto questo changelog.

---

## 2026-09-04

Un ampio arretrato di funzionalità, sviluppate nel corso di più sessioni precedenti e registrate su git in questa data (v. nota sulle date in cima al file). In ordine di dipendenza (non di importanza):

### Suggerimento automatico della categoria
**Cosa fa:** caricando un contenuto in Archivio, un nome file con parole chiave riconoscibili (es. "polizza-assicurazione-auto.pdf") riceve una categoria suggerita in automatico --- resta comunque una scelta correggibile a mano.

### Ordinamento delle tabelle
**Cosa fa:** in ogni sezione (Archivio, Scadenze, Asset, Contatti, Capsule, Cronologia), passando alla vista a tabella, si può ordinare cliccando l'intestazione di una colonna --- un secondo click inverte la direzione. Le tabelle partono già ordinate per la prima colonna, dalla A alla Z.

### Liste: vista a tabella impaginata, ricerca/filtro, azioni a menu
**Cosa fa:** ogni sezione principale può essere vista come elenco o come tabella (impostabile in Impostazioni > Aspetto, o con l'interruttore rapido nella sezione stessa); le liste lunghe in tabella sono impaginate; ogni sezione ha una ricerca e un filtro in alto; le azioni su una riga (modifica, elimina, ...) sono raccolte in un menu "⋮" invece di pulsanti sparsi.

### Assistente AI locale (FASE 10)
**Cosa fa:** una sezione "AI" dove si possono fare domande sui propri contenuti ("quali assicurazioni ho?", "quando scade la mia assicurazione auto?") e ricevere risposte con citazione delle fonti, più suggerimenti proattivi (scadenze in arrivo o scadute, asset senza documenti collegati). Tutto elaborato sul dispositivo, nessun contenuto lascia mai il browser.

**Note tecniche:** interfaccia `AIProvider` pensata per essere sostituita in futuro da un provider reale, mantenendo esplicito il vincolo di privacy (elaborazione locale, o esplicitamente autorizzata verso un provider esterno) --- v. `domain/ai/mock-provider.ts`.

### Ricerca globale
**Cosa fa:** una ricerca (richiamabile da tastiera) che trova qualunque cosa --- asset, documenti, scadenze, contatti, capsule --- e porta dritti al risultato scelto.

### Cronologia
**Cosa fa:** una vista di sola lettura su asset e documenti aggiunti nel tempo, raggruppati per mese.

### Tema chiaro/scuro/sistema
**Cosa fa:** in Impostazioni > Aspetto si può scegliere tema chiaro, scuro, o "segui il sistema" --- la scelta resta impostata anche dopo un refresh.

### Avatar utente
**Cosa fa:** si può caricare una propria immagine del profilo, ritagliata a quadrato prima del caricamento; senza immagine, iniziali su uno sfondo colorato.

### Registrazione audio/video per le capsule, countdown
**Cosa fa:** creando una capsula, si può registrare un messaggio audio o video direttamente nel browser (oltre a caricarne uno già pronto); se la capsula ha una data di apertura, un countdown testuale ("si aprirà tra N giorni") la accompagna in lista.

### Esporta le scadenze come file .ics
**Cosa fa:** le scadenze si possono scaricare in un file .ics, importabile in qualunque calendario.

### FASE 14 --- Archivio multi-tipo e capsule autosufficienti
**Cosa fa:** "Documenti" è diventato "Archivio" e accetta più tipi di contenuto oltre ai file: immagini, audio, video e note testuali scritte direttamente nell'app --- tutti con gli stessi attributi (categoria, asset collegato, scadenza, tag, note) e un player inline per chi ha senso. La creazione di una capsula è un percorso guidato a tre passi (chi e quando, contenuti dall'Archivio da collegare, audio/video/testo). Chiudere una capsula ora ne fa una copia autosufficiente: da quel momento non dipende più dai contenuti originali in Archivio, che restano liberi di essere modificati o cancellati.

### Trascrizione locale (infrastruttura) e anteprima capsula
**Cosa fa:** un contenuto audio/video in Archivio (o allegato a una capsula) può avere una trascrizione testuale, cercabile come il resto --- oggi va scritta a mano: il motore di trascrizione automatica in-browser non esiste ancora (onestamente segnalato in interfaccia), ma l'infrastruttura è pronta per quando ci sarà. Una capsula si può vedere in anteprima esattamente come la vedrà chi la riceve.

### "Cancella tutto" (zona pericolosa)
**Cosa fa:** in Impostazioni > Zona pericolosa, un'azione (con conferma esplicita, serve scrivere "ELIMINA TUTTO") che svuota Archivio, Asset, Contatti e Capsule, e ripristina le categorie predefinite --- le Scadenze non vengono toccate, restano solo scollegate da ciò che è stato cancellato.

### Dashboard a due colonne
**Cosa fa:** la dashboard è organizzata in due colonne (la prima più larga): a sinistra i contatori per sezione, le prossime scadenze, gli elementi aggiunti di recente e da completare; a destra la guida "Primi passi con Hinthial" e "Da tenere d'occhio" (suggerimenti e salute del vault uniti in un'unica sezione).

### Importa/Esporta spostato in Impostazioni
**Cosa fa:** non più una sezione a sé nel menu principale, ma una scheda di Impostazioni.

### Sidebar comprimibile
**Cosa fa:** la barra laterale si può comprimere a sole icone (tasto dedicato), per avere più spazio; la scelta resta impostata su quel dispositivo dopo un refresh.

### Pagine di modifica dedicate
**Cosa fa:** modificare un elemento di Archivio, Asset, Contatti o Capsule ora apre una pagina a sé (come già succedeva per la creazione), invece di un form inline nella riga della lista.

---

## 2026-09-01

### FASE 6-9 --- Asset, Contatti fiduciari, Capsule, Export
**Cosa fa:** censimento di beni e contratti (Asset) con collegamento a documenti e scadenze; contatti fiduciari con stato (in attesa/attivo/revocato); prima versione delle capsule digitali (titolo, contenuto, allegati, destinatari); esportazione di tutti i propri dati in un unico archivio .zip; importazione di contatti e asset da file CSV.

---

## 2026-08-26 --- 2026-08-28

Le fondamenta del progetto (FASE 0-5):

- **FASE 0-1**: bootstrap del progetto e shell dell'app (navigazione, autenticazione).
- **FASE 2**: autenticazione e database (Supabase Auth, Postgres, Row Level Security).
- **FASE 3**: le fondamenta crittografiche --- Master Key non estraibile, gerarchia di chiavi per documento, tutto costruito solo su Web Crypto API (nessun algoritmo scritto a mano).
- **FASE 4**: il primo vault documentale --- caricamento, cifratura, download e cancellazione di un documento.
- **FASE 5**: metadati (categoria, asset collegato, scadenza, tag, note) e prima versione delle scadenze.
- Rifiniture di marchio e interfaccia: logo ufficiale, colori di brand, pagina di verifica email, indicatore di robustezza della password, recovery key allungata a 384 bit.

---

## Come continuare questo file

Ogni volta che una nuova modifica viene completata e verificata, aggiungere una voce in cima (subito sotto l'ultima data, o in una nuova sezione datata se è un giorno diverso), con lo stesso schema "Cosa fa" / "Note tecniche".
