# Changelog

Registro di tutto ciò che è stato costruito in HINTHIAL, dalla nascita del progetto ad oggi — pensato come base per scrivere documentazione tecnica e guide utente, non come sostituto di nessuna delle due.

**Come leggere una voce:**
- **Cosa fa** --- in linguaggio semplice: cosa può fare oggi chi usa Hinthial, materiale di partenza per una guida utente.
- **Note tecniche** --- dove rilevante, per chi scriverà la documentazione per sviluppatori (scelte architetturali, compromessi accettati consapevolmente, limiti noti).

**Una precisazione sulle date**: riflettono quando ogni funzionalità è stata *registrata su git* (`git log`), non necessariamente il giorno esatto in cui è stata scritta --- un ampio arretrato di lavoro è stato formalizzato in commit separati il 2026-09-04, pur essendo stato sviluppato nel corso di più sessioni precedenti. Da qui in avanti una nuova voce viene aggiunta in cima ad ogni funzionalità completata.

---

## 2026-09-06

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
