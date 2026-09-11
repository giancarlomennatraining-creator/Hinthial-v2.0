# Changelog

Registro di tutto ciò che è stato costruito in HINTHIAL, dalla nascita del progetto ad oggi — pensato come base per scrivere documentazione tecnica e guide utente, non come sostituto di nessuna delle due.

**Come leggere una voce:**
- **Cosa fa** --- in linguaggio semplice: cosa può fare oggi chi usa Hinthial, materiale di partenza per una guida utente.
- **Note tecniche** --- dove rilevante, per chi scriverà la documentazione per sviluppatori (scelte architetturali, compromessi accettati consapevolmente, limiti noti).

**Una precisazione sulle date**: riflettono quando ogni funzionalità è stata *registrata su git* (`git log`), non necessariamente il giorno esatto in cui è stata scritta --- un ampio arretrato di lavoro è stato formalizzato in commit separati il 2026-09-04, pur essendo stato sviluppato nel corso di più sessioni precedenti. Da qui in avanti una nuova voce viene aggiunta in cima ad ogni funzionalità completata.

---

## 2026-09-12

### Consenso all'IA reale a due livelli: cancello generale + funzioni specifiche

**Cosa fa:** in Impostazioni > Privacy compare una nuova sezione "Intelligenza artificiale" con un interruttore generale ("Consenti l'uso di IA esterna") --- spento di default. Da solo non attiva nulla: sblocca solo la possibilità di accendere, una per una, le funzioni specifiche elencate sotto (oggi solo "Chat", in futuro altre). Lo stesso interruttore della Chat resta anche nella pagina AI, sincronizzato con quello di Impostazioni --- se ci arrivi senza aver acceso il cancello generale, lo trovi visibile ma disattivato, con un rimando a dove accenderlo. Spegnere il cancello generale spegne anche tutte le funzioni specifiche insieme; riaccenderlo non le riaccende da solo, restano a scelta esplicita una per una. Ogni domanda che raggiunge davvero Claude lascia ora anche una traccia in Impostazioni > Attività.

**Note tecniche:** `profiles.ai_processing_consent` rinominata in `ai_chat_consent` (specifica della Chat) + nuova colonna `ai_master_enabled` (il cancello) --- `updateAIMasterEnabled` spegne entrambe in un solo aggiornamento quando disattivato, mai il contrario. `AIProcessingConsentProvider` espone ora `masterEnabled`/`chatConsent` distinti. La route `/api/ai/chat` riverifica entrambi i valori sul database (non il solo stato client) prima di procedere, e registra un nuovo tipo di evento audit (`ai_chat_used`) dopo una risposta riuscita. Nuovo componente `AIConsentSettings.tsx`, stesso pattern a elenco di `ListViewSettings.tsx`. `ai-processing-consent.spec.ts` riscritto per il percorso a due livelli.

## 2026-09-10

### FASE 11 --- prima fetta di HINTHIAL AI reale ("Explicit AI processing")

**Cosa fa:** nella pagina AI compare un interruttore "Attiva risposte reali" (spento di default): una volta attivato, le domande vengono elaborate da Claude (Anthropic) invece che dal solo motore locale --- prima ancora di attivarlo, tutto resta come oggi (nessun dato lascia il dispositivo). Anche da attivo, solo la domanda e i pochi elementi dei tuoi dati effettivamente pertinenti vengono inviati, mai l'intero archivio, e mai il testo delle capsule (solo titolo/stato/data). La scelta è sincronizzata su tutti i dispositivi, come la disposizione del menu.

**Note tecniche:** implementa il vincolo di privacy di HINTHIAL_MVP.md sezione 8 ("Explicit AI processing", una delle due modalità previste insieme a "Local/private AI", non ancora costruita). Nuova colonna `profiles.ai_processing_consent` (booleano, sincronizzato come `nav_orientation`) + `AIProcessingConsentProvider`. Il retrieval resta locale e gratuito (`mockAIProvider.retrieve()`, già corretto per parole chiave/relazioni): decide QUALI elementi sono pertinenti prima che un byte lasci il dispositivo; solo quelli vengono proiettati sui campi essenziali (`domain/ai/claude-provider.ts`, `projectSource`) e inviati alla nuova route server-side `POST /api/ai/chat`, l'unico punto di contatto con l'API Anthropic (`ANTHROPIC_API_KEY` solo lì, mai `NEXT_PUBLIC_*`) --- la route riverifica il consenso sul valore salvato nel database, non fidandosi del solo stato client. Se nessun elemento locale corrisponde alla domanda, non parte alcuna chiamata di rete. Modello `claude-opus-5` (default del progetto). Nuovi test: unit per `claude-provider.ts` (fetch mockato), e2e `ai-processing-consent.spec.ts` che verifica l'intero percorso reale --- incluso il messaggio di errore quando `ANTHROPIC_API_KEY` non è ancora configurata --- senza spendere una vera chiamata a Claude.

### "Asset" rinominato in "Beni"

**Cosa fa:** la sezione che prima si chiamava "Asset" (immobili, veicoli, account, contratti, assicurazioni, ...) si chiama ora "Beni" in tutta l'app --- menu di navigazione, contatori della dashboard, moduli di creazione/modifica, messaggi di conferma ed errore, assistente AI, ricerca globale, cronologia, importazione/esportazione CSV, e la conferma di "Cancella tutto". Era l'unica voce di navigazione rimasta in inglese, e "asset" suonava più contabile/tecnico di quanto serva per qualcosa che copre anche casa, auto e polizze.

**Note tecniche:** rinomina di sola interfaccia --- come già per "Documenti" -> "Archivio" (v. FASE 14), nomi di file/cartelle/route/colonne DB restano in inglese (`/assets`, `AssetIcon`, `AssetListItem`, `relatedAssetId`, `assets.*` in Supabase, ...), dato che "asset" ne è già la traduzione inglese corretta --- non serviva introdurne una diversa per le URL. L'assistente AI mock riconosce ora "bene"/"beni" come parole scatenanti per "elencameli tutti" (`LIST_ALL_TRIGGERS` in `mock-provider.ts`), non più "asset". Il template CSV di importazione (`domain/import/templates.ts`) usa ora `beni` come prefisso del nome del file scaricato, in linea con gli altri template (`contatti-fiduciari`, `scadenze`), che erano già in italiano. Aggiornati tutti gli e2e e unit test che asserivano sul testo "Asset"/"asset".

### Impostazioni su smartphone: elenco -> dettaglio invece della fila di schede

**Cosa fa:** su smartphone, Impostazioni mostra ora un elenco di voci (Informazioni utente, Sicurezza, Privacy, ...); toccandone una si vede solo il suo contenuto, con un tasto "← Torna alle impostazioni" per uscirne --- invece della fila di schede orizzontale scorrevole di prima. Da desktop non cambia nulla: le schede restano sempre visibili tutte insieme, con il contenuto a fianco.

**Note tecniche:** due blocchi indipendenti in `SettingsTabs.tsx` (`md:hidden` per il cassetto mobile, `hidden md:flex` per le schede desktop), non un solo layout responsive --- condividono la stessa funzione `renderPanel(activeTab)` per non duplicare la logica di quale pannello mostrare. Transizione con dissolvenza (`useCrossfade`, già usata per il cambio scheda da desktop) tra elenco e dettaglio. Nuovo e2e `mobile-settings-nav.spec.ts`.

### Tasto "Scatta foto" per aggiungere contenuto all'Archivio da smartphone

**Cosa fa:** nel modulo "Carica un file" di un nuovo contenuto d'Archivio, su smartphone compare un tasto "📷 Scatta foto" accanto alla scelta file --- apre direttamente la fotocamera del telefono invece della libreria file. Su desktop non compare (non avrebbe un vantaggio pratico lì).

