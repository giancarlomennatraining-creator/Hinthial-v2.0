"use client";

import { useMasterKey } from "@/components/crypto/MasterKeyProvider";
import { RequireMasterKey } from "@/components/crypto/RequireMasterKey";
import { useUnlockPrompt } from "@/components/crypto/UnlockPromptProvider";
import { LegacyAssets } from "@/components/legacy/LegacyAssets";
import { LegacyCapsules } from "@/components/legacy/LegacyCapsules";
import { LegacyGuardians } from "@/components/legacy/LegacyGuardians";
import { LegacyOverview } from "@/components/legacy/LegacyOverview";
import { LegacyWaiting, useLegacySettings } from "@/components/legacy/LegacyWaiting";
import { PageHelp } from "@/components/help/PageHelp";

/**
 * "Eredità digitale": la promessa per intero, in quattro blocchi, preceduti da un riepilogo (accesa o spenta, a che livello).
 * Quanto aspettare (l'unica scelta: il livello di prudenza), chi conferma la tua assenza (i guardiani), cosa arriverà (le capsule che si aprono anche prima della loro
 * data) e cosa succede a ogni bene. La scheda d'emergenza non sta qui (serve adesso, non dopo): è in Impostazioni -> Profilo. "Quanto aspettare" non cifra nulla e si legge subito; gli altri
 * mostrano nomi e titoli cifrati e chiedono la master key: con la cassaforte bloccata c'è un solo riquadro per sbloccarla, in
 * cima (dove poi compaiono i guardiani) --- in fondo, sotto "Salva", non lo si vedeva prima di aver già toccato il resto.
 */
export function LegacyPage({
  userId,
}: {
  userId: string;
}) {
  const { status } = useMasterKey();
  const { settling } = useUnlockPrompt();
  // Appena sbloccato la finestra si sta ancora dissolvendo: i blocchi cifrati compaiono dopo, non durante.
  const masterKey = status.kind === "unlocked" && !settling ? status.masterKey : null;
  const legacy = useLegacySettings(userId);

  return (
    <div className="@container flex flex-col gap-8 pb-[calc(3rem+env(safe-area-inset-bottom))] sm:pb-0">
      <div className="flex items-start justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight text-title">Eredità digitale</h1>
        <PageHelp
          title="Eredità digitale"
          tips={[
            { icon: "🛡️", text: "I guardiani sono le persone a cui chiedo se riescono a raggiungerti. Non ereditano nulla." },
            { icon: "⏳", text: "Scegli quanto aspettare: Prudente, Normale o Rilassato. Un tuo accesso annulla tutto, in qualunque fase." },
            { icon: "💌", text: "Alla consegna si aprono solo le capsule che hai destinato a questo momento." },
            { icon: "🏠", text: "Per ogni bene puoi scrivere cosa succede se non ci sei più. La nota è cifrata e la vedi solo tu." },
          ]}
        />
      </div>

      <LegacyOverview userId={userId} legacy={legacy} showIndex={masterKey !== null} />

      {masterKey ? null : <RequireMasterKey inline>{() => null}</RequireMasterKey>}

      <div className="flex flex-col">
        <LegacyWaiting userId={userId} legacy={legacy} />

        {masterKey ? (
          <>
            <LegacyGuardians masterKey={masterKey} />
            <LegacyCapsules masterKey={masterKey} />
            <LegacyAssets masterKey={masterKey} />
          </>
        ) : null}
      </div>
    </div>
  );
}
