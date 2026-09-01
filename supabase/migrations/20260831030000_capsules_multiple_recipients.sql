-- Modifica: una capsula può avere più di un contatto fiduciario come
-- destinatario. La singola colonna in chiaro related_contact_id viene
-- sostituita da un elenco di id dentro encrypted_payload (stesso
-- pattern già usato per linkedDocumentIds) --- oltre a permettere più
-- destinatari, questo nasconde anche a chi ha accesso al database quale
-- contatto è collegato a quale capsula, coerente con l'impostazione
-- zero-knowledge del resto dell'app.
--
-- Nessun backfill: progetto in sviluppo, mai dati reali (v. README).

alter table public.capsules drop column related_contact_id;