**Note tecniche:** nessun secondo `<input type="file">` nel DOM (rompendo il selettore generico usato da molti e2e) --- lo stesso input riceve gli attributi `accept="image/*"`/`capture="environment"` un istante prima del click programmatico, poi li perde al `blur` (chiusura della finestra di scelta, con o senza foto), tornando al comportamento normale per un click successivo diretto sull'input.

### Vista a elenco forzata su smartphone, dove la tabella non ha spazio

**Cosa fa:** su schermi stretti, ogni sezione con liste (Archivio, Scadenze, Asset, Contatti, Capsule, Cronologia) mostra sempre la vista a elenco, anche se la preferenza salvata è "tabella" --- che lì non avrebbe spazio per restare leggibile. La preferenza resta comunque intatta e si applica di nuovo su uno schermo più largo; l'interruttore rapido di ogni sezione si nasconde su smartphone (mostrerebbe una scelta senza effetto visibile), quello in Impostazioni > Aspetto resta invece sempre disponibile.

**Note tecniche:** nuovo `useMediaQuery` (stesso meccanismo di `ThemeToggle` per "prefers-color-scheme", generalizzato); `ListViewPreferencesProvider.modeFor` forza `"list"` sotto i 768px, a monte delle 6 sezioni, senza toccarne il codice. `ListViewToggle` accetta un prop `hideOnMobile` (usato dalle pagine di sezione, non da `ListViewSettings`, che resta sempre visibile).

### Barra di navigazione fissa in basso su smartphone

**Cosa fa:** nell'esperienza smartphone compare ora una barra fissa in basso con le voci di navigazione scelte dall'utente (fino a 4) --- si scelgono in Impostazioni > Aspetto, con una casella per voce; quelle non scelte restano raggiungibili come prima dal menu con le 3 lineette, che ora mostra solo il resto (niente più doppioni tra le due). Di default: Dashboard, Archivio, Scadenze, Capsule.

**Note tecniche:** nuova colonna `profiles.bottom_nav_items` (jsonb, un array di href) sincronizzata sul server come `nav_orientation` --- stesso pattern "valore iniziale letto lato server" (v. `BottomNavItemsProvider`, `getCurrentUser`), non il fetch lato client lazy di `list_view_preferences`, per evitare un lampo delle icone sbagliate in una chrome persistente della shell. `MainNav` accetta ora un prop opzionale `items` (di default l'elenco completo `NAV_ITEMS`) per poter mostrare un sottoinsieme nel cassetto mobile senza toccare Sidebar/TopNav. Nuovi file: `lib/bottom-nav.ts` (tipo, default, parser sicuro), `BottomNavItemsProvider.tsx`, `BottomNavBar.tsx`, `BottomNavItemsSettings.tsx`. Nuovo e2e (`bottom-nav.spec.ts`): voci di default in barra, personalizzazione da Impostazioni con esclusione reciproca dal menu con le 3 lineette, persistenza al refresh, disabilitazione delle caselle oltre le 4 voci --- `mobile-nav.spec.ts` aggiornato di conseguenza ("Archivio" ora di default in basso, non più nel cassetto).

### Bug corretto: la dissolvenza tra le schede di Impostazioni non cambiava mai contenuto

**Cosa fa:** cliccando una scheda diversa in Impostazioni, il contenuto non passava più alla scheda scelta (restava fermo su "Informazioni utente", la prima) --- corretto lo stesso giorno in cui la dissolvenza era stata introdotta.

**Note tecniche:** `useCrossfade` faceva sia lo scambio del contenuto mostrato sia la programmazione del fade-in nello stesso effetto React. Lo scambio (`setDisplayed`) aggiornava una dipendenza di quell'effetto, facendolo ripartire da capo --- la sua "pulizia" (cleanup) cancellava il frame d'animazione appena programmato un istante prima per il fade-in, che quindi non scattava mai: il contenuto restava tecnicamente aggiornato ma invisibile (opacità 0) per sempre dopo il primo cambio scheda. Diviso in due effetti indipendenti --- uno si occupa solo di aspettare e scambiare il contenuto, l'altro (con la propria dipendenza e la propria pulizia separate) solo di dissolverlo dentro una volta scambiato. Verificato con 16 e2e che passano per le schede di Impostazioni (prima il bug non li faceva fallire perché nessuno aspettava l'animazione per verificare il contenuto --- solo l'uso reale, con l'attesa visiva della dissolvenza, lo rendeva evidente).

### Vista a elenco delle capsule: senza il testo del messaggio

**Cosa fa:** l'elenco delle capsule non mostra più il testo del messaggio --- si legge già aprendo "Modifica" o l'anteprima ("Così la vedrà chi la riceve"), ripeterlo anche nell'elenco era ridondante. Il resto della riga (titolo, stato, destinatari, allegati) resta invariato.

**Note tecniche:** rimossa la sola riga di rendering in `CapsulesPanel.tsx` --- il dato (`capsule.content`) resta comunque usato per la ricerca testuale. Due e2e che verificavano il testo direttamente nella riga ora lo verificano aprendo l'anteprima.

### Dashboard: niente più scorrimento orizzontale su smartphone

**Cosa fa:** su schermi stretti, contatori e card della dashboard restano sempre entro i bordi dello schermo, senza il piccolo movimento orizzontale antiestetico segnalato --- margini e simmetria della pagina restano quelli di sempre.

**Note tecniche:** due interventi complementari. (1) `min-w-0` sui contenitori flex/grid della dashboard (`DashboardCounters`, `DashboardWidgets`) --- senza, un elemento a larghezza intrinseca (es. un nome file lungo senza spazi in "Aggiunti di recente") può far sì che l'elemento, e con esso la colonna/griglia che lo contiene, non si restringa mai sotto quella larghezza, sporgendo oltre lo schermo: `minmax(0, 1fr)` sulle tracce della griglia (già presente via le utility `grid-cols-N` di Tailwind) non basta da solo, serve anche sull'elemento dentro la traccia. (2) `overflow-x: hidden` su `html`/`body` come rete di sicurezza, per eventuali arrotondamenti di un pixel che un layout comunque corretto può produrre --- non sostituisce il punto (1), lo completa.

### Dashboard: "Da tenere d'occhio" in una riga a sé

**Cosa fa:** il riquadro "Da tenere d'occhio" non sta più nella colonna stretta insieme a "Onboarding" --- ha ora una riga propria a piena larghezza, lasciando alla colonna larga (contatori, scadenze, aggiunti di recente) e a quella stretta (Onboarding) più spazio ciascuna.

**Note tecniche:** `DashboardWidgets.tsx` --- la griglia a due colonne (`lg:grid-cols-[2fr_1fr]`) ora contiene solo Onboarding nella colonna stretta; `WatchlistWidget` è una riga a sé subito sotto, fuori dalla griglia.

### Animazioni di entrata/uscita per barra laterale, menu mobile, pannelli e popup

**Cosa fa:** diversi passaggi dell'interfaccia che prima scattavano di colpo ora sono fluidi: comprimere/espandere la barra laterale, aprire/chiudere il menu mobile (scorre da sinistra), aprire/chiudere un pannello laterale a tutto schermo (Onboarding, dettaglio Attività --- scorrono da destra, con lo sfondo scurito che compare/scompare insieme), passare da una scheda all'altra in Impostazioni (dissolvenza), aprire/chiudere il popup di ricerca globale e l'anteprima di una capsula (dissolvenza).

