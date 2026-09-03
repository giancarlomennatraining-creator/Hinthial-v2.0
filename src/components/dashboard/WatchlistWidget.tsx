import { SourceList } from "@/components/ai/SuggestionsList";
import type { AIContext, AISource, AISuggestion } from "@/domain/ai/types";

/**
 * "Da tenere d'occhio" --- fonde in un'unica sezione i suggerimenti
 * proattivi (v. domain/ai/mock-provider.ts, suggest(): scadenze scadute/
 * in arrivo) e la salute del vault (asset/contatti/documenti non ancora
 * collegati a nient'altro): sono la stessa cosa vista da due angoli ---
 * "agisci per tempo" e "completa i collegamenti" --- e nella dashboard
 * finivano per apparire come due card quasi identiche una sopra
 * l'altra. Altrove (Assistente AI) restano due componenti distinti
 * (v. SuggestionsList/VaultHealthWidget) --- qui è solo la dashboard a
 * presentarli insieme.
 *
 * suggest() include già un asset senza documenti collegati come
 * suggerimento a sé (stessa identica lista di assetsWithoutDocuments qui
 * sotto): la riga "salute del vault" per gli asset compare quindi solo
 * nel caso positivo ("tutti collegati") --- nel caso negativo mostrarla
 * duplicherebbe lo stesso asset due volte nella stessa card. Contatti/
 * documenti non hanno un equivalente in suggest(), quindi restano
 * sempre mostrati in entrambi i casi.
 */
export function WatchlistWidget({
  context,
  suggestions,
}: {
  context: AIContext;
  suggestions: AISuggestion[];
}) {
  const { assets, documents, contacts, capsules } = context;

  const assetsWithoutDocuments = assets.filter(
    (asset) => !documents.some((doc) => doc.relatedAssetId === asset.id),
  );
  // Un contatto revocato non è più qualcuno a cui collegare capsule.
  const activeContacts = contacts.filter((c) => c.status !== "revoked");
  const contactsWithoutCapsules = activeContacts.filter(
    (contact) =>
      !capsules.some((capsule) => capsule.relatedContacts.some((rc) => rc.id === contact.id)),
  );
  const documentsWithExpiry = documents.filter((d) => d.expiresAt !== null).length;

  const contactSources: AISource[] = contactsWithoutCapsules.map((c) => ({
    kind: "contact",
    id: c.id,
    label: c.name,
    href: "/contacts",
  }));

  const hasVaultHealthContent = assets.length > 0 || activeContacts.length > 0 || documents.length > 0;

  if (suggestions.length === 0 && !hasVaultHealthContent) return null;

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
      <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Da tenere d&apos;occhio</p>

      <div className="flex flex-col gap-3">
        {suggestions.map((suggestion, i) => (
          <div key={i} className="text-sm text-zinc-700 dark:text-zinc-300">
            {suggestion.text}
            <SourceList sources={suggestion.sources} />
          </div>
        ))}

        {assets.length > 0 && assetsWithoutDocuments.length === 0 ? (
          <p className="text-sm text-zinc-700 dark:text-zinc-300">
            Tutti i {assets.length} asset hanno almeno un contenuto collegato.
          </p>
        ) : null}

        {activeContacts.length > 0 ? (
          <div className="text-sm text-zinc-700 dark:text-zinc-300">
            {contactsWithoutCapsules.length === 0
              ? `Tutti i ${activeContacts.length} contatti fiduciari sono collegati ad almeno una capsula.`
              : `${contactsWithoutCapsules.length} di ${activeContacts.length} contatti fiduciari non sono ancora collegati a nessuna capsula.`}
            <SourceList sources={contactSources} />
          </div>
        ) : null}

        {documents.length > 0 ? (
          <p className="text-sm text-zinc-700 dark:text-zinc-300">
            {documentsWithExpiry} di {documents.length}{" "}
            {documents.length === 1 ? "contenuto ha" : "contenuti hanno"} una scadenza tracciata.
          </p>
        ) : null}
      </div>
    </div>
  );
}
