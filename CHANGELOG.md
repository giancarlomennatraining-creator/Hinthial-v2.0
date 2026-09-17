# Changelog

Registro di tutto ciò che è stato costruito in HINTHIAL, dalla nascita del progetto ad oggi — pensato come base per scrivere documentazione tecnica e guide utente, non come sostituto di nessuna delle due.

**Come leggere una voce:**
- **Cosa fa** --- in linguaggio semplice: cosa può fare oggi chi usa Hinthial, materiale di partenza per una guida utente.
- **Note tecniche** --- dove rilevante, per chi scriverà la documentazione per sviluppatori (scelte architetturali, compromessi accettati consapevolmente, limiti noti).

**Una precisazione sulle date**: riflettono quando ogni funzionalità è stata *registrata su git* (`git log`), non necessariamente il giorno esatto in cui è stata scritta --- un ampio arretrato di lavoro è stato formalizzato in commit separati il 2026-09-04, pur essendo stato sviluppato nel corso di più sessioni precedenti. Da qui in avanti una nuova voce viene aggiunta in cima ad ogni funzionalità completata.

---

## 2026-09-17 (6)

### Amici: badge "Su Hinthial" spostato sull'avatar

**Cosa fa:** l'etichetta "✓ Su Hinthial" non è più un badge testuale nella riga dell'amico --- quando l'amico ha un account Hinthial collegato, compare invece un piccolo tondo blu con una "H" bianca nell'angolo in basso a destra della sua foto/iniziali. Con badge di stato, Guardiano e "Su Hinthial" tutti sulla stessa riga, su smartphone finivano per sforare lo schermo; ora la riga resta compatta.

**Note tecniche:** `Avatar` (src/components/ui/Avatar.tsx) accetta una nuova prop opzionale `linked` che aggiunge il badge in overlay, in scala con la taglia dell'avatar (`sm`/`md`/`lg`); `FriendsPanel` la passa come `friend.linkedUserId !== null` sia nella vista a elenco sia in quella a tabella, al posto del vecchio `<span>` testuale. Il badge resta accessibile (`role="img"` + `aria-label`/`title` "Ha un account Hinthial") anche senza il testo visibile. Aggiornati i 4 test e2e che verificavano il vecchio testo (`friend-account-link.spec.ts`, `friends.spec.ts`, `capsule-sharing.spec.ts`) per cercare il badge via `getByTitle` invece di `getByText` --- tutti verificati passanti.

---

## 2026-09-17 (5)

### Menu di Impostazioni: intestazioni di gruppo più grandi, blocchi separati su smartphone

**Cosa fa:** i nomi delle aree in Impostazioni (SICUREZZA, PRIVACY E DATI, PERSONALIZZAZIONE) sono ora più grandi, sia da desktop sia su smartphone. Su smartphone, ogni area ha ora il proprio riquadro separato invece di un unico elenco continuo, con il nome dell'area sopra e fuori dal riquadro, non più come prima riga al suo interno.

**Note tecniche:** solo `SettingsTabs.tsx` toccato --- intestazioni di gruppo passate da `text-xs` a `text-sm` (sia sidebar desktop sia elenco mobile); l'elenco mobile, prima un unico `<ul>` con tutti i gruppi separati da `divide-y`, ora rende ogni gruppo come coppia intestazione (fuori) + `<ul>` proprio (bordo/sfondo arrotondato), con `gap-6` tra i blocchi. Nessuna modifica a routing, contenuto delle schede o al layout desktop oltre alla dimensione del testo. Verificato visivamente con uno script Playwright throwaway (utente di test usa e getta via API admin di Supabase, poi eliminato) su viewport desktop (1600px) e smartphone (390px).

---

## 2026-09-17 (4)

### Eredità digitale usa tutta la larghezza disponibile in Impostazioni

**Cosa fa:** la scheda "Eredità digitale" non è più incolonnata stretta a sinistra --- usa tutto lo spazio disponibile, come "Aspetto". I valori personalizzati (quando aperti) si dispongono ora su più colonne sugli schermi larghi invece di impilarsi uno sotto l'altro; su smartphone restano comunque a colonna singola, come prima.

**Note tecniche:** rimosso il `max-w-2xl` dal contenitore esterno del pannello, rimesso solo sui singoli paragrafi discorsivi (intro, riepilogo, riquadro di stato, interruttore) per mantenerli leggibili --- il resto (selettore preset, valori personalizzati, tasto Salva) può allargarsi per davvero. I sei campi numerici più il quorum sono ora in una griglia (`sm:grid-cols-2 lg:grid-cols-3`) invece di una colonna sola. Verificato visivamente su viewport desktop (1600px) e smartphone (390px).

---

## 2026-09-17 (3)

### Impostazioni riorganizzate in macro-aree

**Cosa fa:** le 11 voci di Impostazioni, prima tutte allo stesso livello, sono ora raggruppate in aree: **Sicurezza** (Sicurezza, Eredità digitale, Attività), **Privacy e dati** (Privacy, Intelligenza artificiale, Categorie, Importa/Esporta), **Personalizzazione** (Aspetto, Onboarding) --- con "Informazioni utente" in cima e "Zona pericolosa" in fondo, entrambe da sole, fuori da ogni gruppo. Stesso comportamento di sempre (un clic per scheda, niente di nuovo da imparare), solo più facile da scorrere a colpo d'occhio --- sia da desktop sia nell'elenco di Impostazioni su smartphone.

**Note tecniche:** discusso a fondo con l'utente prima di riorganizzare, verificando voce per voce se ogni funzione fosse ancora al posto giusto, non solo raggruppando --- due spostamenti concettuali oltre al semplice raggruppamento: "Intelligenza artificiale" (un consenso al trattamento dati, non un'impostazione a sé) e "Categorie" (tassonomia dei propri contenuti) sono passate da voci isolate a "Privacy e dati"; "Onboarding" (oggi quasi solo un interruttore mostra/nascondi per il gadget in barra laterale) sotto "Personalizzazione", la stessa famiglia di "Aspetto". Solo `SettingsTabs.tsx` toccato: le singole schede (route, contenuto, logica) restano identiche, cambia solo come sono organizzate nella navigazione --- nessuna modifica al modello dati, nessun test e2e esistente aggiornato (i selettori per nome/ruolo restano validi, le intestazioni di gruppo sono elementi non interattivi, non tab).

---

## 2026-09-17 (2)

### FASE 12, quarto e ultimo passo --- verifica formale, attesa finale, apertura capsule

**Cosa fa:** completate le ultime tre fasi della roadmap. Dopo la conferma dei guardiani, l'account entra in una verifica formale, poi in un'attesa finale (durate configurabili come tutto il resto, in Impostazioni), con un'ultima email al proprietario all'inizio dell'attesa finale --- l'ultimo momento in cui un semplice accesso annulla tutto. Se anche l'attesa finale scade senza risposta, **le capsule già condivise dal proprietario diventano leggibili ai loro destinatari da quel momento, indipendentemente dalla data di apertura originale** --- ognuno riceve un'email che lo avvisa. Discusso esplicitamente con l'utente prima di scrivere questa parte: senza, le fasi 1-6 non avrebbero avuto nessun effetto reale sulle capsule, solo sullo stato interno dell'account. In Impostazioni > Eredità digitale compare anche un nuovo riquadro con lo stato attuale del proprio processo (se non "normale"), con i conteggi di quanti guardiani hanno risposto --- mai i loro nomi, cifrati e leggibili solo dalla propria rubrica Amici.