**Note tecniche:** due piccoli hook condivisi, nessuna libreria di animazione aggiunta. `useMountedTransition(open, durationMs)` (`lib/use-mounted-transition.ts`) tiene un elemento montato per tutta la durata della transizione di uscita invece di smontarlo di scatto insieme allo stato che lo controlla (altrimenti React lo toglierebbe dal DOM prima che l'animazione possa anche solo iniziare) --- usato da `MobileNavBar`, dal nuovo `components/ui/SidePanel.tsx` (estratto da `OnboardingStatus`/`AuditLogPanel`, che condividevano già lo stesso identico markup per il pannello laterale, ora anche la stessa animazione), da `GlobalSearch` e da `CapsulePreview`. `useCrossfade(value, durationMs)` (`lib/use-crossfade.ts`) gestisce invece una dissolvenza tra due contenuti diversi (non un mount/unmount) --- usato da `SettingsTabs` per il cambio di scheda.

Due dettagli tecnici non ovvi:
- Il "mount" deve avvenire nello **stesso render** in cui `open` diventa vero, non un render dopo tramite un effetto --- altrimenti un effetto del chiamante che dipende anch'esso da `open` (es. dare il focus al campo di ricerca appena aperto, in `GlobalSearch`) troverebbe l'elemento non ancora nel DOM. Risolto con lo stesso pattern che React stesso documenta per "adattare lo stato quando cambia una prop" (confronto durante il render, non un `useRef` --- la configurazione ESLint di questo progetto vieta di leggere `ref.current` durante il render).
- `CapsulePreview` e il dettaglio di `AuditLogPanel` sono ora sempre montati (mai più condizionati a "c'è qualcosa da mostrare?"): il contenuto passato può tornare `null` prima che l'animazione di uscita sia finita, quindi ognuno tiene un "ultimo valore non nullo mostrato" a parte, così il contenuto resta visibile (e corretto) per tutta la dissolvenza invece di sparire a metà.

---

## 2026-09-09

### Anteprima capsula più larga

**Cosa fa:** il popup "Così la vedrà chi la riceve" è ora più largo su schermi ampi --- su mobile resta invariato (si adatta già alla larghezza dello schermo).

**Note tecniche:** `max-w-lg` (512px) → `max-w-3xl` (768px) → `max-w-4xl` (896px, su richiesta) in `CapsulePreview.tsx` --- solo il limite massimo, il `w-full` e il padding del contenitore esterno che già gestiscono il responsive non sono cambiati.

### Le capsule scritte come una lettera, non un form

**Cosa fa:** scrivere e modificare una capsula ha ora il tono di una lettera, non di un modulo da compilare --- dal mockup condiviso con l'utente ("capsule come lettere"). I destinatari sono mostrati come si indirizzerebbe una busta (iniziali colorate + nome, sotto l'etichetta "A"), la data di apertura è una frase ("Si aprirà il ...") invece di un campo anonimo, e il messaggio si scrive in una vera superficie di carta calda --- non più una piccola textarea grigia identica a ogni altro campo --- con un interruttore "Scrittura semplice / A mano" che passa il testo a un font manoscritto (Caveat): una scelta di chi scrive, salvata con la capsula, così chi la riceve la vede esattamente come l'ha lasciata. Gli allegati audio/video sono ora un'aggiunta discreta dietro "+ Aggiungi un allegato", non un passo alla pari con lo scrivere. L'anteprima ("Così la vedrà chi la riceve") mostra il messaggio nella stessa carta calda, nello stesso font scelto.

**Note tecniche:** nuovo campo `contentStyle` ("simple" | "handwritten") in `CapsulePayload`/`CapsuleListItem`/`CapsuleInput`/`CapsuleEditInput` (`domain/capsules/types.ts`, `repository.ts`) --- come ogni altro campo del payload, cifrato insieme al resto, mai una colonna in chiaro; le capsule create prima che esistesse tornano "simple" di default. Nuovi componenti condivisi tra creazione e modifica: `CapsuleOpenAtField` (un `<input type="date">` reale, solo senza il riquadro attorno --- stesso nome accessibile "Data di apertura" di sempre) e `CapsuleLetterEditor` (la superficie di scrittura + l'interruttore di stile). `ContactPicker` mostra ora i destinatari già scelti con iniziali su un cerchio colorato invece dell'emoji 👤. Font Caveat caricato via `next/font/google` (solo peso 600, l'unico usato). Il campo "Contenuto" è stato rinominato "Il tuo messaggio" (nome accessibile incluso --- aggiornate le e2e che lo referenziavano per nome); gli allegati, ora dietro un rivelatore, hanno richiesto lo stesso aggiornamento in 4 test e2e che ci interagivano direttamente.

### Hinthial installabile come app (PWA)

**Cosa fa:** Hinthial può ora essere installata sul dispositivo (icona sulla home/nel launcher, si apre senza la barra degli indirizzi del browser) --- su Android/Chrome/Edge il browser propone da sé l'installazione; su iOS/Safari va aggiunta a mano (Condividi -> "Aggiungi alla schermata Home", Safari non offre un prompt automatico). L'icona è ricavata dal logo Hinthial (anche la favicon nella tab del browser, che fino a oggi mostrava ancora il triangolo segnaposto di default di Next.js, mai sostituito).

**Note tecniche:** `app/manifest.ts` (Next.js lo serve da sé su `/manifest.webmanifest` e lo collega nell'`<head>`, nessun `<link rel="manifest">` a mano) con `display: "standalone"` e `start_url: "/dashboard"` (le route protette reindirizzano già al login chi non è autenticato, v. middleware). Icone in due varianti da `public/brand/logo.svg`: "any" (trasparenti, per i contesti che le mostrano così com'è) e "maskable" (sfondo blu brand pieno con più margine, per Android che le ritaglia con una propria maschera --- senza il margine extra il ritaglio avrebbe tagliato foglie/anello del logo). `public/sw.js`: service worker minimo, richiesto dai browser per l'installabilità --- **nessuna cache offline**, di proposito: metterne una richiederebbe decidere con cura se e come conservare contenuti già decifrati sul dispositivo, cosa che oggi lo zero-knowledge non prevede, non un effetto collaterale di questa modifica. Favicon (`favicon.ico`) rigenerata a mano in formato multi-risoluzione (16/32/48px, nessuna libreria terza --- `System.Drawing` non scrive .ico multi-size da sé).

### Bug corretto: modificare una capsula/un contenuto d'Archivio poteva silenziosamente scartare le modifiche

**Cosa fa:** modificare il titolo (o la data di apertura) di una capsula esistente a volte non salvava la modifica --- l'elenco continuava a mostrare il titolo vecchio, pur mostrando "Capsula aggiornata." Lo stesso rischio esisteva, non ancora osservato, nella modifica dei metadati di un contenuto d'Archivio (categoria/asset/scadenza/tag/note).

**Note tecniche:** causa individuata investigando il bug segnalato in precedenza --- l'effetto che carica i dati esistenti nel form (`refresh()`, chiamato una volta al mount) viene invocato **due volte** in sviluppo da React StrictMode (comportamento intenzionale, pensato apposta per far emergere bug come questo). Senza protezione, se la prima invocazione (superata) risolve *dopo* la seconda, il suo risultato sovrascrive silenziosamente titolo/data/ecc. anche se l'utente li ha già modificati nel frattempo --- il form è visibile solo a caricamento già completato, quindi l'unico modo in cui questo può succedere è una seconda fetch "fantasma" in corso in background. Riprodotto in modo affidabile (75% delle volte su 4 tentativi) isolando il test e2e delle capsule; dopo la correzione, 6/6 e un'intera suite e2e passano. Corretto in `EditCapsuleForm.tsx` ed `EditArchiveItemForm.tsx` (gli unici due form di modifica con campi controllati popolati da `refresh()` --- `EditAssetForm`/`EditContactForm` usano campi non controllati via `defaultValue`, quindi non erano vulnerabili) con un contatore di richieste (`useRef`) che scarta il risultato di una fetch superata, stesso principio del flag `cancelled` già usato in `MasterKeyProvider`.

### Titolo di ogni pagina: stesso carattere del logo, colore brand

**Cosa fa:** il titolo principale di ogni pagina (es. "Capsule", "Archivio", "Ciao, ..."), prima nero e in un font generico, usa ora lo stesso carattere della scritta "Hinthial" nel logo (Baloo 2, identificato a occhio nella conversazione precedente) ed è del blu del brand, invece di nero --- un'estensione visiva del logo stesso. I titoli più piccoli (dentro le card, le sezioni) restano su Manrope, invariati.

**Note tecniche:** Baloo 2 caricato via `next/font/google` in `layout.tsx`, applicato solo a `h1` in `globals.css` (staccato dalla regola `h2`-`h6`, che resta Manrope). Il colore non può essere impostato da quella stessa regola CSS: ogni `<h1>` ha già una classe Tailwind di colore sul proprio elemento (`text-zinc-950 dark:text-zinc-50`), e una classe vince sempre su un semplice selettore d'elemento come `h1 { color: ... }` --- corretto quindi cambiando quella classe in `text-brand`, direttamente su ognuno dei 29 file che hanno un `<h1>` (stesso identico frammento di classe, letterale, ovunque). Esclusa la hero della homepage (ha già un accento blu solo su una parola, via uno `<span>` --- l'intero titolo diventerebbe blu, perdendo quel contrasto) e il titolo del kit di recovery stampabile in `SetupMasterKeyForm` (colori fissi per la stampa, non seguiva già la regola dark/chiaro). Non escluse le due intestazioni di errore/successo in "Verifica account" (`AlertTriangleIcon`/`CheckCircleIcon` restano nel proprio rosso/verde, solo il titolo sopra diventa blu) --- segnalato all'utente come possibile eccezione da rivedere.

### Pagine di inserimento/modifica a piena larghezza

**Cosa fa:** le pagine di inserimento e modifica di Archivio, Asset, Contatti fiduciari, Scadenze e Capsule usano ora tutta la larghezza disponibile della pagina, invece di restare compresse in una colonna centrale --- il comportamento responsive (a schermi stretti i campi vanno a capo esattamente come prima) resta inalterato.

**Note tecniche:** rimosso `max-w-2xl` dal contenitore esterno in tutti e 9 i file (stesso identico `<div className="flex max-w-2xl flex-col gap-6">` ripetuto ovunque). I campi dentro non hanno richiesto altre modifiche per sfruttare lo spazio: sono già organizzati con `flex-wrap`/`flex-1` (i campi "Nome"/"Titolo" si allargano, gli altri restano alla loro larghezza naturale, e a schermi stretti vanno semplicemente a capo, come sempre) --- rimuovere solo il limite massimo era sufficiente. Aggiunto anche `w-full` ai campi Tag/Note in `DocumentMetadataFields` (condiviso da creazione e modifica in Archivio), per coerenza esplicita anche fuori da un contesto flex che già li allargava implicitamente.

### Icona "Informazioni utente" allineata alle altre in Impostazioni

**Cosa fa:** l'icona della scheda "Informazioni utente" in Impostazioni non appare più più piccola delle altre.

**Note tecniche:** `UserIcon` (`icons/nav-icons.tsx`) --- stessa dimensione di riquadro (`width`/`height` già uguali per tutte le icone di Impostazioni), ma la sua geometria (testa+spalle sottili) riempiva meno del riquadro rispetto a icone più "piene" come `SecurityIcon`. Testa e spalle allargate per occupare lo stesso spessore visivo.

### Icona lucchetto aperto sul bottone "Sblocca"

**Cosa fa:** il bottone "Sblocca" (master password o recovery key) ha ora un'icona a forma di lucchetto aperto.

**Note tecniche:** nuova `UnlockedIcon` in `icons/nav-icons.tsx` --- stesso lucchetto di `SecurityIcon` (usata in Impostazioni > Sicurezza e nel badge zero-knowledge della homepage), ma con il gancio staccato dal corpo invece di richiuderlo.

### Identità visiva "Fresh Clarity" su homepage e schermate di autenticazione

**Cosa fa:** la homepage pubblica e le schermate di login, registrazione, verifica account (riuscita o no) e password dimenticata adottano lo stesso stile delle direzioni viste nel mockup (v. "FreshHero"): sfondo grigio-azzurro con una "bolla" mint decorativa dietro l'hero, badge "Zero-knowledge davvero" con icona lucchetto sopra il titolo, bottone principale con freccia e ombra colorata, card più arrotondate con ombra leggera. Le pagine di login/registrazione/verifica ora vivono dentro una vera card bianca (prima galleggiavano nude sullo sfondo); "Account verificato"/"Verifica non riuscita" hanno un'icona di stato (spunta verde/triangolo di attenzione), come altrove nell'app.

**Note tecniche:** la "bolla" è un `background` (radial-gradient) su un `<div aria-hidden>` assoluto dentro un contenitore `relative overflow-hidden` --- non un'immagine posizionata, quindi non può alterare le dimensioni della pagina né aggiungere barre di scorrimento (stessa lezione imparata nel canvas di design). Un solo `<main>` per pagina (la tentazione era di farne due, uno per l'hero con la bolla e uno per il resto --- non valido: due landmark "main" confondono la struttura della pagina per chi usa uno screen reader). `(auth)/layout.tsx` (condiviso da login/registrazione/verifica/password dimenticata/controlla email) avvolge il contenuto in una card, invece di ogni pagina per conto proprio.

