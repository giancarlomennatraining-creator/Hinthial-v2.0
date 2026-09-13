import { UpdatesPanel } from "@/components/updates/UpdatesPanel";

// Contenuto globale, non cifrato (v. domain/product-updates) --- a
// differenza di ogni altra pagina qui sotto (tranne Dashboard), non
// serve la master key sbloccata: nessun RequireMasterKey qui.
export default function UpdatesPage() {
  return <UpdatesPanel />;
}
