"use client";

import { RequireMasterKey } from "@/components/crypto/RequireMasterKey";
import { DigitalLegacyPanel } from "@/components/legacy/DigitalLegacyPanel";
import { EmergencyCardPanel } from "@/components/legacy/EmergencyCardPanel";
import { PageHelp } from "@/components/help/PageHelp";

/**
 * "Eredità digitale": cosa succede a ciò che hai messo in Hinthial se un giorno non ci sei, e la scheda con le
 * informazioni utili in un'emergenza. Prima stava nelle Impostazioni: è una parte centrale di Hinthial, non una preferenza.
 * La prima parte non richiede la master key (solo parametri); la scheda d'emergenza è cifrata e la chiede.
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
  return (
    <div className="flex flex-col gap-8 pb-[calc(3rem+env(safe-area-inset-bottom))] sm:pb-0">
      <div className="flex items-start justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight text-brand">Eredità digitale</h1>
        <PageHelp
          title="Eredità digitale"
          tips={[
            { icon: "💌", text: "Cosa succede ai tuoi dati se resti inattivo a lungo: lo decidi tu qui." },
            { icon: "🛡️", text: "I guardiani che hai scelto possono confermare la tua assenza." },
            { icon: "🆘", text: "La scheda d'emergenza è una pagina stampabile con le informazioni utili in caso di emergenza." },
            { icon: "🔒", text: "La scheda è cifrata come tutto il resto: richiede la master password sbloccata." },
          ]}
        />
      </div>

      <DigitalLegacyPanel userId={userId} />

      <RequireMasterKey inline>
        {(masterKey) => (
          <EmergencyCardPanel
            masterKey={masterKey}
            userId={userId}
            firstName={firstName}
            lastName={lastName}
            birthDate={birthDate}
          />
        )}
      </RequireMasterKey>
    </div>
  );
}