Verificando con l'intera suite e2e (non solo gli unit test) sono emersi due problemi, entrambi corretti:
- **21 asserzioni e2e** in 11 file cercavano ancora il vecchio testo con l'emoji (`"✅ Asset creato."`, `"⚠️ Non attiva"`, ecc.) rimossa in una modifica precedente di oggi (icone di sistema) --- non erano coperte dagli unit test, solo dalle e2e, che non erano ancora state rilanciate da quella modifica.
- La nuova frase "Hai già un account? Accedi" nell'hero della homepage duplica il link "Accedi" già presente in alto (come nel mockup) --- corretto **2 test** (`home.spec.ts`, `auth-shell.spec.ts`) che cercavano quel link per nome su tutta la pagina, ora scoped al banner in alto.

**Bug scoperto, non di questa modifica**: `capsules.spec.ts` --- dopo aver modificato il titolo di una capsula già creata, l'elenco non mostra il titolo aggiornato (il messaggio "Capsula aggiornata." compare correttamente, ma la riga con il nuovo titolo non si trova). Riproducibile due volte su due, non collegato a nessuna modifica di oggi (verificato sul diff) --- segnalato all'utente, non ancora investigato a fondo.

### Icone in Impostazioni, icone di sistema color-logo, dati personali affiancati

**Cosa fa:** tre ritocchi mirati --- (1) ogni scheda della pagina Impostazioni ha ora un'icona a linea accanto all'etichetta, nello stesso stile della barra di navigazione; (2) tutte le icone "di sistema" (nav, contatori in dashboard, schede di Impostazioni) sono dello stesso blu del logo Hinthial, invece di un grigio neutro o del solo stato attivo --- eccetto "Zona pericolosa", che resta nel proprio rosso di avviso perché segnala un rischio, non solo una sezione; (3) in Impostazioni > Informazioni utente > Dati personali, Nome/Cognome/Data di nascita sono ora affiancati su schermi larghi (uno sotto l'altro solo su mobile), invece di essere sempre in colonna --- l'unica delle tre sezioni del pannello a poter sfruttare la piena larghezza della pagina (le altre due, Avatar ed Email, restano un solo campo ciascuna).

**Note tecniche:** 7 nuove icone in `icons/nav-icons.tsx` (utente, lucchetto, occhio, importa/esporta, checklist, attività, cursori). Il colore non è più ereditato dallo stato del testo circostante (`currentColor` dal genitore) ma passato esplicitamente come `className="text-brand"` su ogni icona --- altrimenti lo sfondo azzurrino della voce attiva (`bg-brand/10`) avrebbe reso l'icona invisibile se fosse rimasta forzata a un altro colore fisso. Scheda Impostazioni riportata alla stessa pillola della nav (`bg-brand/10 text-brand` da attiva, prima `bg-brand text-white`), per coerenza. `UserInfoPanel`: rimosso `max-w-md` dal contenitore esterno (limitava tutte e tre le sezioni), ridato singolarmente ad Avatar ed Email; i tre campi di "Dati personali" affiancati via **container query** (`@container`/`@xl:grid-cols-3`, non `sm:`/`md:`) --- reagiscono alla larghezza vera disponibile per il pannello, non a quella della finestra: a schermi medi, dove barra laterale ed elenco schede (v. SettingsTabs) occupano già buona parte dello spazio, un breakpoint legato alla sola finestra li avrebbe affiancati comunque, lasciando pochissimo spazio per scrivere in ognuno (bug segnalato dall'utente subito dopo, corretto nella stessa giornata).

