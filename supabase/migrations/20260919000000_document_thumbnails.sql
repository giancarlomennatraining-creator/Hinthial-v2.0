-- Miniature delle anteprime.
--
-- Il problema che risolvono è di banda, non di velocità (anche se si
-- sente pure quella): finora aprire la scheda di un contenuto ne
-- riscaricava il file **intero**, perché l'anteprima si costruisce dal
-- contenuto vero. Su una scansione da 15 MB significa 15 MB per ogni
-- apertura --- e il traffico costa circa quattro volte, al gigabyte,
-- quanto costa conservare quello stesso gigabyte per un mese. Un
-- archivio sfogliato spesso costava più in banda che in spazio.
--
-- La miniatura vive come oggetto separato nello stesso bucket cifrato,
-- accanto al documento (`<owner>/<id>-thumb.json`), e non in una colonna
-- qui: l'elenco dell'Archivio legge le righe di questa tabella ad ogni
-- caricamento, e mettercela dentro avrebbe reso caro proprio l'unico
-- percorso che oggi è gratis. Lo spazio su database costa inoltre circa
-- sei volte lo spazio su storage.
--
-- Qui resta solo un booleano: dice se la miniatura esiste, così la
-- scheda sa di poterla chiedere senza tentare un download che potrebbe
-- non esserci. Non rivela niente di nuovo --- che un contenuto sia
-- un'immagine o un PDF il server lo legge già da `mime_type`.

alter table public.documents
  add column has_thumbnail boolean not null default false;
