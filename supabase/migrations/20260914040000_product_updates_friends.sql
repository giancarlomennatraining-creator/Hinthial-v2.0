-- Due nuove voci in "Novità" per le funzionalità appena chiuse in
-- questa stessa sessione (v. CHANGELOG.md, 2026-09-13) --- lo stesso
-- impegno di manutenzione già preso con la tabella (v. migrazione
-- 20260914020000_product_updates.sql): ogni funzionalità che vale la
-- pena raccontare porta anche una riga qui.
insert into public.product_updates (title, description, published_on) values
($$"Nome" negli Amici diventa "Nome visualizzato", con Nome e Cognome a parte$$, $$Il campo che finora si chiamava "Nome" ora si chiama "Nome visualizzato" --- fa la stessa cosa di sempre, solo con un nome più chiaro. Puoi anche compilare Nome e Cognome separatamente: il nome visualizzato si aggiorna da solo come "Nome Cognome" finché non lo modifichi tu direttamente, poi resta quello che hai scelto.$$, '2026-09-13'),
($$La foto dei tuoi amici, anche quando sono già su Hinthial$$, $$Ogni amico può avere una foto: la carichi tu (con lo stesso ritaglio della tua foto profilo, scattandola sul momento o scegliendone una già pronta) oppure, se quell'amico è già un account Hinthial collegato, vedi automaticamente la sua foto vera. Senza nessuna delle due, le sue iniziali su uno sfondo colorato.$$, '2026-09-13');