### Identità visiva: colore e tipografia "Fresh Clarity"

**Cosa fa:** l'accento blu usato in bottoni, link e stati attivi in tutta l'app è più vivo (era un blu campionato dal logo, ora un blu più acceso), e i titoli passano da un font generico a Manrope (il resto del testo a Work Sans) --- la direzione visiva scelta dopo aver mostrato ad Andrea alcune proposte di stile, per un'identità meno "anonima".

**Note tecniche:** il colore è cambiato in un solo punto (`--brand`/`--brand-hover` in `globals.css`) --- quasi tutta l'app usa già queste variabili invece di classi Tailwind fisse (`bg-brand`, non `bg-blue-600`), quindi si è propagato senza toccare i singoli componenti. Font caricati via `next/font/google` in `layout.tsx` (Manrope, Work Sans), applicati globalmente in `globals.css`: Work Sans su `body` (prima Arial/Helvetica fisso), Manrope su tutti i tag `h1`-`h6` (prima nessuna regola, ereditavano il font del body). Geist Mono resta solo per il testo a spaziatura fissa (codici di recupero/MFA). Il logo (`logo-lockup.svg`) era già quello ufficiale con scritta in tutta l'app, nessuna modifica lì.

### Identità visiva: icone di sistema "Fresh Clarity"

**Cosa fa:** quarta parte del restyle --- le icone della barra di navigazione, dei contatori in dashboard e dei badge di stato (fatto/da fare, ok/attenzione, in tutta l'app) non sono più emoji ma icone a linea disegnate, nello stesso stile del mockup. Le emoji restano invece dove sono una scelta dell'utente (icona di una categoria) o un ornamento nel testo di un bottone (es. "🎥 Registra video", "📅 Esporta calendario") --- non toccate, sono fuori da questa fase.

**Note tecniche:** nuovo `components/icons/nav-icons.tsx`, un set di icone SVG (24x24, `stroke="currentColor"`, così ereditano il colore del testo del chiamante invece di uno fisso incollato dentro --- utile soprattutto in nav, dove lo stato attivo/hover cambia colore). `NavItem.icon` e l'analogo campo in `DashboardCounters` sono passati da `string` (emoji) a un componente React. Nuovo `components/ui/SuccessMessage.tsx`: il messaggio "✅ X creato/aggiornato." dopo un salvataggio, identico in 5 pannelli (Asset, Capsule, Contatti, Archivio, Scadenze --- 9 occorrenze), estratto in un solo componente invece di ripetere l'icona in ognuno. I pochi badge di stato "a mano" (Impostazioni > Onboarding/MFA, il messaggio di reimpostazione account) hanno preso l'icona direttamente, senza passare dal componente condiviso. Aggiornato un test (`main-nav.test.tsx`) che verificava la vecchia emoji per nome: ora verifica che l'icona sia un SVG `aria-hidden`, non nel nome accessibile del link.

### Identità visiva: bottoni e nav attiva "Fresh Clarity"

**Cosa fa:** terza parte del restyle --- i bottoni principali (blu, testo bianco) hanno angoli più smussati come nel mockup; la voce attiva nella barra di navigazione non è più un riquadro blu piatto con testo bianco, ma una pillola azzurro chiarissimo con testo blu, coerente con l'estetica più leggera del resto.

**Note tecniche:** stesso approccio delle card --- individuato il pattern letterale ricorrente `rounded-md bg-brand ... hover:bg-brand-hover` (54 occorrenze in 34 file, ogni bottone primario dell'app) e portato a `rounded-xl`; escluse deliberatamente le due righe che condividono la stessa forma ma sono altro (una voce selezionata in un elenco a comparsa in `GlobalSearch`, un segmento di un toggle a due stati in `CreateArchiveItemForm` --- quest'ultimo lasciato intatto perché i suoi due stati devono restare identici come raggio). Nav attiva (`MainNav.tsx`): `bg-brand text-white` diventato `bg-brand/10 text-brand` --- il modificatore `/10` di Tailwind (10% di opacità del colore `brand` già definito come token) invece di un secondo colore fisso da mantenere in sync, funziona automaticamente sia su sidebar bianca che su sfondo scuro.

### Identità visiva: angoli, ombre e sfondo "Fresh Clarity"

**Cosa fa:** seconda parte del restyle --- le card e i contenitori con bordo in tutta l'app (dashboard, liste, form, pannelli di Impostazioni) hanno angoli più arrotondati e un'ombra leggera che li stacca dallo sfondo, che è ora un grigio-azzurro molto chiaro invece di bianco puro; barra laterale, barra in alto e barra mobile restano bianche, per contrasto. Solo aspetto: nessun cambiamento a come la barra di navigazione o le pagine si adattano allo schermo.

**Note tecniche:** individuato il pattern ricorrente `rounded-lg border border-zinc-200 ... dark:border-zinc-800` (52 occorrenze in 35 file --- praticamente ogni "card"/lista/riquadro dell'app usava già le stesse classi) e sostituito con uno script mirato: raggio portato a `rounded-2xl`, aggiunti `bg-white`/`shadow-[0_8px_20px_rgba(16,24,40,0.04)]` (e l'equivalente `dark:bg-zinc-950`) solo dove non c'era già uno sfondo esplicito diverso --- le modali (`MasterKeyIntroModal`, `GlobalSearch`, ecc.) e i riquadri con sfondo intenzionalmente diverso (es. il box "Quello che non vedremo mai" in Privacy, `bg-zinc-50`) hanno preso solo il nuovo raggio, non un secondo sfondo/ombra sopra quello che avevano già. `--background` (chiaro) passato da `#ffffff` a `#f7fafb`; `Sidebar`/`TopNav`/`MobileNavBar`, che prima non dichiaravano uno sfondo proprio (mostravano semplicemente quello della pagina), ora dichiarano `bg-white` esplicito per restare bianche mentre il resto della pagina diventa grigio-azzurro. Il tema scuro non è cambiato (la direzione "Fresh Clarity" non ne prevede uno).

---

## 2026-09-08

### Email inviate da Hinthial: invito contatto, cancellazione/reset account

**Cosa fa:** tre funzionalità che inviano email vere, la prima volta che Hinthial lo fa da sé (finora solo Supabase Auth inviava email, per conferma registrazione e reset password):
- **Invita un contatto**: nel form di creazione/modifica di un contatto fiduciario, una checkbox "Invita questo contatto su Hinthial" --- se spuntata, all'salvataggio parte un'email all'indirizzo del contatto con un link a Hinthial e uno diretto alla registrazione. Un invio non riuscito non impedisce di salvare il contatto, solo un avviso a parte.
- **Cancella il tuo account** (nuova sezione in Impostazioni > Zona pericolosa): cancella per sempre l'account e ogni dato collegato --- non solo il vault come "Reimposta l'account" qui sotto, ma l'account stesso: non è più possibile accedere con quelle credenziali. Richiede di reinserire la master password, oltre a una frase di conferma testuale. Un'email di conferma arriva all'indirizzo dell'account.
- **Reimposta l'account** (prima "Cancella tutto", rinominata): stesso svuotamento di sempre (Archivio, Asset, Contatti fiduciari, Capsule, categorie ripristinate ai valori predefiniti), ma ora richiede anche la master password prima di procedere, e invia un'email di conferma a operazione completata.

**Note tecniche:** email inviate via l'API REST di Resend (`src/lib/email/send-email.ts`, una chiamata fetch diretta, nessuna dipendenza in più), da Server Actions (`src/lib/contacts/actions.ts`, `src/lib/account/actions.ts`) --- mai dal browser: `RESEND_API_KEY` non deve mai lasciarlo. La cancellazione account usa `auth.admin.deleteUser` (richiede la service role key, prima usata solo dai test): ogni riga collegata all'account ha già `ON DELETE CASCADE` da `auth.users` nelle migrazioni esistenti, quindi sparisce da sé --- solo gli oggetti di Storage (non dati di Postgres) vengono ripuliti a mano, enumerati per prefisso (`src/lib/storage/wipe-owner-storage.ts`). La master password, in entrambe le sezioni di Zona pericolosa, viene verificata riprovando a sbloccare (`useMasterKey().unlockWithPassword`) --- l'unico modo per verificarla davvero, dato lo zero-knowledge: il server non la vede mai.

### Popup "Crea la tua master key" al primo accesso

**Cosa fa:** subito dopo il login, chi non ha ancora configurato la cifratura vede un popup che spiega la differenza tra password dell'account e master password, con un tasto "Crea la tua master key" che porta dritto al modulo di creazione. Compare una sola volta: qualunque modo di chiuderlo (✕, "Più tardi", sfondo, o il tasto stesso) lo segna come visto per sempre, e comunque smette di avere senso non appena la cifratura è configurata. Resta comunque, come sempre, anche una voce a sé nel checklist di onboarding.

**Note tecniche:** `profiles.master_key_intro_seen` (sincronizzato sul server, come `onboarding_widget_hidden`). Il confronto a due righe tra le due password è stato estratto in `PasswordComparisonNote`, condiviso con il modulo di creazione stesso (`SetupMasterKeyForm`) per non avere due copie dello stesso testo. Nei test e2e, un `page.addLocatorHandler()` (`tests/e2e/fixtures.ts`) lo chiude automaticamente per ogni test che non lo riguarda esplicitamente --- altrimenti, essendo un overlay a tutto schermo, avrebbe bloccato il primo click di quasi tutta la suite.

### Onboarding: meno "scatola", più spiegazione

**Cosa fa:** il checklist "Onboarding" (nel pannello laterale del gadget e in Dashboard) non ha più il riquadro attorno alla lista, e sotto il titolo spiega in una riga di cosa si tratta.

### Onboarding: pannello laterale invece del riquadro flottante

**Cosa fa:** il click sul gadget "Onboarding" nella barra di navigazione apre ora un pannello laterale a tutto schermo (lo stesso pattern del dettaglio attività in Impostazioni > Attività), invece di un piccolo riquadro ancorato al pulsante --- da quando ogni passo mostra anche una breve descrizione, il contenuto era diventato troppo alto per il vecchio riquadro flottante.

**Note tecniche:** rimosso tutto il calcolo di posizione/spazio disponibile (coordinate del pulsante, margine minimo, lato di apertura) --- un pannello ancorato al bordo destro dello schermo non ne ha più bisogno.

### Prima esperienza: meno disorientamento al primo accesso

**Cosa fa:** cinque correzioni mirate al percorso di chi usa Hinthial per la prima volta, prima ancora di aver configurato la cifratura:
- Il modulo "Configura la cifratura" spiega ora esplicitamente la differenza tra password dell'account e master password (un confronto a due righe), e anticipa cosa aspettarsi ("un minuto: password, chiave di recupero, poi sei dentro").
- L'indicatore "Onboarding" nella barra di navigazione e la card in Dashboard mostrano già i primi due passi (account creato, cifratura da configurare) **prima** di aver sbloccato il vault, invece di restare del tutto assenti fino ad allora --- un punto di partenza esplicito appena si atterra in dashboard.
- Il checklist "Onboarding" completo (8 passi) mostra ora una breve spiegazione sotto ogni passo non ancora fatto, non solo l'etichetta --- utile soprattutto per passi che introducono un concetto nuovo (es. "Aggiungi un amico", legato al Dead Man's Switch delle capsule).
- L'ordine dei passi mette prima quelli concreti (contenuto, categoria, asset, capsula) e per ultimi quelli che presuppongono un concetto nuovo (amico/Dead Man's Switch, collegamento capsula-contatto).
- Le voci della barra di navigazione che richiedono la cifratura (tutte tranne Dashboard) mostrano un piccolo pallino finché non è stata configurata --- prima ancora di cliccarci sopra, invece di scoprire lo stesso modulo di setup separatamente su ognuna.

