-- "Novità" in Dashboard --- un registro di prodotto rivolto all'utente
-- (v. src/domain/product-updates), ispirato a CHANGELOG.md ma non
-- equivalente: qui solo le modifiche che vale la pena raccontare a chi
-- usa Hinthial, in seconda persona, curate a mano invece che travasate
-- 1:1 da lì. Prima tabella dell'app senza `owner_id`: contenuto uguale
-- per tutti gli utenti, popolato solo da migrazioni come questa --- mai
-- da un'azione dell'interfaccia (nessuna policy di insert/update/delete
-- qui sotto, di proposito).
create table public.product_updates (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text not null,
  published_on date not null,
  created_at timestamptz not null default now()
);

comment on table public.product_updates is 'Registro "Novità" mostrato in Dashboard --- globale, non per-utente. Popolato solo da migrazioni: nessuna policy di scrittura per il client.';

alter table public.product_updates enable row level security;

create policy "product_updates_select_all"
  on public.product_updates for select
  to authenticated
  using (true);

-- Backfill storico, ispirato a CHANGELOG.md ma curato: non ogni voce
-- tecnica lì merita una riga qui (v. discussione con l'utente) --- solo
-- ciò che cambia davvero cosa puoi fare con Hinthial, raccontato in
-- seconda persona.
insert into public.product_updates (title, description, published_on) values
($$Nasce il tuo Archivio protetto$$, $$Il primo mattone di Hinthial: puoi caricare i tuoi documenti sapendo che vengono cifrati con una chiave che solo tu conosci, non condivisa nemmeno con noi. Arrivano anche le prime Scadenze da tenere d'occhio e una recovery key robusta da conservare con cura: è l'unico modo per rientrare nel tuo vault se dimentichi la master password.$$, '2026-08-28'),
($$Beni, Amici, Capsule ed Esporta: le fondamenta$$, $$Un salto importante: nascono i Beni (per censire ciò che possiedi, con documenti e scadenze collegate), gli Amici (i tuoi contatti di fiducia, con uno stato che segui nel tempo), le prime Capsule del tempo (messaggi con titolo, contenuto, allegati e destinatari) e la possibilità di esportare tutti i tuoi dati in un unico archivio.$$, '2026-09-01'),
($$Elenco o tabella, come preferisci$$, $$Ogni sezione principale (Archivio, Beni, Scadenze, Amici, Capsule) si può guardare come elenco o come tabella impaginata, con ricerca e filtro in alto e le azioni raccolte in un menu invece che sparse in pulsanti. La scelta resta impostata su tutti i tuoi dispositivi.$$, '2026-09-04'),
($$Ricerca globale$$, $$Un tasto da tastiera apre una ricerca che trova qualunque cosa nel tuo vault --- documenti, beni, scadenze, amici, capsule --- e ti porta dritto al risultato scelto.$$, '2026-09-04'),
($$Un assistente che risponde sui tuoi contenuti, restando sul tuo dispositivo$$, $$Nella sezione IA puoi fare domande sui tuoi contenuti ("quali assicurazioni ho?", "quando scade la mia assicurazione auto?") e ricevere risposte con le fonti citate, più suggerimenti su scadenze in arrivo o beni senza documenti collegati. Tutto elaborato sul tuo dispositivo: nessun contenuto lascia mai il browser.$$, '2026-09-04'),
($$Cronologia dei tuoi contenuti$$, $$Una vista di sola lettura su beni e documenti aggiunti nel tempo, raggruppati per mese --- utile per ripercorrere cosa hai archiviato e quando.$$, '2026-09-04'),
($$Tema chiaro, scuro o automatico$$, $$In Impostazioni > Aspetto scegli il tema che preferisci, oppure lascia che segua quello del tuo dispositivo --- la scelta resta impostata anche dopo un aggiornamento della pagina.$$, '2026-09-04'),
($$La tua foto profilo$$, $$Puoi caricare una tua immagine come foto profilo, ritagliata a quadrato prima del salvataggio; senza una foto, le tue iniziali su uno sfondo colorato fanno comunque riconoscere il tuo account a colpo d'occhio.$$, '2026-09-04'),
($$Registra audio e video direttamente per le tue Capsule$$, $$Creando una capsula puoi registrare un messaggio audio o video senza uscire dal browser, oltre a caricarne uno già pronto --- e se hai impostato una data di apertura, un conto alla rovescia testuale la accompagna in elenco.$$, '2026-09-04'),
($$Esporta le tue scadenze nel calendario che usi già$$, $$Le scadenze si possono scaricare come file .ics, importabile in qualunque app di calendario --- così le vedi anche fuori da Hinthial.$$, '2026-09-04'),
($$L'Archivio accoglie più tipi di contenuto, e le Capsule diventano autosufficienti$$, $$"Documenti" diventa "Archivio" e accetta anche immagini, audio, video e note scritte direttamente nell'app, tutte con lo stesso player integrato e gli stessi attributi (categoria, bene collegato, scadenza, tag, note). Creare una capsula è ora un percorso guidato in tre passi, e chiuderla ne fa una copia autosufficiente: da quel momento non dipende più dai contenuti originali in Archivio, che restano liberi di essere modificati o cancellati.$$, '2026-09-04'),
($$"Cancella tutto", quando vuoi davvero ripartire da zero$$, $$In Impostazioni > Zona pericolosa puoi svuotare Archivio, Beni, Amici e Capsule con un'unica azione, protetta da una conferma esplicita --- le Scadenze non vengono toccate, restano solo scollegate da ciò che hai cancellato.$$, '2026-09-04'),
($$Autenticazione a due fattori$$, $$In Impostazioni > Sicurezza puoi attivare un secondo fattore con un'app come Google Authenticator o 1Password: dopo email e password, il login chiede anche un codice a 6 cifre. Puoi registrare più dispositivi, ognuno rimovibile singolarmente.$$, '2026-09-07'),
($$Codici di backup per non restare escluso dal tuo account$$, $$Insieme all'autenticazione a due fattori puoi generare 10 codici di backup monouso, da usare se perdi l'accesso al dispositivo con l'app authenticator --- uno vale al posto del codice, e viene consumato subito dopo l'uso.$$, '2026-09-07'),
($$"Cosa sa Hinthial di te"$$, $$Una nuova scheda in Impostazioni > Privacy mette a confronto, con i dati reali e attuali del tuo account, cosa vediamo in chiaro (email, quanti elementi hai per sezione, le categorie che usi) con cosa non vedremo mai (nomi dei file, contenuti, amici, capsule, la tua master password). Pensata per verificare di persona la promessa zero-knowledge, non solo leggerla dichiarata.$$, '2026-09-07'),
($$Il registro di ogni evento sul tuo account$$, $$Una nuova scheda "Attività" mostra login, contenuti aggiunti o eliminati, amici aggiunti, il vault svuotato --- mai nomi di file o di persone, solo il tipo di evento: restano privati anche qui.$$, '2026-09-07'),
($$Kit di recovery da stampare, con QR$$, $$Alla creazione della master password puoi anche stampare un foglio con la tua recovery key in grande e un QR code, pensato per essere conservato fisicamente --- comodo per reinserirla su un dispositivo nuovo senza ricopiare a mano una chiave lunga.$$, '2026-09-07'),
($$Una data di apertura obbligatoria per ogni capsula$$, $$Ogni capsula richiede ora una data di apertura: raggiunta quella data, chi la riceve potrà vederne il contenuto. È il primo passo verso il riconoscimento automatico del momento giusto per aprirla, senza che tu debba fare nulla di persona.$$, '2026-09-07'),
($$Email da Hinthial: inviti, cancellazione, reset$$, $$Quando inviti un amico su Hinthial, parte davvero un'email con un link diretto alla registrazione. In Impostazioni > Zona pericolosa puoi anche cancellare per sempre il tuo account (non solo il vault) o reimpostarlo da zero, sempre con conferma via email e la tua master password richiesta prima di procedere.$$, '2026-09-08'),
($$Il popup che ti guida a creare la tua master key$$, $$Subito dopo il primo accesso, un popup spiega la differenza tra la password del tuo account e la master password, con un tasto che porta dritto alla creazione --- compare una sola volta, poi resta comunque disponibile come voce dell'onboarding.$$, '2026-09-08'),
($$Un onboarding più chiaro, passo per passo$$, $$Il percorso dei primi passi spiega ora ogni voce con una breve descrizione, non solo un'etichetta, e mette per prime le attività più concrete. Puoi nasconderlo dalla barra di navigazione quando vuoi, e ritrovare comunque l'avanzamento in una pagina dedicata di Impostazioni.$$, '2026-09-08'),
($$Il registro eventi si fa interrogabile, e ne sa di più$$, $$In Impostazioni > Attività ora scegli un intervallo di date e una categoria prima di vedere i risultati, con un dettaglio (dispositivo, IP, metodo di accesso) per ogni riga. Registriamo anche i tentativi di accesso falliti e le verifiche a due fattori, per un quadro più completo di cosa succede sul tuo account.$$, '2026-09-08'),
($$Le tue Capsule, scritte come una vera lettera$$, $$La schermata di scrittura di una capsula ha ora l'aspetto di una lettera vera, non di un form con tanti campi --- pensata per aiutarti a scrivere con più calma un messaggio che qualcuno leggerà in futuro.$$, '2026-09-09'),
($$Hinthial si installa come un'app$$, $$Puoi aggiungere Hinthial alla schermata Home del tuo telefono o al menu Start del computer, e aprirlo come un'app a sé, senza passare dal browser ogni volta.$$, '2026-09-09'),
($$Prima fetta di un'IA reale, sempre con il tuo consenso esplicito$$, $$Accanto all'assistente locale arriva la possibilità di usare un'IA reale (Claude) per la Chat --- ma solo se lo attivi tu esplicitamente, in Impostazioni > Intelligenza artificiale: nulla parte da sé.$$, '2026-09-10'),
($$"Asset" diventa "Beni"$$, $$Stesso censimento di ciò che possiedi, solo con un nome più naturale in italiano --- cambia il nome ovunque nell'app, non cosa puoi farci.$$, '2026-09-10'),
($$Scatta una foto direttamente per l'Archivio$$, $$Da smartphone, un tasto "Scatta foto" apre subito la fotocamera per aggiungere un contenuto in Archivio, invece di dover prima salvare la foto e poi cercarla nella galleria.$$, '2026-09-10'),
($$La barra di navigazione ti segue anche su smartphone$$, $$Le voci principali restano sempre raggiungibili in una barra fissa in fondo allo schermo su smartphone; quali mostrare le scegli tu da Impostazioni > Aspetto.$$, '2026-09-10'),
($$"Contatti fiduciari" diventa "Amici", e nasce il Guardiano$$, $$Stesso elenco di persone di fiducia, con un nome più naturale: "Amici". Il vecchio flag "amico" (chi riceve un avviso se resti a lungo inattivo) diventa "Guardiano" --- più chiaro su cosa significa davvero.$$, '2026-09-12'),
($$Hinthial riconosce da solo i tuoi amici già iscritti$$, $$Se un tuo amico si registra su Hinthial con la stessa email che hai salvato per lui, te ne accorgi da un badge "✓ Su Hinthial" --- senza dover controllare o richiedere nulla tu stesso.$$, '2026-09-12'),
($$"Condivise con me" dentro Capsule$$, $$Una nuova scheda in Capsule ti mostra le capsule che altri amici (già collegati a un account Hinthial) hanno condiviso con te: da chi, quando, e quando è prevista l'apertura. Il contenuto arriverà con una fase futura, quando sarà pronto anche lo scambio di chiavi per decifrarlo.$$, '2026-09-12'),
($$Un consenso a due livelli per ogni funzione di IA reale$$, $$Un cancello generale in Impostazioni > Privacy deve essere acceso perché tu possa attivare una qualunque funzione di IA reale --- spegnerlo spegne anche le funzioni già attive, così resti sempre tu a decidere cosa lasciare acceso.$$, '2026-09-12'),
($$La data di apertura di una capsula include ora anche l'ora$$, $$Quando scegli quando una capsula si aprirà, ora indichi anche l'orario, non solo il giorno --- utile se vuoi che si apra proprio in un momento preciso, non genericamente "quel giorno".$$, '2026-09-13'),
($$Il conto alla rovescia diventa un cartellino che scatta davvero$$, $$Il countdown verso l'apertura di una capsula (in elenco, in tabella e nella sua anteprima) è ora un cartellino animato che segna il tempo in giorni, ore, minuti e secondi, aggiornato dal vivo mentre lo guardi. Puoi nasconderlo del tutto da Impostazioni > Aspetto, se preferisci un'interfaccia più essenziale.$$, '2026-09-13');
