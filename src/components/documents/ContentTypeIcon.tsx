import { DossierIcon } from "@/components/icons/nav-icons";
import { CONTENT_KIND_ICON, type ContentKind } from "@/lib/content-kind";

/**
 * L'icona di un contenuto in elenco, con un piccolo badge nell'angolo quando appartiene a un fascicolo (stessa
 * tecnica del pallino "H" su Avatar.tsx), non una colonna in più in una tabella già in affanno di spazio. Il badge
 * è una cartellina a tratto (DossierIcon), coerente con SVG a tratto per lo stato di sistema (v. nav-icons.tsx), ed
 * è puramente decorativo (`aria-hidden`): l'appartenenza a un fascicolo si legge già dalla scheda del documento.
 */
export function ContentTypeIcon({ kind, inDossier }: { kind: ContentKind; inDossier: boolean }) {
  return (
    <span className="relative inline-flex shrink-0 items-center justify-center">
      <span>{CONTENT_KIND_ICON[kind]}</span>
      {inDossier ? (
        <span
          aria-hidden="true"
          title="In un fascicolo"
          className="absolute -right-1 -bottom-1 flex h-2.5 w-2.5 items-center justify-center rounded-full bg-brand ring-2 ring-white dark:ring-zinc-950"
        >
          <DossierIcon width={7} height={7} strokeWidth={3} className="text-white" />
        </span>
      ) : null}
    </span>
  );
}