**Note tecniche:** il pallino è espresso via `aria-describedby` su uno `<span>` a parte, mai testo dentro l'etichetta del link: il nome accessibile resta invariato ("Archivio", non "Archivio (richiede...)"), altrimenti ogni ricerca per nome esatto (screen reader o test) smetterebbe di trovare il link finché la cifratura non è configurata.

**Note tecniche:** nuova `computeBasicOnboardingSteps()` in `domain/onboarding/steps.ts` --- gli stessi due oggetti-passo (`account`/`security`) usati anche dalla checklist completa, mai due definizioni separate che potrebbero disallinearsi. Il loro stato non richiede la Master Key (letto da `useMasterKey().status`), a differenza degli altri 6 passi che restano dietro sblocco perché richiedono dati decifrati.

### Data di nascita nel profilo

**Cosa fa:** in Impostazioni > Informazioni utente e nella schermata di registrazione, un nuovo campo facoltativo "Data di nascita", accanto a nome e cognome.

**Note tecniche:** `profiles.birth_date` (date, nullable), in chiaro come nome/cognome --- un dato anagrafico, non del vault. Passata a `signUp()` come `options.data.birth_date`, letta da `handle_new_user()` allo stesso modo di nome/cognome.

### Impostazioni: schede riorganizzate e in verticale

**Cosa fa:** le schede di Impostazioni (Informazioni utente, Sicurezza, Privacy, Categorie, Importa/Esporta, Onboarding, Attività, Aspetto, Zona pericolosa) sono ora una barra verticale a sinistra su schermi larghi (resta una barra orizzontale scorrevole su mobile), in un nuovo ordine.

### Correzione: il gadget "Onboarding" nascosto poteva ricomparire

**Cosa fa:** "Nascondi" nel pannello del gadget Onboarding nella barra di navigazione ora vale per davvero, anche a un login successivo (o su un altro dispositivo) --- non solo per il browser in cui è stato cliccato. Resta comunque riattivabile da Impostazioni > Onboarding.

**Note tecniche:** la preferenza (`profiles.onboarding_widget_hidden`) è passata da solo-`localStorage` a sincronizzata sul server, con lo stesso pattern già usato per `nav_orientation` (letta lato server in `getCurrentUser()`, aggiornamento ottimistico lato client con rollback se il salvataggio fallisce). `lib/onboarding-widget.ts` (il vecchio helper `localStorage`) è stato rimosso.

### Impostazioni > Privacy: lista aggiornata

**Cosa fa:** la lista di "Quello che vediamo" ora riflette anche la data di nascita (se impostata), la visibilità del gadget di onboarding, e segnala che IP/dispositivo/browser di ogni accesso ed eventuali tentativi falliti sono registrati in Impostazioni > Attività.

### Impostazioni > Attività: registro interrogabile, con molti più eventi

**Cosa fa:** invece di caricare sempre tutto il registro, ora si interroga: data inizio, data fine e categoria (scelta multipla), poi "Trova" mostra i risultati in una tabella; un click su una riga apre un pannello laterale con i dettagli (metodo di login, indirizzo IP, dispositivo/browser, quando presenti). Nuovi eventi registrati: tentativi di login falliti, verifiche MFA fallite, attivazione/rimozione dell'autenticazione a due fattori, generazione di codici di backup, distinzione tra login con password/TOTP/codice di backup, IP e dispositivo/browser di ogni login riuscito, e creazione/eliminazione di asset, capsule e categorie (oltre a documenti/contatti, già presenti).

