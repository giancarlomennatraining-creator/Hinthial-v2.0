"use client";

import { useMasterKey } from "@/components/crypto/MasterKeyProvider";
import { RequireMasterKey } from "@/components/crypto/RequireMasterKey";
import { useUnlockPrompt } from "@/components/crypto/UnlockPromptProvider";
import { EmergencyCardPanel } from "@/components/legacy/EmergencyCardPanel";
import { LegacyAssets } from "@/components/legacy/LegacyAssets";
import { LegacyCapsules } from "@/components/legacy/LegacyCapsules";
import { LegacyGuardians } from "@/components/legacy/LegacyGuardians";
import { LegacyWaiting } from "@/components/legacy/LegacyWaiting";
import { PageHelp } from "@/components/help/PageHelp";

/**
 * "Eredità digitale": la promessa per intero, in cinque blocchi. Chi conferma la tua assenza (i guardiani), quanto
 * aspettare (l'unica scelta: il livello di prudenza), cosa arriverà (le capsule che si aprono anche prima della loro
 * data), cosa succede a ogni bene e cosa fare in un'emergenza, adesso (la scheda). "Quanto aspettare" non cifra nulla e si legge subito; gli altri
 * mostrano nomi e titoli cifrati e chiedono la master key: con la cassaforte bloccata c'è un solo riquadro per sbloccarla.
 */
export function LegacyPage({
  userId,
  firstName,
  lastName,
  birthDate,
}: {
  userId: string;
  firstName: string;
  lastName: string;
  birthDate: string | null;
}) {
  const { status } = useMasterKey();
  const { settling } = useUnlockPrompt();
  // Appena sbloccato la finestra si sta ancora dissolvendo: i blocchi cifrati compaiono dopo, non durante.
  const masterKey = status.kind === "unlocked" && !settling ? status.masterKey : null;

  return (
    <div className="flex flex-col gap-10 pb-[calc(3rem+env(safe-area-inset-bottom))] sm:pb-0">
      <div className="flex items-start justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight text-brand">Eredità digitale</h1>
        <PageHelp
          title="Eredità digitale"
          tips={[
            { icon: "🛡️", text: "I guardiani sono le persone a cui chiedo se riescono a raggiungerti. Non ereditano nulla." },
            { icon: "⏳", text: "Scegli quanto aspettare: Prudente, Normale o Rilassato. Un tuo accesso annulla tutto, in qualunque fase." },
            { icon: "💌", text: "Alla consegna si aprono solo le capsule che hai destinato a questo momento." },
            { icon: "🏠", text: "Per ogni bene puoi scrivere cosa succede se non ci sei più. La nota è cifrata e la vedi solo tu." },
            { icon: "🆘", text: "La scheda d'emergenza è una pagina stampabile con le informazioni utili in caso di emergenza." },
          ]}
        />
      </div>

      {masterKey ? <LegacyGuardians masterKey={masterKey} /> : null}

      <LegacyWaiting userId={userId} />

      {masterKey ? (
        <>
          <LegacyCapsules masterKey={masterKey} />
          <LegacyAssets masterKey={masterKey} />
          <EmergencyCardPanel
            masterKey={masterKey}
            userId={userId}
            firstName={firstName}
            lastName={lastName}
            birthDate={birthDate}
          />
        </>
      ) : (
        <RequireMasterKey inline>{() => null}</RequireMasterKey>
      )}
    </div>
  );
}
