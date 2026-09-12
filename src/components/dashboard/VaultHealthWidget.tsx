import { SourceList } from "@/components/ai/SuggestionsList";
import type { AIContext, AISource } from "@/domain/ai/types";

/**
 * "Cruscotto di igiene del vault": qualche numero non giudicante su
 * quanto le relazioni che Hinthial modella (beni<->documenti,
 * amico<->capsula) sono effettivamente collegate --- calcolato dal
 * vivo dall'AIContext già decifrato per l'Assistente AI/la dashboard,
 * nessuna nuova query.
 */
export function VaultHealthWidget({ context }: { context: AIContext }) {
  const { assets, documents, friends, capsules } = context;

  const assetsWithoutDocuments = assets.filter(
    (asset) => !documents.some((doc) => doc.relatedAssetId === asset.id),
  );

  // Un amico revocato non è più qualcuno a cui collegare capsule --- non
  // ha senso segnalarlo come "da collegare".
  const activeFriends = friends.filter((c) => c.status !== "revoked");
  const friendsWithoutCapsules = activeFriends.filter(
    (friend) => !capsules.some((capsule) => capsule.relatedFriends.some((rc) => rc.id === friend.id)),
  );

  const documentsWithExpiry = documents.filter((d) => d.expiresAt !== null).length;

  if (assets.length === 0 && activeFriends.length === 0 && documents.length === 0) {
    return null;
  }

  const assetSources: AISource[] = assetsWithoutDocuments.map((a) => ({
    kind: "asset",
    id: a.id,
    label: a.name,
    href: "/assets",
  }));
  const friendSources: AISource[] = friendsWithoutCapsules.map((c) => ({
    kind: "friend",
    id: c.id,
    label: c.name,
    href: "/friends",
  }));

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-zinc-200 bg-white shadow-[0_8px_20px_rgba(16,24,40,0.04)] p-4 dark:border-zinc-800 dark:bg-zinc-950">
      <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Salute del vault</p>

      <div className="flex flex-col gap-3">
        {assets.length > 0 ? (
          <div className="text-sm text-zinc-700 dark:text-zinc-300">
            {assetsWithoutDocuments.length === 0
              ? `Tutti i ${assets.length} beni hanno almeno un contenuto collegato.`
              : `${assetsWithoutDocuments.length} di ${assets.length} beni non hanno ancora contenuti collegati.`}
            <SourceList sources={assetSources} />
          </div>
        ) : null}

        {activeFriends.length > 0 ? (
          <div className="text-sm text-zinc-700 dark:text-zinc-300">
            {friendsWithoutCapsules.length === 0
              ? `Tutti i ${activeFriends.length} amici sono collegati ad almeno una capsula.`
              : `${friendsWithoutCapsules.length} di ${activeFriends.length} amici non sono ancora collegati a nessuna capsula.`}
            <SourceList sources={friendSources} />
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