**Note tecniche:** `audit_events` ha una nuova colonna `metadata jsonb` (mai contenuti o identificatori, solo dettagli tecnici) invece di continuare a esplodere l'enum `event_type` per ogni sfumatura. Un tentativo di login con password errata non ha ancora una sessione autenticata (`auth.uid()` è null, le RLS richiederebbero `auth.uid() = owner_id`): registrato tramite una funzione Postgres dedicata (`log_failed_login_attempt`, `SECURITY DEFINER`) che non rivela mai se l'email corrisponde a un account esistente, per non permettere l'enumerazione degli account. IP/user agent letti da `next/headers` lato server action (`lib/http/request-context.ts`). Il raggruppamento per giorno (`domain/audit/group.ts`) è stato rimosso: la vista è ora tabellare, non più a elenco raggruppato.

**Bug noto, scoperto ma non risolto (pre-esistente, non introdotto da queste modifiche):** in `/login`, dopo un primo tentativo con credenziali sbagliate, un secondo submit del form (anche con la password corretta) non naviga alla dashboard --- riproducibile anche disabilitando del tutto la nuova registrazione dei tentativi falliti, quindi non è la causa. Verosimilmente un'interazione tra `useActionState`/Server Actions e i cookie di sessione scritti dal primo tentativo. Da investigare a parte: nel frattempo un refresh della pagina prima di riprovare aggira il problema.

### Menu di navigazione responsive

**Cosa fa:** su schermi piccoli, la barra laterale (o quella orizzontale) è sostituita da un tasto menu (☰) che apre la stessa navigazione in sovraimpressione, invece di restare sempre visibile occupando spazio.

**Note tecniche:** nuovo `MobileNavBar`, montato sempre da `AppShell` accanto a `Sidebar`/`TopNav` (nascosti sotto la soglia `md` via CSS, non smontati: così la barra laterale non perde il proprio stato di compressione attraversando la soglia).

### Cronologia: filtri per data e sezione

**Cosa fa:** in Cronologia, un nuovo filtro iniziale per data inizio, data fine e sezione (Archivio/Asset/Scadenza/Contatto/Capsula), applicato subito senza bisogno di un tasto "Cerca" --- i dati sono già tutti decifrati in memoria.

---

## 2026-09-07

### MFA: codici di backup

**Cosa fa:** in Impostazioni > Sicurezza, oltre all'app authenticator (TOTP) è ora possibile generare **10 codici di backup monouso**, da usare se si perde l'accesso al proprio dispositivo: uno vale al posto del codice, e viene consumato subito dopo l'uso. Compaiono solo se hai già l'app authenticator attiva.

**Note tecniche:** i codici di backup sono interamente nostri (Supabase non li supporta nativamente): salvati come hash SHA-256 (Web Crypto API) in una nuova tabella `mfa_backup_codes`, mai in chiaro se non per l'istante in cui vengono mostrati. Un dettaglio non ovvio emerso testando: verificare un codice di backup non è una vera verifica MFA per Supabase, quindi non alza da sé il livello di sicurezza (AAL) della sessione --- un cookie dedicato (`lib/auth/mfa-bypass.ts`) segna esplicitamente "secondo fattore verificato con un codice di backup" per i controlli d'accesso, cancellato ad ogni nuovo login perché non deve valere oltre la sessione in cui è stato ottenuto.

