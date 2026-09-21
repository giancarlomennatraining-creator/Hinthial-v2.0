import { DossierIcon } from "@/components/icons/nav-icons";
import { CONTENT_KIND_ICON, type ContentKind } from "@/lib/content-kind";

/**
 * FASE 20b --- l'icona di un contenuto in elenco, con --- quando
 * appartiene a un fascicolo --- un piccolo badge nell'angolo. Stessa
 * tecnica già usata per il pallino "H" sull'avatar di chi ha un account
 * Hinthial (v. components/ui/Avatar.tsx): un badge posizionato
 * nell'angolo dell'icona, non una colonna in più nella tabella --- che
 * oggi è già in affanno di spazio su schermi stretti (v. richiesta
 * utente sulle tabelle che sforano).
 *
 * Il badge è una cartellina a tratto (DossierIcon) e non un'altra
 * emoji: coerente con come l'app distingue le due famiglie di
 * icone --- emoji dove è una scelta dell'utente (l'icona di una
 * categoria) o un ornamento nel testo, SVG a tratto dove è
 * un'indicazione di stato del sistema (v. nav-icons.tsx).
 *
 * L'emoji del tipo di contenuto resta dentro il testo del link, come
 * già oggi --- uno screen reader la legge insieme al nome del file
 * (comportamento preesistente, non toccato qui). Il badge invece è
 * puramente decorativo (`aria-hidden`): l'appartenenza a un fascicolo
 * si legge già, in chiaro, dalla scheda del documento --- non serve
 * ripeterla a voce per ogni riga dell'elenco.
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