**Note tecniche:** una nuova colonna `digital_legacy_triggered_at` su `profiles`, deliberatamente separata da `digital_legacy_state`: quest'ultima può tornare "normal" con un accesso successivo del proprietario (il monitoraggio futuro riparte da zero), ma `digital_legacy_triggered_at`, una volta impostata, non viene mai più azzerata --- l'accesso alle capsule già concesso ai destinatari non si può ritirare, anche se il proprietario si fa poi vivo. Le due policy RLS che governano l'accesso ai contenuti condivisi (`capsule_share_keys` e lo storage degli allegati) ora concedono la lettura in OR tra due condizioni indipendenti: la `open_at` della capsula già raggiunta, oppure `digital_legacy_triggered_at` dell'account non nullo --- una capsula mai condivisa (ancora bozza o solo chiusa) non ha alcuna riga di chiave da concedere, quindi non è mai coinvolta: "Eredità digitale" non decide da sola chi riceve cosa, rende solo prima disponibile ciò che il proprietario aveva già esplicitamente condiviso. `runDigitalLegacyCheck` accetta ora un orologio iniettabile (di default quello vero) solo per i test: le fasi più lunghe non si possono simulare aspettando per davvero, né retrodatando `state_entered_at` da solo (finirebbe prima di `last_sign_in_at`, facendo scattare il reset invece della transizione voluta). Verificato con un test di integrazione end-to-end esteso che copre l'intera catena contro il database reale: una capsula condivisa con `open_at` a 1000 giorni nel futuro non è leggibile dal destinatario prima dell'attivazione, lo diventa subito dopo, e resta leggibile anche dopo che il proprietario torna ad accedere (confermando che il reset dello stato non ritira l'accesso già concesso).

**Cosa resta fuori, deliberatamente:** la revisione legale e di sicurezza che la roadmap richiede esplicitamente prima che questa funzionalità tocchi dati reali in produzione (non è qualcosa che si possa implementare in codice); e una vista per il guardiano che elenchi "di chi sono guardiano" prima ancora che arrivi una richiesta di verifica attiva --- oggi lo scopre solo quando l'email di richiesta arriva davvero. Entrambi discussi esplicitamente con l'utente e lasciati fuori da questo incremento.

---

## 2026-09-17

### FASE 12, terzo passo --- coinvolgimento dei guardiani

**Cosa fa:** quando il periodo di grazia scade senza risposta, ogni guardiano collegato a un account Hinthial (v. la voce di ieri sui guardiani non collegati) riceve un'email: *"[Nome] ti ha indicato come guardiano --- non riusciamo a raggiungerlo/la, hai sue notizie?"*, con un link a una pagina dove rispondere "Sì, sta bene" / "Non lo so" / "Confermo che non riesco a raggiungerlo/la" (richiede di accedere con il proprio account Hinthial per rispondere, mai un click anonimo). Una sola risposta "sta bene" annulla tutto, come un accesso del proprietario stesso. Se invece abbastanza guardiani confermano di non riuscire più a raggiungerlo --- quanti, dipende dal quorum scelto in Impostazioni: tutti, la maggioranza, o basta uno solo --- il proprietario riceve un ultimo avviso via email, e l'account entra in un'attesa che una fase futura (verifica formale, non ancora costruita) dovrà raccogliere.

**Note tecniche:** nuova tabella `guardian_verification_requests` (una riga per coppia proprietario/guardiano, azzerata a ogni nuovo episodio) con RLS che lascia leggere la richiesta a entrambe le parti ma rispondere solo al guardiano interpellato; una nuova policy su `profiles` lascia il guardiano leggere il nome (in chiaro) del proprietario, stesso schema già usato per "Condivise con me". Registrare la risposta nel registro Attività *del proprietario* (non del guardiano che risponde, un `owner_id` diverso da `auth.uid()`) non è possibile con un insert diretto sotto RLS --- risolto con una funzione Postgres SECURITY DEFINER (`respond_to_guardian_verification_request`), stesso schema già usato per `log_failed_login_attempt`, che ripete a mano il controllo che l'RLS farebbe invece di limitarsi a bypassarlo. La logica del quorum (`isGuardianQuorumSatisfied`) e l'estensione della macchina a stati pura (`computeDigitalLegacyTransition`, ora con un nuovo stato "guardians_confirmed" e un parametro opzionale col riscontro dei guardiani) restano prive di accesso a database, testate con 12 nuovi casi. La parte che tocca davvero il database (creazione delle richieste, invio email, aggiornamento di stato) è verificata con un test di integrazione end-to-end contro il database reale --- due account veri, l'uno guardiano collegato dell'altro --- che copre l'intero percorso: richiesta creata, lettura sotto RLS, risposta via RPC, quorum raggiunto, evento registrato sotto l'account giusto. Non è stato possibile simulare la vera attesa per inattività in quel test (un accesso reale ha sempre `last_sign_in_at` più recente di qualunque data retrodatata, il che fa scattare correttamente il reset invece della transizione che si voleva testare) --- risolto avviando il test già nello stato "awaiting_guardians" e chiamando `notifyGuardians` (ora esportata apposta) direttamente.

---

## 2026-09-16 (7)

### Amici: un guardiano senza account collegato avvisa che non potrà essere raggiunto

**Cosa fa:** segnare come guardiano un contatto che non ha (ancora) un account Hinthial collegato è ancora permesso, ma ora lo dice chiaramente: un popup lo conferma subito ("non potrà essere avvisato finché non collega il suo account Hinthial") e il badge "🛡️ Guardiano" nell'elenco Amici diventa arancione con la stessa indicazione, invece del solito blu, finché quel contatto non si collega.

**Note tecniche:** decisione presa discutendo la fase successiva di "Eredità digitale" (il coinvolgimento dei guardiani, non ancora costruito): un guardiano non collegato è oggi irraggiungibile dal server per definizione --- la sua email è cifrata con la master key del proprietario, come già per la condivisione capsule --- quindi la fase futura potrà contare solo i guardiani con `linked_user_id` non nullo per il quorum. Nessuna modifica al modello dati: solo interfaccia, in `FriendsPanel.tsx` (badge in entrambe le viste, tabella ed elenco) --- nuovo test e2e dedicato.

---

## 2026-09-16 (6)

### FASE 12, secondo passo --- rilevamento inattività e promemoria, opt-in esplicito

**Cosa fa:** in Impostazioni > Eredità digitale compare ora un interruttore, "Attiva Eredità digitale", spento di default per ogni account --- **nessuna email parte finché non lo si accende esplicitamente**, qualunque preset sia già configurato (discusso a fondo con l'utente prima di costruire questo pezzo). Da acceso, un controllo quotidiano osserva l'ultimo accesso di ciascun account: superata la soglia di inattività scelta, arriva un'email ("tutto bene? non ti vediamo su Hinthial da un po'"), ripetuta secondo la cadenza scelta; se nessun accesso arriva, dopo l'ultimo promemoria comincia il periodo di grazia (un'altra email, più esplicita: da qui in poi un solo accesso annulla tutto). **Ancora nessun coinvolgimento dei guardiani né apertura di capsule** --- il periodo di grazia scaduto lascia l'account in un'attesa che una fase futura, non ancora costruita, dovrà raccogliere.

**Note tecniche:** "attività" oggi significa solo "accesso" (`auth.users.last_sign_in_at`, gestito da Supabase stesso, mai una colonna nostra da tenere sincronizzata). Il cuore della logica (`computeDigitalLegacyTransition`, in `domain/digital-legacy/types.ts`) è una funzione pura --- riceve data corrente e ultimo accesso come parametri, senza alcun accesso a database --- interamente testabile con date finte, dato che `last_sign_in_at` è gestito da GoTrue e non scrivibile a piacere via API; 19 nuovi test unitari coprono ogni transizione, incluso il reset quando un accesso avviene dopo l'inizio dello stato corrente. L'orchestrazione vera (`runDigitalLegacyCheck`, in `domain/digital-legacy/automation.ts`) pagina tutti gli utenti via l'API admin, applica l'azione decisa dalla funzione pura, manda l'email (best-effort: un invio fallito non deve impedire di registrare comunque la transizione) e registra l'evento in Attività (4 nuovi tipi, con una categoria propria nel registro) --- verificata anche con un test di integrazione contro il database reale (non può simulare una vera inattività, ma prova che l'intera pipeline gira senza errori). Eseguita una volta al giorno da un nuovo cron job Vercel (`vercel.json` + `app/api/cron/digital-legacy`), protetto da un secret che Vercel stesso invia quando la variabile `CRON_SECRET` è configurata sul progetto --- senza, la route rifiuta ogni richiesta, cron incluso, invece di girare senza protezione (verificato: senza quella variabile risponde 401 anche a una richiesta locale genuina). Cinque nuove colonne su `profiles` per lo stato della macchina a stati (`digital_legacy_enabled`/`_state`/`_state_entered_at`/`_reminders_sent`/`_last_reminder_at`).

**Da fare, solo l'utente può farlo:** impostare `CRON_SECRET` (un valore a caso, lungo) sia in `.env.local` sia nelle variabili d'ambiente del progetto su Vercel --- senza, il cron non farà mai nulla (fallisce in modo sicuro, non in modo silenzioso: risponde sempre 401).

---

## 2026-09-16 (5)

### FASE 12, primo passo --- Impostazioni > Eredità digitale: solo i parametri, nessuna automazione ancora

**Cosa fa:** una nuova scheda in Impostazioni, "Eredità digitale", dove scegliere la strategia che deciderà --- in una fase futura, non ancora costruita --- quando le tue capsule arrivano davvero a chi le doveva ricevere, se un giorno non dovessi più poter accedere a Hinthial. Tre preset a scelta rapida (Prudente/Normale/Rilassato, dal più lento e cauto al più rapido) mostrati come tasti in fila, più "Personalizza i valori" per modificarli uno per uno (soglia di inattività, numero e cadenza dei promemoria, periodo di grazia, quorum dei guardiani richiesto, durata della verifica formale e dell'attesa finale) --- ogni valore ha una breve spiegazione, e un riepilogo in linguaggio semplice sopra si aggiorna in tempo reale con la scelta corrente. Toccare anche un solo valore passa automaticamente alla scelta "Personalizzato". **Importante:** questa è solo la configurazione --- nessun rilevamento di inattività, promemoria, coinvolgimento dei guardiani o apertura di capsule è ancora stato costruito; i valori vengono salvati ma per ora non succede nulla da soli.

**Note tecniche:** discusso a fondo con l'utente prima di scrivere qualunque riga di codice (nome della funzionalità, terminologia guardiano/protetto, struttura del flusso a 7 fasi, valori dei tre preset) --- v. `domain/digital-legacy/types.ts` per il resoconto in forma di commenti. Otto nuove colonne su `profiles` (come `nav_orientation`/`onboarding_widget_hidden`, non una tabella dedicata: sono valori singoli per account), con vincoli `check` che impediscono configurazioni assurde anche in modalità "custom" (es. una soglia di inattività di due giorni) --- applicati anche client-side al salvataggio (`clampDigitalLegacyField`), non solo lasciati al database. Diagnosticati e corretti durante la verifica con la suite e2e completa due difetti pre-esistenti scoperti per caso, non causati da questa modifica: `global-search.spec.ts` cercava ancora la vecchia dicitura "contatti" nel placeholder della ricerca, mai aggiornata dopo la rinomina "Contatti fiduciari" → "Amici" di molti commit fa; `audit-log.spec.ts` aveva un'ambiguità tra la riga "Amico aggiunto" nella tabella e il popup di conferma omonimo (v. voce del 2026-09-16 (1) su ToastProvider), che a volte era ancora visibile nello stesso istante.

---

## 2026-09-16 (4)

### Rimossa la checklist "Onboarding" dal corpo della pagina Dashboard

**Cosa fa:** la Dashboard non mostra più la checklist "Onboarding" (i passi per iniziare a usare Hinthial) tra i propri contenuti --- resta comunque consultabile in ogni momento dall'indicatore persistente nella barra laterale (l'anello con la percentuale, v. "Onboarding"), che apre la stessa identica lista in un pannello.

**Note tecniche:** rimossa la card dal layout a due colonne di `DashboardWidgets` (ora una singola colonna: contatori, i tre riquadri scadenze/recenti/da completare, poi "Da tenere d'occhio") e la mini-checklist (2 passi) mostrata in `DashboardPanel` prima dello sblocco, sostituita lì da un semplice link ("vai all'archivio") coerente con quello già presente per lo stato "locked". Nessuna modifica alla logica di calcolo dei passi (`domain/onboarding/steps.ts`) né al gadget in barra laterale (`OnboardingStatus`), unico punto rimasto da cui la checklist è raggiungibile. Aggiornati i test e2e che verificavano l'avanzamento tramite la card ormai rimossa (`onboarding-checklist.spec.ts`, `dashboard-layout.spec.ts`) per verificarlo invece dal pannello del gadget.

---

## 2026-09-16 (3)

### Bug corretto: il tasto "+" tondo su smartphone poteva apparire spostato oltre il bordo destro dello schermo, con scorrimento orizzontale indesiderato

**Cosa fa:** su smartphone, il tasto "+" tondo in sovraimpressione (v. `MobileAddFab`, usato da Capsule/Beni/Amici/Scadenze/Archivio) poteva finire fuori dal bordo destro visibile, raggiungibile solo scorrendo la pagina di lato --- un effetto mai voluto.

**Note tecniche:** `<html>` ha già `overflow-x: hidden` (v. voce del 2026-09-15 sul menu che scorreva via), ma non basta da solo su alcuni browser mobile: un elemento `position: fixed` come questo tasto può comunque calcolare il proprio `right` rispetto alla larghezza reale del documento, se un qualunque altro contenuto della pagina eccede anche di poco quella dello schermo --- `<html>` lo taglia visivamente, ma non impedisce il calcolo sbagliato a un discendente fisso. Serve tagliare anche su `<body>`, ma non con un secondo `overflow-x: hidden`: due `hidden` (uno per elemento) avevano già causato, risolto in precedenza, un accoppiamento indesiderato dell'asse verticale in due contenitori di scroll distinti (rompendo `position: sticky` di Sidebar/TopNav/MobileNavBar). Usato invece `overflow: clip` su `<body>` --- non crea alcun contenitore scrollabile (nemmeno invisibile, raggiungibile da tastiera/JS), quindi non soffre dello stesso accoppiamento, pur tagliando comunque l'eccesso. Verificato che `position: sticky` continua a funzionare (suite e2e `sticky-nav.spec.ts` e affini, tutte verdi) --- lo scroll vero della pagina resta solo su `<html>`, come prima.

---

## 2026-09-16 (2)

### Bug corretto: chi condivide una capsula la ritrovava anche nel proprio elenco "Condivise con me"

**Cosa fa:** dopo aver condiviso una capsula, il mittente non la vedeva più (per errore) tra le proprie "Condivise con me" --- una sezione pensata solo per chi *riceve*, non per chi manda.

**Note tecniche:** `listCapsulesSharedWithMe` (`domain/capsules/repository.ts`) leggeva `capsule_shares` senza alcun filtro esplicito, affidandosi solo a RLS --- ma la tabella ha due policy SELECT permissive separate (`capsule_shares_select_owner` e `capsule_shares_select_recipient`, migrazione `20260912040000`), combinate in OR da Postgres: il proprietario può leggere le proprie righe per altri motivi (gestirle, revocarle), quindi la query senza filtro tornava le righe sia come destinatario sia come mittente. Corretto aggiungendo `.eq("recipient_user_id", user.id)` alla query --- non tocca la RLS (corretta per il proprio scopo), solo restringe questa specifica query al significato voluto. Diagnosticato dalla segnalazione dell'utente su un account reale (`giancarlo.menna.training` vedeva la propria capsula condivisa con `mennaarna` anche nel proprio elenco).

### Bug corretto: "Decryption failed" nella pagina Capsule per chi ha ricevuto una capsula ma non ne possiede ancora nessuna propria

**Cosa fa:** un account senza capsule proprie, ma con almeno una capsula ricevuta in condivisione, vedeva un errore ("Decryption failed: wrong key or corrupted/tampered data") invece della propria lista (vuota) di capsule.

**Note tecniche:** stessa classe di difetto della voce precedente, questa volta in `listCapsules` (le proprie capsule, non "Condivise con me"): nessun filtro esplicito su `owner_id`, solo RLS --- che per `capsules` ammette in SELECT sia `capsules_select_own` sia `capsules_select_shared_recipient` (migrazione `20260912040000`, quest'ultima pensata apposta per lasciar leggere status/open_at/il nome del mittente a chi ha ricevuto una condivisione). Senza filtro, `listCapsules` tornava anche le righe delle capsule condivise CON l'utente --- il cui `encrypted_payload` è cifrato con la Master Key del *proprietario*, non la propria: `decryptPayload` falliva puntualmente su quella riga. Corretto aggiungendo `.eq("owner_id", user.id)`, verificato riproducendo esattamente lo scenario sul database reale (account `mennaarna`: zero capsule proprie, una ricevuta).

---

## 2026-09-16

### Avvisi di condivisione capsule (email + popup in Dashboard), messaggi di conferma come popup, avatar al posto del ☰ su smartphone

**Cosa fa:** quattro piccoli miglioramenti richiesti dall'utente. (1) Nel menu su smartphone, il tasto con le tre lineette per aprire il menu è ora l'avatar dell'account (foto o iniziali) --- coerente con la barra laterale/superiore su schermi più larghi. (2) Chi riceve una capsula condivisa riceve ora anche un'email di avviso, oltre a vederla in "Condivise con me". (3) I messaggi "creato/aggiornato/chiuso/condiviso con successo", prima integrati nella pagina, appaiono ora come popup in sovraimpressione che sparisce da solo dopo pochi secondi --- non spostano più il resto del contenuto sotto di loro. (4) Chi riceve una capsula condivisa trova, la prima volta che apre la Dashboard dopo la condivisione, un popup che lo avvisa --- resta finché non lo chiude, poi non ricompare più per quella capsula (ma un'altra condivisione futura avrà il suo).

**Note tecniche:** l'email di avviso (`notifyCapsuleShared`, `lib/capsules/actions.ts`) è una Server Action best-effort chiamata da `shareCapsule`/`syncCapsuleSharesForLinkedFriend` (`domain/capsules/repository.ts`) --- un fallimento nell'invio non blocca mai la condivisione vera e propria, di cui è solo un effetto collaterale. L'indirizzo del destinatario non è mai conosciuto dal chiamante (solo un id account collegato): viene risolto qui, server-side, con l'API admin (`getUserById`) a partire dal solo id --- lo stesso schema già in uso per l'eliminazione account. Il popup "per sempre" in Dashboard si appoggia a una nuova colonna (`capsule_shares.dismissed_at`, migrazione `20260916010000`) con una policy RLS dedicata che permette al solo destinatario di segnare la propria riga come vista --- non ha alcun ruolo di sicurezza, serve solo a ricordare cosa è già stato mostrato, sopravvivendo a un refresh o a un altro dispositivo. I popup di conferma condividono un nuovo `ToastProvider` (`components/ui/ToastProvider.tsx`, montato in `AppShell`), che sostituisce interamente il vecchio `SuccessMessage` (rimosso, nessun altro consumatore) nei cinque pannelli che lo usavano, più due nuove chiamate per "capsula chiusa"/"capsula condivisa" che prima non avevano alcuna conferma. Riusa `useMountedTransition` per l'animazione, come il resto dell'app; testi identici ravvicinati (es. due "Bene creato." di fila) non si accodano due volte, si limitano a restare visibili. Durante la verifica con l'intera suite e2e, scoperto e corretto un difetto pre-esistente della FASE 13 (non causato da questa modifica): il tasto "Sblocca con un dispositivo fidato" (sempre presente nella schermata di sblocco, per il pairing via QR) rende ambiguo qualunque test che cerchi il tasto "Sblocca" per nome senza `exact: true` --- corretto nei cinque punti interessati.

---

## 2026-09-15

### FASE 13, ultimo passo --- elenco e revoca di tutti i dispositivi fidati, da qualunque dispositivo

**Cosa fa:** in Impostazioni > Sicurezza, sotto lo stato del dispositivo che stai usando, trovi ora l'elenco di *tutti* i dispositivi che hai reso fidati --- nome, data di registrazione, ultimo accesso --- consultabile e gestibile da qualunque dispositivo, non solo da quello a cui si riferisce ogni riga. Un tasto "Revoca" per ognuno: se revochi un dispositivo diverso da quello che stai usando, quello smette di poter sbloccare con la biometria al prossimo tentativo (si accorge da solo di non essere più fidato, e torna a chiedere la master password). Anche la registrazione e la revoca di un dispositivo compaiono ora nel registro Attività, come già succede per l'MFA.

**Note tecniche:** ultimo dei quattro passi previsti da HINTHIAL_MVP.md (FASE 13) --- completa la fase. Nessuna nuova tabella: solo una query in più su `trusted_devices` (righe non revocate dell'account) e il riutilizzo di `forgetTrustedDevice` già scritta per "dimentica questo dispositivo", identica sia che il chiamante stia rimuovendo se stesso sia un altro dispositivo --- la sola differenza è che rimuovere *se stessi* svuota anche la copia locale del Master Key (v. `MasterKeyProvider.tsx`, `forgetDeviceLock`), mentre un dispositivo diverso non è mai raggiungibile da qui: la sua autoguarigione avviene al SUO prossimo tentativo di sblocco (`findActiveTrustedDevice` non lo trova più tra i non revocati). Nuovi due tipi di evento nel registro Attività (`trusted_device_registered`/`trusted_device_revoked`), con la propria voce nella migrazione del vincolo `audit_events_event_type_check`. Corretta anche un'ambiguità: sia l'MFA sia "Dispositivi fidati" avevano un campo chiamato "Nome del dispositivo" per due cose diverse (un authenticator TOTP vs. un dispositivo con blocco biometrico) --- rinominato in "Nome del dispositivo fidato".

### FASE 13, secondo passo --- sblocca un dispositivo nuovo facendolo approvare da uno già fidato, via QR code

**Cosa fa:** su un dispositivo che non hai ancora mai usato con Hinthial (un PC nuovo, per esempio), nella schermata di sblocco puoi scegliere "Sblocca con un dispositivo fidato" al posto della master password: compare un QR code. Inquadralo con la fotocamera di un dispositivo già fidato (v. voce precedente) e apri il link che propone --- lì confermi con la master password una volta, e il primo dispositivo si sblocca da solo, nel giro di pochi secondi, senza che tu l'abbia mai digitata lì.

**Note tecniche:** secondo dei quattro passi previsti da HINTHIAL_MVP.md (FASE 13) --- resta solo l'elenco/revoca di *tutti* i dispositivi fidati dell'account per l'ultima fase. Riusa per intero lo scambio ECDH effimero-effimero già scritto per FASE C1 (`deriveSharedKeyAsSender`/`deriveSharedKeyAsRecipient`, v. `lib/crypto/keypair.ts`) --- qui nessuna delle due parti ha una chiave "permanente": il dispositivo nuovo genera una coppia effimera e ne mostra la pubblica nel QR, il dispositivo fidato ne genera un'altra per sé e deriva lo stesso segreto condiviso (proprietà simmetrica dell'ECDH), con cui cifra il Master Key. Una nuova tabella, `device_pairing_requests`, fa da tramite --- il server vede solo due chiavi pubbliche effimere e un blob già cifrato, mai il Master Key né una chiave capace di derivarlo; righe a vita breve (5 minuti) e cancellate non appena consumate. Il QR incorpora solo un URL (`/pair/<id>`, una pagina come le altre nell'app): niente lettore di QR scritto apposta, la fotocamera nativa del telefono basta a "trattarlo come un link". Il lato che approva richiede di nuovo la master password (stessa scelta della voce precedente): l'unico modo di ottenere una copia esportabile del Master Key. Verificato con un test e2e che usa due browser context separati (due sessioni indipendenti, stesso account) per lo scenario reale: un dispositivo genera la richiesta e resta in attesa (polling), l'altro la approva, il primo si sblocca da solo.

### FASE 13, primo passo --- sblocca il vault con l'impronta o Face ID, non solo con la master password

**Cosa fa:** in Impostazioni > Sicurezza puoi ora "rendere fidato" il dispositivo che stai usando (richiede di nuovo la master password, una volta): da quel momento, tornando su Hinthial da quello stesso dispositivo, puoi sbloccare il vault con l'impronta digitale o Face ID invece di digitarla di nuovo. Se cambi idea, "Dimentica questo dispositivo" annulla la fiducia in un clic.

**Note tecniche:** primo passo dei quattro previsti da HINTHIAL_MVP.md (FASE 13) --- solo "registrazione di un dispositivo fidato" e "blocco locale della chiave"; il pairing tra dispositivi via QR (per sbloccare un PC nuovo usando lo smartphone già fidato, senza mai digitare la password lì) e l'elenco/revoca di *tutti* i dispositivi dell'account arriveranno con le prossime fasi. Usa l'estensione PRF di WebAuthn (`lib/crypto/device-lock.ts`): a differenza del normale uso di WebAuthn per il login (provare la presenza dell'utente), PRF permette all'autenticatore di restituire un valore pseudo-random legato alla credenziale, mai il segreto sottostante --- esattamente come una password passa per PBKDF2 e la recovery key per HKDF prima di diventare una chiave AES-256-GCM (v. `recovery-key.ts`), qui l'input a HKDF è l'output del PRF. La chiave così derivata cifra una copia del Master Key che vive solo in `localStorage`, su quel dispositivo --- il server (`trusted_devices`, nuova tabella) sa solo che il dispositivo esiste, mai il segreto che lo sblocca. Sciolta consapevolmente la decisione architetturale che la spec segnalava esplicitamente (Master Key creata *non-extractable*): `unlockMasterKeyWithPassword` accetta ora un flag `extractable`, usato solo in questo unico punto (richiede di nuovo la password apposta), mai per lo sblocco quotidiano. Verificato con un vero autenticatore WebAuthn --- non mockato: l'autenticatore virtuale di Chrome DevTools Protocol (`hasPrf: true`), stessa API del browser, per un test e2e che registra un dispositivo, ricarica la pagina (nuova "sessione", Master Key mai persistito) e sblocca di nuovo solo con l'estensione PRF.

### Bug corretto: il tasto ☰ poteva restare senza effetto subito dopo il login

**Cosa fa:** in alcuni casi, toccare il tasto ☰ appena arrivati sulla Dashboard non apriva il menu di navigazione, pur sembrando normale --- bastava però passare a un'altra sezione e tornare indietro perché tornasse a funzionare. Ora si apre subito, in modo affidabile, anche al primissimo tocco dopo il login.

**Note tecniche:** diagnosticato isolando una sequenza esatta riproducibile (chiudere il popup "Crea la tua master key" e toccare subito dopo il tasto ☰) e tracciando passo per passo i render di `useMountedTransition` (v. `lib/use-mounted-transition.ts`, condiviso anche da anteprima capsule, ricerca globale e pannelli laterali) su una build di produzione pulita. Il meccanismo interno esatto in React non è mai stato individuato con certezza --- ma il momento critico coincide sempre con il montaggio per la prima volta di altri componenti dentro il cassetto appena apparso (ricerca globale, indicatore Onboarding): l'aggiustamento di stato "durante il render" che decide se il cassetto è montato può restare senza effetto proprio in quell'istante, senza che nulla lo richieda esplicitamente né lasci traccia in console. Corretto con una rete di sicurezza --- un effetto separato che riafferma lo stato "montato" se per qualche motivo il primo tentativo non ha avuto seguito --- verificata empiricamente contro lo scenario reale, ripetuta più volte su una build di produzione. Aggiunto anche un piccolo miglioramento indipendente in `MobileNavBar`: l'effetto che chiude il cassetto a ogni cambio pagina non scatta più (inutilmente) anche al primo montaggio. Nuovo test e2e dedicato (`mobile-nav-after-intro.spec.ts`) che riproduce la sequenza esatta.

### Bug corretto: il menu di navigazione (☰ su smartphone, barra laterale sopra) scorreva via con la pagina

**Cosa fa:** su qualunque pagina più alta di una schermata --- praticamente sempre, con dati reali --- il tasto ☰ per aprire il menu (sotto una certa larghezza) e la barra laterale con l'avatar (sopra) ora restano sempre visibili e raggiungibili mentre si scorre la pagina, invece di scorrere via insieme al resto del contenuto. Corregge la segnalazione di un menu che "non si apriva più" o appariva "sotto" il corpo della pagina --- in realtà semplicemente scorso fuori vista.

**Note tecniche:** due cause distinte, entrambe necessarie per la correzione. (1) `<aside>` (Sidebar) non aveva mai avuto un'altezza propria né `position: sticky` --- per il comportamento di default di flexbox (`align-items: stretch`), la sua altezza seguiva quella di `<main>`, quindi su una pagina lunga finiva alta migliaia di pixel, con l'avatar (in fondo, via `mt-auto`) ben sotto la parte visibile. Aggiunto `md:sticky md:top-0 md:h-screen` (più `overflow-y-auto` come rete di sicurezza) a Sidebar, e `sticky top-0` a TopNav e alla barra superiore di MobileNavBar. (2) Anche con questo, `position: sticky` non funzionava lo stesso: `globals.css` impostava `overflow-x: hidden` sia su `<html>` che su `<body>` (rete di sicurezza contro un piccolo scorrimento orizzontale) --- ma la regola CSS che accoppia gli assi (un `overflow-x` non "visible" forza anche l'`overflow-y` implicito a diventare "auto") trasformava ENTRAMBI in contenitori di scroll verticale indipendenti e ambigui, mentre lo scroll vero della pagina avviene solo su `<html>`: un elemento sticky dentro quell'ambiguità si ancorava al contenitore sbagliato, restando "sticky" di nome (visibile in `getComputedStyle`) ma scorrendo via lo stesso nella pratica. Rimosso da `<body>`, lasciato solo su `<html>` (quello che scorre davvero). Nuovo test e2e dedicato (`sticky-nav.spec.ts`), sia sopra che sotto la soglia `md`. Nota separata: durante la diagnosi è emerso un secondo bug, distinto e non ancora corretto --- il cassetto di navigazione mobile (lo stesso ☰) non si apre se aperto dalla pagina Impostazioni specificamente (lo stato `open` risulta vero ma l'elemento non viene mai montato); non correlato a questo fix né alle modifiche di questa sessione, resta da investigare separatamente.

### FASE C1 --- una capsula chiusa e condivisa diventa davvero apribile da chi la riceve

**Cosa fa:** se hai un amico "✓ Su Hinthial" (un vero account collegato) tra i destinatari di una capsula, quando la chiudi e la condividi lui la ritrova nella scheda "Condivise con me" di Capsule, con lo stesso countdown visivo che vedi tu. Prima della data di apertura può solo guardare il countdown; da quel momento in poi compare un tasto "🔓 Apri" che gli mostra il contenuto --- testo e allegati, decifrati sul suo dispositivo con la sua Master Key, mai con la tua.

**Note tecniche:** ogni account guadagna ora una coppia di chiavi ECDH (P-256, generata via Web Crypto API), pubblica in chiaro e privata cifrata dalla Master Key del proprietario (stessa cifratura di una Document Key --- v. `lib/crypto/keypair.ts`); creata al primo setup, oppure retroattivamente al primo sblocco successivo per chi ha un account precedente a questa fase (`ensureKeyPair` in `MasterKeyProvider.tsx`, best-effort). Le capsule cifrano già il proprio payload direttamente con la Master Key del proprietario (non con una Document Key indipendente, a differenza dei Documenti): condividerlo con un destinatario ha quindi richiesto una seconda cifratura parallela, pensata apposta per lui --- alla chiusura/condivisione, una coppia di chiavi ECDH effimera (usa e getta) deriva una chiave AES-256-GCM condivisa con la chiave pubblica del destinatario, usata per cifrare una copia del contenuto (titolo, testo, allegati con le rispettive Document Key in chiaro) in una nuova tabella, `capsule_share_keys`. Il destinatario rideriva la stessa identica chiave con la propria chiave privata (proprietà simmetrica di ECDH) e la usa per decifrare. La data di apertura non è solo un controllo lato interfaccia: una policy RLS dedicata nega la lettura di quella riga --- e degli allegati su Storage --- finché `capsules.open_at` non è nel passato, verificato dal database stesso, non dal client. Se il destinatario non ha ancora una propria coppia di chiavi al momento della condivisione, la capsula resta comunque visibile in "Condivise con me" ma senza possibilità di aprirla --- nessun ritentativo automatico per questo caso specifico (diverso dal ricollegamento automatico di un amico, che riprova già da solo). Non è ancora il Dead Man's Switch --- resta un meccanismo di apertura manuale a data fissa (v. HINTHIAL_MVP.md, FASE 12 futura per l'interruttore vero e proprio). Verificato con un nuovo test e2e dedicato (`capsule-sharing.spec.ts`, due account reali) oltre a un test unitario sullo scambio di chiavi (`keypair.test.ts`) che prova che il segreto condiviso è davvero lo stesso su entrambi i lati e che un terzo non può derivarlo.

## 2026-09-14

### Bug corretto: un amico collegato a un account non si scollegava più cambiandogli l'email

**Cosa fa:** se un amico risulta "✓ Su Hinthial" (collegato automaticamente a un vero account, per email corrispondente) e poi gli cambi l'email, il collegamento --- e con lui la foto reale mostrata --- ora si azzera subito, invece di restare agganciato all'account di prima. Alla prossima visita ad Amici, se la nuova email corrisponde a un altro account, si ricollega da solo a quello; altrimenti resta scollegato.

**Note tecniche:** `updateFriend()` (`domain/friends/repository.ts`) non toccava mai `linked_user_id`, e `checkLinkedAccounts` (`FriendsPanel.tsx`) riprova il collegamento solo per chi non ne ha già uno --- combinati, un amico già collegato non veniva più ricontrollato per il resto della sua vita, anche cambiandogli completamente email. `EditFriendForm` confronta ora l'email appena scritta con quella originale (già decifrata, già in mano al client) e passa un flag `emailChanged` a `updateFriend()`, che azzera `linked_user_id` nella stessa scrittura --- mai `avatar_path`, che è una foto caricata a mano, indipendente dall'email. Nuovo test e2e dedicato (`friend-account-link.spec.ts`), prima area senza copertura per questa funzionalità.


### Ottimizzazioni di velocità: meno un giro di rete per pagina, meno codice caricato a vuoto

**Cosa fa:** le pagine dovrebbero rispondere un po' più svelte, in particolare la prima interazione dopo il login e il passaggio da una sezione all'altra. Non un cambiamento visibile in interfaccia --- solo meno lavoro superfluo dietro le quinte a ogni navigazione.

**Note tecniche:** misurato con un confronto reale dev-vs-produzione (che ha anche confermato che gran parte della "lentezza" percepita durante lo sviluppo è dovuta a Turbopack che compila ogni pagina al primo accesso di ogni sessione dev --- normale, e assente in produzione). Due interventi concreti trovati comunque validi: (1) `getCurrentUser()` non richiama più `supabase.auth.getUser()` (un giro di rete verso il server di autenticazione) ma legge la sessione già verificata pochi istanti prima da `src/proxy.ts`, il cui matcher copre ogni pagina qui interessata --- da lì in poi nella stessa richiesta non serve verificarla una seconda volta. (2) La libreria `qrcode` (usata solo per il QR del kit di recovery, in `SetupMasterKeyForm`) è passata da un import statico --- che la spediva con ogni pagina protetta da `RequireMasterKey`, quindi quasi ovunque nell'app, anche per chi ha configurato la cifratura da tempo --- a un import dinamico, caricato solo nell'istante in cui serve davvero. Verificato che non venga più scaricata visitando una sezione qualunque.


### "Novità" diventa una voce di menu a sé, non più una card in Dashboard

**Cosa fa:** la card "Novità" e il suo pannello laterale sono spariti dalla Dashboard --- al loro posto, una nuova voce nel menu principale, "Novità", apre una pagina a sé (come Cronologia, ma senza filtri) con le ultime 10 modifiche a Hinthial in tabella, dalla più recente, e un tasto "Vedi tutte" per il resto.

**Note tecniche:** `ProductUpdatesWidget` rimosso; `UpdatesPanel` (nuova pagina `/updates`) riusa lo stesso `domain/product-updates/repository.ts` --- un solo caricamento di tutte le righe, "Vedi tutte" si limita a mostrarne il resto senza una seconda richiesta. Voce di menu con `requiresEncryption: false` (come Dashboard): contenuto globale, non serve la master key.

### Voci del menu principale: quali mostrare, e in che ordine

**Cosa fa:** in Impostazioni > Aspetto puoi ora scegliere quali voci compaiono nel menu di navigazione principale (barra laterale o orizzontale), e in quale ordine --- stesso meccanismo già usato per la barra in basso su smartphone, applicato qui alla barra principale su ogni dispositivo.

**Note tecniche:** nuova colonna `profiles.main_nav_items` (jsonb, come `bottom_nav_items`) e `lib/main-nav.ts`/`MainNavItemsProvider`/`useOrderedNavItems()`, consumato da Sidebar/TopNav (l'intero elenco) e MobileNavBar (il cassetto, meno le voci già nella barra in basso). A differenza della barra in basso, qui nascondere una voce non lascia un "altrove" dove ritrovarla: resta comunque raggiungibile da Dashboard o dalla ricerca globale.

### Impostazioni: Aspetto a due colonne, contenuto a piena larghezza ovunque

**Cosa fa:** in Impostazioni > Aspetto le sezioni (Tema, Disposizione del menu, Voci del menu, Barra in basso, Liste, Capsule) si affiancano su due colonne quando lo schermo è abbastanza largo. In generale, il contenuto di ogni scheda di Impostazioni usa ora tutta la larghezza disponibile, invece di restare compresso in una colonna stretta anche su schermi ampi.

### Onboarding: rispetta "Nascondi" anche in Dashboard

**Cosa fa:** una volta scelto "Nascondi" per il gadget Onboarding, la checklist non ricompare più nemmeno come card in Dashboard --- prima spariva solo dalla barra di navigazione. La primissima volta (prima di aver mai scelto "Nascondi") continua a comparire in entrambi i posti, come sempre.

### Foto di un amico/del profilo: fotocamera e galleria, ognuna il suo tasto

**Cosa fa:** "Carica foto" apre sempre la scelta di un file esistente (la galleria su smartphone); "Scatta foto" apre sempre la fotocamera --- prima capitava che entrambi aprissero la fotocamera su smartphone. Su computer, "Scatta foto" ora accende davvero la webcam del dispositivo, con un'anteprima dal vivo, invece di aprire la solita finestra di scelta file.

**Note tecniche:** due `<input type="file">` distinti invece di uno solo con `capture` attivato/disattivato al volo (quel trucco dipende dal blur per ripristinarsi, che su alcuni browser/OS mobile non scatta mai dopo aver annullato la fotocamera). Su desktop, `getUserMedia` con un fotogramma catturato su `<canvas>`, alimentato nello stesso ritaglio a quadrato già esistente.


### Amici: foto profilo, anche per gli account collegati

**Cosa fa:** ogni amico può avere una foto, in elenco, in tabella e nella pagina di modifica. La carichi tu (con lo stesso ritaglio a quadrato già usato per la tua foto profilo, e ora anche "📷 Scatta foto" oltre a "Carica foto" --- comparso anche nelle tue Impostazioni, per coerenza) --- oppure, se quell'amico è già un account Hinthial collegato, vedi automaticamente la sua foto vera, senza doverla caricare tu. Una foto caricata a mano vince sempre su quella reale. Senza nessuna delle due, le iniziali di nome e cognome su uno sfondo colorato, come per il tuo profilo.

**Note tecniche:** `AvatarPickerCrop` estrae il ritaglio già scritto per `AvatarUploadForm` (canvas, drag, zoom) in un componente riusabile, condiviso ora da profilo e amico; il tasto "Scatta foto" riusa il trucco già in Archivio (`capture="environment"` impostato un istante prima del click, tolto subito dopo). Nuova colonna `friends.avatar_path` (bucket `avatars`, pubblico, in chiaro --- stesso principio già accettato per l'avatar del profilo), path `{owner_id}/friend-{friend_id}-{ts}.jpg`: nessuna nuova policy di Storage necessaria, la cartella resta quella di chi carica. Per la foto reale di un account collegato, niente accesso diretto alla sua riga `profiles` (che nel tempo si è riempita di parecchie colonne non pertinenti --- preferenze, consensi IA, data di nascita): una funzione dedicata `get_linked_friend_avatar_path` (SECURITY DEFINER, stesso schema di `lookup_friend_account`) restituisce solo il path della sua foto, verificando che chi chiama possieda davvero quella riga `friends`. Risolta in `FriendsPanel` in un passaggio a parte (`resolveLinkedAvatar`), mai bloccando il caricamento dell'elenco.

### Il "Nome" degli amici diventa "Nome visualizzato"; aggiunti Nome e Cognome

**Cosa fa:** in Amici, il campo che finora si chiamava "Nome" ora si chiama "Nome visualizzato" --- è lo stesso campo di sempre, solo con un nome più preciso su cosa fa: decide cosa vedi in elenco e in tabella. Accanto, due nuovi campi facoltativi, Nome e Cognome: compilandoli, il Nome visualizzato si aggiorna da solo come "Nome Cognome", finché non lo tocchi direttamente --- da quel momento resta quello che hai scritto, anche continuando a correggere nome o cognome.

**Note tecniche:** `encrypted_name` (rinominato solo concettualmente, nessuna migrazione: resta la stessa colonna) affiancato da due nuove colonne cifrate `encrypted_first_name`/`encrypted_last_name`, nullable --- gli amici già esistenti restano "" decifrati, mai un errore. La sincronizzazione "Nome Cognome" -> Nome visualizzato vive lato client (`displayNameEdited`, un booleano che smette di seguire dopo il primo tocco diretto sul campo); in modifica, lo stato iniziale di quel booleano si deduce confrontando il nome visualizzato già salvato con "nome cognome" attuale --- se combaciano è ancora "automatico", altrimenti si considera già personalizzato (copre da sé anche gli amici creati prima che nome/cognome esistessero).

### Novità in Dashboard: la storia di Hinthial raccontata a te

**Cosa fa:** dove ci sono i contatori, in Dashboard, una nuova sezione "Novità" mostra le ultime 5 modifiche fatte a Hinthial, spiegate in modo amichevole e rivolte direttamente a te --- non i dettagli tecnici del changelog di sviluppo, solo cosa cambia per chi usa l'app. Un tasto "Vedi tutte" apre un pannello laterale con tutta la storia, cercabile.

**Note tecniche:** nuova tabella `product_updates` (title, description, published_on) --- la prima dell'app senza `owner_id`: contenuto uguale per tutti gli utenti, una sola policy RLS (`select` per chi è autenticato, `using (true)`) e nessuna policy di scrittura per il client: si popola solo da migrazioni, mai da un'azione dell'interfaccia. Backfill storico ispirato al changelog di sviluppo ma curato a mano (non ogni voce tecnica lì merita una riga qui) e riscritto in seconda persona. `ProductUpdatesWidget` carica l'intero elenco una sola volta (poche decine di righe), mostra le prime 5 e filtra il resto lato client nel pannello "Vedi tutte" (stesso `SidePanel`/`SearchInput` già usati per il dettaglio di un'attività).

### Il countdown delle capsule diventa un cartellino che scatta; puoi nasconderlo

**Cosa fa:** il conto alla rovescia verso l'apertura di una capsula (in elenco, in tabella --- ora in una colonna propria "Tra quanto" --- e nell'anteprima) è ora un cartellino animato che segna giorni, ore, minuti e secondi, aggiornato dal vivo mentre lo guardi: giorni/ore/minuti scattano con un piccolo "flip" meccanico, i secondi si limitano a cambiare numero (scattare ogni secondo sarebbe frenetico invece che piacevole). Oltre i 100 giorni un numero secco sostituisce i cartellini; una volta raggiunta la data, un badge "🔓 Disponibile da adesso" al loro posto. Se preferisci un'interfaccia più essenziale, un nuovo interruttore in Impostazioni > Aspetto lo nasconde ovunque.

**Note tecniche:** `computeCountdownParts` (nuovo, in `lib/capsule-countdown.ts`) scompone il tempo restante per difetto (mai arrotondato, a differenza dell'etichetta testuale già esistente, che resta la fonte dell'aria-label di accessibilità --- non ricalcolata al secondo, per non spammare chi usa uno screen reader). Un solo `setInterval` al secondo condiviso da ogni `CapsuleCountdown` montato nella pagina (`use-countdown-tick.ts`), non uno per riga. Nuova colonna `profiles.capsule_countdown_visible` (default true), letta/scritta da `CapsulesPanel`/`CapsuleCountdownSettings`.


### Il conto alla rovescia della capsula scende a ore e minuti; compare solo dopo la chiusura

**Cosa fa:** quando manca meno di un giorno all'apertura di una capsula, il conto alla rovescia non dice più genericamente "oggi" --- ti dice "si aprirà tra 16 ore", e sotto l'ora "si aprirà tra 14 minuti". Inoltre ora lo vedi solo sulle capsule chiuse (o condivise): su una bozza non compare più, dato che lì la data di apertura può ancora cambiare e un conto alla rovescia non avrebbe senso.

**Note tecniche:** `computeCountdown` (`lib/capsule-countdown.ts`) ora ramifica sulla differenza esatta in millisecondi da `openAt`, non solo sulla differenza di data di calendario: sotto le 24h mostra le ore intere, sotto l'ora i minuti interi (entrambi arrotondati e con singolare/plurale corretto; clampati rispettivamente a 23 e 59 per evitare che un arrotondamento al bordo mostri "24 ore" o "60 minuti"). Sopra le 24h il comportamento resta quello di prima (giorni interi, "domani" per esattamente un giorno). `CapsulesPanel` mostra `CapsuleCountdown` solo quando `status !== "draft"`.

### La data di apertura di una capsula diventa data e ora

**Cosa fa:** quando crei o modifichi una capsula, "Si aprirà il ..." ora chiede anche l'orario, non solo il giorno --- lo stesso calendario nativo dello smartphone/browser, con in più la scelta dell'ora. Ovunque compaia una data di apertura (elenco Capsule, anteprima, "Condivise con me", il conteggio alla rovescia) viene mostrata con l'orario incluso.

**Note tecniche:** `CapsuleOpenAtField` passa da `<input type="date">` a `<input type="datetime-local">` --- la conversione da/verso il formato locale "YYYY-MM-DDTHH:mm" richiesto dall'input resta un dettaglio interno del componente: verso l'esterno `value`/`onChange` restano un ISO datetime (UTC), come ogni altra data dell'app (stesso principio già usato per `reminders.due_at`). Colonna `capsules.open_at` da `date` a `timestamptz`. Il conto alla rovescia (`lib/capsule-countdown.ts`) continua deliberatamente ad arrotondare ai giorni interi nell'etichetta ("Si aprirà tra N giorni") --- non ne serviva una più precisa, solo il momento scelto doveva poter includere l'ora.

## 2026-09-12

### "Condivise con me" dentro Capsule (FASE B della condivisione capsule)

**Cosa fa:** in Capsule c'è ora una scheda "Condivise con me", accanto a "Le mie" --- elenca le capsule che altri amici (già collegati a un account Hinthial, v. voce precedente) hanno condiviso con te: da chi, quando, e quando è prevista l'apertura. Il contenuto vero e proprio non è ancora consultabile --- lo sarà con una fase futura, quando arriverà anche lo scambio di chiavi necessario a decifrarlo; per ora è solo il collegamento e i metadati già in chiaro. Se un amico riceve una capsula prima ancora di essersi registrato su Hinthial, non la perde: non appena il suo account viene riconosciuto (v. voce precedente), la capsula compare comunque in "Condivise con me", retroattivamente.

**Note tecniche:** nuova tabella `capsule_shares` (capsule_id, owner_id, recipient_user_id, shared_at) --- creata da `shareCapsule()` per ogni destinatario già collegato a un account nel momento in cui si preme "Condividi", e retroattivamente da `syncCapsuleSharesForLinkedFriend()` quando `FriendsPanel` scopre più tardi che un amico si è registrato (stessa verifica in background della Fase A, ora anche fonte per questa sincronizzazione). Due nuove policy RLS (`capsules_select_shared_recipient`, `profiles_select_shared_by_owner`) lasciano al destinatario la sola lettura di stato/data apertura della capsula e nome del mittente --- l'`encrypted_payload` resta comunque illeggibile per lui quanto lo è già per il server, nessuna concessione di riservatezza a dargli la riga intera. `listCapsulesSharedWithMe()` risolve tutto in due query batch (mai una per capsula). Verificato end-to-end con due account reali, includendo lo scenario retroattivo per intero: A condivide con un'email non ancora registrata, quell'account si registra dopo, il collegamento scatta al prossimo caricamento di Amici, e la capsula compare da sola in "Condivise con me" di quell'account.

### Hinthial riconosce da solo quali amici hanno un account (FASE A della condivisione capsule)

**Cosa fa:** in Amici, ogni amico la cui email corrisponde a un account Hinthial registrato mostra ora un badge "✓ Su Hinthial" --- anche se si è registrato *dopo* essere stato aggiunto o invitato. Ogni volta che apri la pagina, gli amici non ancora riconosciuti vengono ricontrollati in automatico, senza bisogno di fare nulla apposta. Non concede ancora alcun accesso: è solo il primo passo (di quattro) verso poter davvero condividere il contenuto di una capsula con chi la riceve.

**Note tecniche:** nuova colonna `friends.linked_user_id`, risolta da una nuova funzione Postgres `lookup_friend_account(target_email)` (SECURITY DEFINER, stesso principio di `log_failed_login_attempt`) che verifica una singola email alla volta contro `auth.users`/`profiles` --- mai un elenco, mai un confronto bulk, perché l'email dell'amico resta cifrata con la Master Key di chi lo ha aggiunto e il server non può leggerla da sé. A differenza di `log_failed_login_attempt`, qui rivelare la corrispondenza è proprio lo scopo (non un effetto collaterale da evitare): per mitigare l'uso della funzione come oracolo per enumerare account registrati, un tetto di 200 verifiche al giorno per chi chiama (`friend_lookup_attempts`, mai esposta al client). Lato client, `FriendsPanel` ricontrolla ad ogni caricamento solo gli amici con `linkedUserId` ancora nullo, in sequenza e in background, senza bloccare la pagina né disturbare l'utente in caso di fallimento (si riprova al prossimo caricamento). Verificato end-to-end con due account reali: A aggiunge B come amico dopo che B si è già registrato --- il badge compare al caricamento e resta dopo un refresh vero.

### "Contatti fiduciari" diventa "Amici"; il flag "amico" diventa "Guardiano"

**Cosa fa:** la sezione prima chiamata "Contatti"/"Contatti fiduciari" ora si chiama **Amici** ovunque nell'app --- voce di menu, titoli di pagina, url (`/friends` invece di `/contacts`), esportazione dati, ricerca globale, cronologia, registro Attività. Il flag interno che segnala chi riceve un avviso informale in caso di lunga inattività (in precedenza "amico") diventa **Guardiano**, per non sovrapporsi al nuovo nome della sezione --- semanticamente è anche più preciso: un guardiano è letteralmente qualcuno a cui affidi un ruolo di tutela.

**Note tecniche:** rinominati route (`src/app/(app)/contacts` → `friends`), componenti (`TrustedContactsPanel` → `FriendsPanel`, `ContactPicker` → `FriendPicker`, `CreateContactForm`/`EditContactForm` → `CreateFriendForm`/`EditFriendForm`), dominio (`domain/contacts` → `domain/friends`, `TrustedContactListItem` → `FriendListItem`, `isFriend` → `isGuardian`), e ogni punto che referenziava l'entità come chiave interna (`ListSection`, `ImportKind`, `AuditEventCategory`, `TimelineEntryKind`, contatori dashboard, contesto AI). Migrazione DB (`20260912020000_contacts_to_friends.sql`): tabella `trusted_contacts` → `friends`, colonna `is_friend` → `is_guardian`, indice/trigger/policy/vincolo di chiave esterna rinominati di conseguenza, tipo di evento audit `trusted_contact_added` → `friend_added` (righe già registrate durante lo sviluppo riscritte prima di stringere il vincolo). Formato di esportazione dati (`ExportManifest`) portato a `hinthialExportVersion: 2` per lo stesso motivo (`trustedContacts` → `friends`). Nessun dato reale da preservare (progetto in sviluppo, v. README) --- migrazione applicata direttamente, nessun redirect da `/contacts` predisposto.

### Ridotto al minimo lo spazio riservato in fondo lista per il "+" in sovraimpressione

**Cosa fa:** in Archivio, Beni, Contatti, Scadenze e Capsule, lo spazio vuoto lasciato in fondo alla lista su smartphone per non far coprire l'ultima riga dal "+" (v. voce precedente) ora è molto più piccolo --- resta giusto un margine, non più una fascia vuota vistosa.

**Note tecniche:** il fix precedente calcolava il padding-bottom da zero rispetto al fondo reale dello schermo (`9.5rem`, cioè l'intero ingombro del FAB più margine), ignorando che `<main>` (v. AppShell) riserva già `pb-24` (6rem) sotto `md` per non far finire i contenuti sotto la barra di navigazione fissa --- le due riserve si sommavano invece di sottrarsi, lasciando un vuoto ben più grande del necessario (misurato ~134px). Corretto calcolando solo la differenza: il FAB arriva a 8.5rem dal fondo reale (altezza + bottom-offset), 2.5rem oltre ai 6rem già riservati da `<main>` --- il padding qui copre solo quella differenza più mezzo rem di margine (`pb-[calc(3rem+env(safe-area-inset-bottom))] sm:pb-0`). Riverificato con lo stesso scenario di prima (12 scadenze, scroll fino in fondo, click reale sul tasto "⋮" dell'ultima riga): margine sceso da ~134px a ~30px, ancora senza sovrapposizione.

### Bug corretto: il "+" in sovraimpressione bloccava il menu azioni dell'ultima riga di una lista

**Cosa fa:** in Archivio, Beni, Contatti, Scadenze e Capsule, arrivati in fondo a una lista lunga su smartphone, il tasto "⋮" delle azioni delle ultime righe non finisce più coperto dal "+" tondo --- ora resta sempre pienamente raggiungibile.

**Note tecniche:** il FAB occupa sempre lo stesso rettangolo fisso in basso a destra dello schermo (`position: fixed`); scrollando fino in fondo, l'ultima riga di una lista abbastanza lunga finiva proprio lì sotto, e il tocco veniva intercettato dal FAB (z-index più alto) invece che dal tasto "⋮" della riga (v. RowActionsMenu). Riservato, sotto `sm`, un padding-bottom sul contenitore di ognuno dei cinque componenti pari all'ingombro del FAB più un margine (`pb-[calc(9.5rem+env(safe-area-inset-bottom))] sm:pb-0`): l'ultima riga si ferma ora sempre sopra il FAB. Verificato creando 12 scadenze, scorrendo fino in fondo e cliccando davvero il tasto "⋮" dell'ultima --- prima del fix il click sarebbe stato intercettato dal FAB.

### Su smartphone, il tasto "aggiungi" diventa un "+" tondo in sovraimpressione

**Cosa fa:** in Archivio, Beni, Contatti, Scadenze e Capsule, su smartphone il tasto per creare un nuovo contenuto non è più affiancato al titolo di pagina --- è ora un pulsante rotondo blu con un "+", fisso in basso a destra sopra la barra di navigazione rapida, sempre raggiungibile senza scorrere la pagina. Al tocco porta alla stessa schermata di creazione di sempre (es. "Aggiungi capsula" apre "Nuova capsula"). Su desktop e tablet nulla cambia: resta il tasto normale accanto al titolo.

**Note tecniche:** nuovo componente condiviso `MobileAddFab.tsx` (link con `aria-label` descrittivo, `position: fixed`, `sm:hidden`); il tasto originale in ciascuno dei cinque componenti diventa `hidden sm:block`, così sotto `sm` scompare del tutto e il FAB lo sostituisce, invece di scendere su una riga propria come nella modifica precedente.

### Barra di navigazione in basso: 5 voci invece di 4, e ora riordinabili da Impostazioni

**Cosa fa:** in Impostazioni > Aspetto > "Barra di navigazione in basso (smartphone)" si possono ora scegliere fino a 5 voci (prima 4) per la barra fissa in basso su smartphone, e soprattutto se ne può scegliere l'ordine: l'elenco "Nella barra" si trascina con mouse o dito per riordinarlo, oppure si spostano le voci su/giù con le frecce ▲▼ (più comode da tastiera o senza trascinamento); "Altre voci" resta l'elenco da cui aggiungerne di nuove in fondo.

**Note tecniche:** `MAX_BOTTOM_NAV_ITEMS` da 4 a 5 (`lib/bottom-nav.ts`). Corretto anche un bug per cui `BottomNavBar.tsx` ignorava del tutto l'ordine scelto: renderizzava sempre le voci nell'ordine fisso di `NAV_ITEMS`, filtrate su quelle scelte, invece che nell'ordine memorizzato in `profiles.bottom_nav_items` --- riordinare non aveva mai avuto alcun effetto visibile finché non risolto qui. `BottomNavItemsSettings.tsx` riscritto: due elenchi separati (selezionate, ordinate secondo l'array `items`, con maniglia di trascinamento nativa HTML5 Drag and Drop + frecce ▲▼ + tasto ✕ per togliere; non selezionate, con checkbox per aggiungere) invece dell'unico elenco di sole checkbox di prima.

### Su smartphone, il tasto "aggiungi" scende sotto il titolo per lasciare tutta la larghezza alla descrizione

**Cosa fa:** in Archivio, Beni, Contatti, Scadenze e Capsule, su smartphone il tasto "+ Aggiungi/Crea" ora compare in una riga propria sotto titolo e descrizione, invece di stare affiancato sulla stessa riga del titolo --- la descrizione guadagna così tutta la larghezza dello schermo invece di doversi stringere nello spazio lasciato libero dal tasto, andando a capo su meno righe e liberando spazio in verticale per i contenuti veri e propri sotto. Su desktop e tablet nulla cambia: titolo, descrizione e tasto restano affiancati come prima.

**Note tecniche:** la fix precedente (`min-w-0 flex-1` sul contenitore titolo+descrizione) risolveva lo spreco di spazio orizzontale ma non lo "sfratto": quel contenitore condivideva comunque la riga col tasto per tutta la sua altezza, quindi la larghezza disponibile restava comunque ridotta della larghezza del tasto --- più evidente quanto più lungo il testo del tasto ("+ Crea capsula" più largo di "+ Crea bene"). Cambiato il contenitore esterno da `flex items-start justify-between gap-4` a `flex flex-col items-start gap-4 sm:flex-row sm:justify-between` in tutti e cinque i componenti, col contenitore titolo+descrizione `w-full sm:flex-1`: sotto la soglia `sm` (640px) il tasto scende su una riga propria a piena larghezza; da `sm` in su il layout torna quello di sempre. Verificato con screenshot Playwright a 375px e 1280px.

### Intestazione allineata nelle pagine con tasto "aggiungi": titolo e descrizione ora usano tutta la larghezza

**Cosa fa:** in Archivio, Beni, Contatti, Scadenze e Capsule, la descrizione sotto il titolo di pagina non va più a capo prematuramente lasciando spazio vuoto prima del tasto "+ Aggiungi/Crea" --- ora occupa tutta la larghezza disponibile, sia su desktop (dove titolo, descrizione e tasto stanno sulla stessa riga) sia su smartphone (dove il tasto scende sotto, restando allineato a sinistra come il titolo).

**Note tecniche:** il contenitore di titolo+descrizione, dentro la riga flessibile che lo affianca al tasto, non aveva `flex-1` --- restava largo solo quanto il proprio contenuto (shrink-to-fit) invece di espandersi allo spazio residuo della riga, così la `<p>` andava a capo prima del dovuto. Aggiunto `min-w-0 flex-1` al contenitore in tutti e cinque i componenti (`DocumentsPanel.tsx`, `AssetsPanel.tsx`, `TrustedContactsPanel.tsx`, `RemindersPanel.tsx`, `CapsulesPanel.tsx`); il tasto affiancato aveva già `shrink-0`, quindi resta sempre alla sua dimensione piena. `TimelinePanel.tsx` (Cronologia) escluso perché non ha un tasto "aggiungi". Verificato a 1280px e 375px con screenshot Playwright ad-hoc prima di confermare.

### Capsule: descrizione più corta, spiegazione completa solo su richiesta

**Cosa fa:** sotto il titolo di Capsule ora compare una sola riga breve, invece del paragrafo lungo di prima --- su smartphone occupava la maggior parte dello schermo. Il dettaglio completo (cosa succede chiudendo una capsula, che l'originale resta libero, che l'accesso reale ai destinatari arriverà in futuro) resta disponibile aprendo "Come funziona chiudere una capsula", non più imposto in cima alla pagina.

**Note tecniche:** nessuna perdita di sicurezza --- l'avviso sull'irreversibilità della chiusura era già ripetuto nella conferma al momento di chiudere una capsula per davvero (v. `handleClose`, `window.confirm`), quindi il paragrafo fisso era ridondante, non l'unica rete di sicurezza. Disclosure nativa (`<details>`/`<summary>`), nessun nuovo stato React.

### Bug corretto: icone di Impostazioni quasi invisibili sulle schede con nome lungo

**Cosa fa:** le icone di "Informazioni utente" e "Intelligenza artificiale" nel menu di Impostazioni non erano più piccole delle altre per scelta grafica --- si schiacciavano quasi fino a sparire, perché le loro etichette (le più lunghe dell'elenco) non ci stavano nella colonna della barra laterale. Ora restano sempre alla loro dimensione piena, come tutte le altre.

**Note tecniche:** le icone non avevano `flex-shrink: 0` --- in un contenitore flessibile stretto (`md:w-48`), col testo impostato a non andare a capo, l'unico elemento libero di restringersi per far stare tutto era l'icona, fino quasi a zero pixel di larghezza per l'etichetta più lunga. Aggiunto `shrink-0` alle icone (mai più responsabili di "assorbire" lo spazio mancante) e allargata la colonna della barra laterale da `md:w-48` a `md:w-60`, come margine di sicurezza per le etichette più lunghe. Diagnosticato misurando la vera `boundingBox()` delle icone renderizzate (7px e 0px di larghezza invece di 20px) prima di intervenire, non a occhio.

### "Intelligenza artificiale" è ora una scheda a sé in Impostazioni

**Cosa fa:** il consenso all'IA reale (cancello generale + funzione Chat) non vive più dentro la scheda Privacy --- ha ora una sua scheda dedicata, "Intelligenza artificiale", allo stesso livello di Informazioni utente/Sicurezza/Privacy/Categorie. Anche il rimando dalla pagina AI (quando il cancello è spento) punta ora lì. In più, le icone delle schede di Impostazioni sono state ingrandite (18px --- la misura più piccola di tutta l'app --- a 20px, come altrove).

**Note tecniche:** `PrivacyPanel.tsx` tornato alla sua forma precedente (solo il riepilogo "Cosa sa Hinthial di te"); `AIConsentSettings` ora renderizzato da un nuovo caso `"ai"` in `SettingsTabs.tsx`. `ai-processing-consent.spec.ts` aggiornato di conseguenza.

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