**Esplorato ma non implementato: passkey (WebAuthn) come fattore alternativo.** L'idea era di poter verificare con impronta digitale/Face ID/Windows Hello/chiave fisica invece di un codice, usando l'MFA WebAuthn nativo di Supabase (`factorType: "webauthn"`, orchestrato a mano in tre passi dato che l'SDK non espone un metodo di comodo completo per questo). Il codice è stato scritto e verificato fino al punto in cui il server Supabase lo permetteva, ma il dashboard Authentication di questo progetto non espone alcun modo per attivare "WebAuthn come fattore MFA" --- solo per il login primario con passkey ("Passkeys" BETA), una funzionalità diversa pensata per sostituire la password, non per affiancarla. Rimosso dal codice in attesa che Supabase chiarisca/rilasci un percorso stabile per questo caso d'uso specifico.

### Autenticazione a due fattori (TOTP)

**Cosa fa:** nuova scheda "Sicurezza" in Impostazioni per attivare l'autenticazione a due fattori con un'app come Google Authenticator o 1Password. Una volta attiva, dopo email e password il login chiede anche un codice a 6 cifre prima di entrare. Si possono registrare più dispositivi (consigliato farlo, per non restare esclusi dall'account perdendo l'unico con l'app authenticator), ognuno rimovibile singolarmente.

**Note tecniche:** interamente basata sull'MFA nativo di Supabase Auth (TOTP) --- nessuna crypto custom. Riguarda solo il layer di identità/login: non tocca mai la master key né la cifratura del vault, che restano protette solo dalla master password, del tutto separate (v. HINTHIAL_MVP.md, sezione 4). `signIn()` reindirizza a `/login/mfa` invece che alla dashboard quando la sessione è solo `aal1` e può salire ad `aal2`; lo stesso controllo vive anche in `(app)/layout.tsx`, per un URL diretto raggiunto senza passare dal login. Un codice non dichiara per quale dispositivo è stato generato: viene provato su ogni fattore registrato finché uno lo accetta. Richiede TOTP abilitato sul progetto Supabase (`supabase/config.toml`, `[auth.mfa.totp]`).

### Impostazioni > Privacy: "Cosa sa Hinthial di te"

**Cosa fa:** nuova scheda che mette a confronto, con dati reali e attuali dell'account (non un testo generico), cosa il server vede in chiaro --- email, conteggi per sezione, categorie, disposizione del menu --- con cosa non vedrà mai: nomi dei file, contenuti, contatti fiduciari, capsule, master password. Pensata per chi vuole verificare di persona la promessa zero-knowledge, non solo leggerla dichiarata.

**Note tecniche:** ogni query legge solo colonne mai cifrate (conteggi, `status`/`is_friend` di trusted_contacts, `status` delle capsule, la tassonomia delle categorie), quindi non serve la master key sbloccata.

### Impostazioni > Attività: registro degli eventi dell'account

**Cosa fa:** nuova scheda che mostra il registro tecnico già scritto ad ogni login/logout, contenuto aggiunto o eliminato, contatto fiduciario aggiunto, vault svuotato --- raggruppato per giorno (Oggi/Ieri/data) e filtrabile per categoria. Mai nomi di file o di contatti, solo il tipo di evento: restano privati anche qui.

**Note tecniche:** log puramente tecnico e in chiaro (v. `lib/audit/log-event.ts`), non serve la master key.

### Kit di recovery stampabile con QR

**Cosa fa:** alla creazione della master password, una terza opzione ("Stampa kit di recovery") accanto a copia/download .txt: un foglio pensato per essere stampato e conservato fisicamente, con la recovery key in grande e un QR code --- comodo per reinserirla su un dispositivo nuovo senza ricopiare a mano una chiave a 384 bit.

**Note tecniche:** il QR è generato interamente lato client (libreria `qrcode`); la chiave non lascia mai il browser, nessuna chiamata di rete. Il foglio stampabile vive fuori vista nel DOM e diventa visibile solo nella finestra di stampa (pattern CSS "stampa solo questo elemento", v. `lib/print.ts`).

### Modifica di una capsula: stessi tre passi della creazione

**Cosa fa:** la pagina di modifica di una capsula è ora organizzata negli stessi tre passi della creazione (chi e quando -> contenuti dall'archivio -> audio, video e testo), invece di un unico form con tutti i campi insieme --- stessa intestazione "Passo X di 3" e gli stessi pulsanti Avanti/Indietro.

**Note tecniche:** `EditCapsuleForm` riusa `STEP_LABEL` e la stessa struttura a passi di `CreateCapsuleForm`; nessun cambiamento ai dati salvati o a `updateCapsule`.

### Onboarding: nascondibile dalla barra, e una pagina dedicata in Impostazioni

**Cosa fa:** il pannello che si apre dall'indicatore "Onboarding" nella barra di navigazione ha ora un pulsante "Nascondi", che lo fa sparire dalla barra da quel momento in poi (su questo dispositivo). L'avanzamento resta comunque consultabile in una nuova voce "Onboarding" tra le schede di Impostazioni: una percentuale in grande con un messaggio accanto (di apprezzamento quando l'onboarding è avanti, di incoraggiamento quando è indietro), e sotto la lista di tutte le attività con una breve descrizione e lo stato ("✅ Fatto" o un pulsante "Da fare" che porta dove completarla). Da lì è anche possibile far ricomparire l'indicatore nella barra.

**Note tecniche:** la preferenza "nascosto" vive solo in localStorage (come il tema), non sul server. Condivisa tra l'indicatore nella barra e la nuova pagina di Impostazioni tramite un nuovo `OnboardingWidgetVisibilityProvider` (Context React) --- necessario perché la barra di navigazione resta montata attraversando le pagine dell'app: senza uno stato condiviso, nasconderla da Impostazioni non si sarebbe riflesso lì finché non si fosse ricaricata la pagina per intero. `OnboardingStep` (in `domain/onboarding/steps.ts`) guadagna un campo `description`, riusato sia qui sia potenzialmente altrove, per restare l'unica fonte dei passi.

### Rifiniture: logo e colore dell'indicatore Onboarding

**Cosa fa:** il logo nella barra orizzontale dopo il login è ora della stessa dimensione di quello nella home page pubblica. L'anello dell'indicatore "Onboarding" diventa verde quando l'avanzamento raggiunge il 100% (prima restava sempre del colore del brand).

### Disposizione del menu di navigazione

**Cosa fa:** in Impostazioni > Aspetto è ora possibile scegliere come disporre il menu di navigazione: barra laterale a sinistra (come finora), barra laterale a destra, oppure barra orizzontale in alto. La scelta si applica subito a tutta l'app e resta impostata su tutti i dispositivi dell'utente, esattamente come la visualizzazione delle liste. Nella barra orizzontale il logo mostra anche il nome (non solo l'icona), le voci di navigazione mostrano l'etichetta accanto all'icona (non solo l'icona), e il campo di ricerca è per esteso, non compresso.

**Note tecniche:** nuova colonna `profiles.nav_orientation` (`sidebar-left` di default, `sidebar-right`, `topbar`), letta lato server in `getCurrentUser()` e passata come prop iniziale ad `AppShell` --- a differenza della visualizzazione delle liste, qui il valore dev'essere noto *prima* del primo render per evitare un lampo del layout sbagliato, dato che decide la struttura dell'intera shell, non un dettaglio interno a una sezione. `AppShell` sceglie tra `Sidebar` (a sinistra o a destra, riordinata via classi `md:order-*`, non riordinando il markup: su mobile il menu resta sempre in cima) e il nuovo `TopNav`. `MainNav` guadagna una variante orizzontale (icone soltanto, come la barra laterale compressa) e `UserMenu` un verso di apertura del popover verso il basso, allineato a destra, per quando vive in cima allo schermo invece che in fondo a una barra laterale. Corretto anche un effetto collaterale: il popover dell'indicatore "Onboarding" si apriva sempre verso destra, uscendo dallo schermo quando la barra laterale sta a destra --- ora si ancora al bordo opposto se non c'è spazio.

### Onboarding, home page pubblica e rifiniture

**Cosa fa:** l'indicatore nella barra laterale si chiama ora "Onboarding" (era "Primi passi"). La nuvola dei passi non depenna più le voci completate (restano scritte normalmente) e non parla più di passi "opzionali": tutti gli 8 passi contano allo stesso modo verso la percentuale mostrata. Il passo "Imposta una scadenza" è stato rimosso, essendo un'attività passiva rispetto al contribuire contenuti. In Impostazioni > Aspetto > Visualizzazione delle liste, "Contatti fiduciari" è stato rinominato in "Contatti". Il carosello della home page pubblica ora avanza da solo ogni 6 secondi (in pausa al passaggio del mouse, disattivato con `prefers-reduced-motion`), e sotto di esso la pagina è stata ampliata in stile brochure responsive: una sezione "Perché Hinthial" con i punti di forza (zero-knowledge, archivio unico, assistente locale, capsule, personalizzazione, sviluppo incrementale) e una sezione "Come funziona" in tre passi.

**Note tecniche:** `domain/onboarding/steps.ts` non ha più il concetto di passo opzionale; la percentuale è ora calcolata su tutti gli 8 passi. Individuato e corretto un bug nel carosello: il mouse resta fermo sopra il componente dopo un click (come farebbe un utente reale), quindi una pausa-al-focus in più lo avrebbe bloccato per sempre --- risolto tenendo solo la pausa al passaggio del mouse (`onMouseEnter`/`onMouseLeave`), senza equivalenti per la tastiera.

### Dead Man's Switch semplificato per le capsule (fase 1 di 3)

**Cosa fa:** ogni capsula richiede ora una data di apertura obbligatoria (prima era facoltativa) --- raggiunta quella data, il destinatario potrà vederne il contenuto. Ogni utente deve avere almeno un contatto fiduciario marcato come "amico" (nuova azione nel menu di un contatto, badge "🤝 Amico"): è un prerequisito reale, diventato un passo obbligatorio nell'onboarding ("Aggiungi un amico"). In modifica di una capsula è ora possibile anche gestire gli allegati audio/video: rimuovere quelli esistenti e registrarne/caricarne di nuovi, esattamente come in creazione.

**Note tecniche:** `capsules.open_at` è diventata una colonna in chiaro (era solo dentro il payload cifrato) --- unica eccezione consapevole allo zero-knowledge in questa tabella, necessaria perché in una fase successiva il server possa sapere *quando* una capsula è pronta senza dover decifrare nulla. Le capsule create prima della migrazione si "sanano" da sole (il valore torna in chiaro) la prima volta che il proprietario le rivede. `trusted_contacts.is_friend` è un nuovo flag, indipendente da `status`. Questa è solo la prima di tre sotto-fasi pianificate: mancano ancora la soglia di inattività con promemoria via email (Resend) e, soprattutto, lo scambio di chiavi che permetterà a un destinatario di decifrare davvero una capsula (richiede che ogni "amico" diventi un utente Hinthial con una propria coppia di chiavi).

### Dashboard: contatori e indicatore di avanzamento

**Cosa fa:** i contatori per sezione in dashboard sono ora centrati, con un'icona più grande. Il contatore "Contatti" mostra due conteggi distinti sotto al totale: quanti sono attivi e, separatamente, quanti sono amici. Nuovo indicatore "Primi passi" sempre visibile nella barra laterale (non solo in dashboard): una grafica a torta con la percentuale di completamento dei passi obbligatori, che al click apre la lista di cosa è stato fatto e cosa manca.

**Note tecniche:** la logica dei passi di onboarding è stata estratta in `domain/onboarding/steps.ts`, condivisa tra la card in dashboard e il nuovo indicatore nella barra laterale, per evitare due liste che potessero disallinearsi.

### Home page pubblica

**Cosa fa:** la pagina che si vede visitando Hinthial da sconnessi ha ora una barra in alto (logo a sinistra, Accedi/Registrati o "Vai alla dashboard" a destra) e un corpo da vera landing page, con un carosello di 5 schermate che spiega cosa fa Hinthial (cifratura zero-knowledge, archivio multi-tipo, asset e scadenze, capsule, assistente AI locale).

### Documentazione

- Allineata la "Roadmap sintetica" di `HINTHIAL_MVP.md` alle fasi già scritte in dettaglio (mancava la FASE 14, ed erano segnate come due fasi separate "AI real" e "Proactive AI" che invece la spec descrive come un'unica FASE 11).
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
