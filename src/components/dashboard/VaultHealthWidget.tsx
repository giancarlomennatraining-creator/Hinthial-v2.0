import { SourceList } from "@/components/ai/SuggestionsList";
import type { AIContext, AISource } from "@/domain/ai/types";

/**
 * "Cruscotto di igiene del vault": qualche numero non giudicante su
 * quanto le relazioni che Hinthial modella (asset<->documenti,
 * contatto<->capsula) sono effettivamente collegate --- calcolato dal
 * vivo dall'AIContext già decifrato per l'Assistente AI/la dashboard,
 * nessuna nuova query.
 */
export function VaultHealthWidget({ context }: { context: AIContext }) {
  const { assets, documents, contacts, capsules } = context;

  const assetsWithoutDocuments = assets.filter(
    (asset) => !documents.some((doc) => doc.relatedAssetId === asset.id),
  );

  // Un contatto revocato non è più qualcuno a cui collegare capsule ---
  // non ha senso segnalarlo come "da collegare".
  const activeContacts = contacts.filter((c) => c.status !== "revoked");
  const contactsWithoutCapsules = activeContacts.filter(
    (contact) =>
      !capsules.some((capsule) => capsule.relatedContacts.some((rc) => rc.id === contact.id)),
  );

  const documentsWithExpiry = documents.filter((d) => d.expiresAt !== null).length;

  if (assets.length === 0 && activeContacts.length === 0 && documents.length === 0) {
    return null;
  }

  const assetSources: AISource[] = assetsWithoutDocuments.map((a) => ({
    kind: "asset",
    id: a.id,
    label: a.name,
    href: "/assets",
  }));
  const contactSources: AISource[] = contactsWithoutCapsules.map((c) => ({
    kind: "contact",
    id: c.id,
    label: c.name,
    href: "/contacts",
  }));

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
      <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Salute del vault</p>

      <div className="flex flex-col gap-3">
        {assets.length > 0 ? (
          <div className="text-sm text-zinc-700 dark:text-zinc-300">
            {assetsWithoutDocuments.length === 0
              ? `Tutti i ${assets.length} asset hanno almeno un contenuto collegato.`
              : `${assetsWithoutDocuments.length} di ${assets.length} asset non hanno ancora contenuti collegati.`}
            <SourceList sources={assetSources} />
          </div>
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
