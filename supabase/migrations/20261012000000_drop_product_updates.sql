-- La sezione "Novità" della Dashboard è stata rimossa (v. CHANGELOG): la tabella `product_updates` non è più letta
-- da nessun punto dell'app. Contiene solo testi di prodotto curati a mano, nessun dato dell'utente.
drop table if exists public.product_updates;
