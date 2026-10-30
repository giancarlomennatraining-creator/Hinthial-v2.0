"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useSupabase } from "@/lib/db/supabase/use-supabase";
import { fetchAccountVisibilitySummary } from "@/domain/privacy/repository";
import type { AccountVisibilitySummary } from "@/domain/privacy/types";
import { ErrorText } from "@/components/ui/ErrorText";
import { LoadingText } from "@/components/ui/LoadingText";
import { PANEL } from "@/components/ui/styles";
import { errorMessage } from "@/lib/utils";

const NEVER_VISIBLE = [
  "Il nome dei tuoi file",
  "Il contenuto dei tuoi documenti, foto, audio e video",
  "Il testo delle tue note",
  "Nome ed email dei tuoi contatti fiduciari",
  "Titolo e contenuto delle tue capsule",
  "La tua master password — non lascia mai il tuo dispositivo",
];

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("it-IT", { day: "numeric", month: "long", year: "numeric" });
}

/**
 * Impostazioni -> Privacy: cosa il server può vedere in chiaro di
 * questo account, messo esplicitamente a confronto con cosa non vedrà
 * mai --- non un testo generico, ma dati reali e attuali di questo
 * account (v. domain/privacy/repository.ts: ogni query legge solo
 * colonne mai cifrate, quindi non serve la master key). Pensata per chi
 * vuole verificare di persona la promessa zero-knowledge prima di
 * fidarsi, non solo leggerla dichiarata.
 */
export function PrivacyPanel({
  userId,
  firstName,
  lastName,
  email,
  birthDate,
}: {
  userId: string;
  firstName: string;
  lastName: string;
  email: string;
  birthDate: string | null;
}) {
  const supabase = useSupabase();
  const [summary, setSummary] = useState<AccountVisibilitySummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setError(null);
    try {
      setSummary(await fetchAccountVisibilitySummary(supabase, userId));
    } catch (err) {
      setError(errorMessage(err, "Impossibile caricare il riepilogo."));
    }
  }, [supabase, userId]);

  useEffect(() => {
    // See DocumentsPanel.tsx for why fetch-on-mount is legitimate here.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refresh();
  }, [refresh]);

  if (error) {
    return (
      <ErrorText>
        {error}
      </ErrorText>
    );
  }

  if (!summary) {
    return <LoadingText />;
  }

  const visibleNow = [
    `La tua email: ${email}`,
    `Nome e cognome: ${firstName} ${lastName}`,
    birthDate ? `Data di nascita: ${formatDate(birthDate)}` : "Data di nascita: non impostata",
    `Account creato il ${formatDate(summary.accountCreatedAt)}`,
    `${summary.documentCount} contenuti in archivio`,
    `${summary.assetCount} ${summary.assetCount === 1 ? "bene" : "beni"}`,
    `${summary.friendCount} amici (${summary.activeFriendCount} attivi, ${summary.guardianCount} guardiani)`,
    `${summary.capsuleCount} capsule (${summary.capsuleStatusCounts.draft} in bozza, ${summary.capsuleStatusCounts.ready} chiuse, ${summary.capsuleStatusCounts.shared} condivise)`,
    `${summary.reminderCount} promemoria/scadenze (${summary.pendingReminderCount} ancora da completare) — solo la data e se è stato completato, non il titolo`,
    `${summary.dossierCount} fascicoli (${summary.dossierStatusCounts.open} aperti, ${summary.dossierStatusCounts.closed} chiusi)`,
    summary.categoryNames.length > 0
      ? `Le tue categorie: ${summary.categoryNames.join(", ")}`
      : "Nessuna categoria configurata",
    "Per ogni contenuto in archivio: a quale categoria, bene e fascicolo è collegato, e la sua scadenza — non il nome del file né cosa contiene",
    summary.onboardingWidgetHidden
      ? "Indicatore del piano nella barra: nascosto"
      : "Indicatore del piano nella barra: visibile",
    "Indirizzo IP e dispositivo/browser di ogni accesso, ed eventuali tentativi di accesso falliti (registrati in Impostazioni > Accesso e sicurezza > Registro delle attività)",
  ];

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm">
        <Link href="/privacy" target="_blank" className="font-medium text-accent hover:underline">
          Leggi l&apos;informativa privacy completa
        </Link>
      </p>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className={`${PANEL} flex flex-col gap-3 p-4`}>
          <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            👁️ Quello che vediamo
          </h3>
          <ul className="flex flex-col gap-2 text-sm text-zinc-600 dark:text-zinc-400">
            {visibleNow.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </div>

        <div className="flex flex-col gap-3 rounded-card border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900">
          <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            🔒 Quello che non vedremo mai
          </h3>
          <ul className="flex flex-col gap-2 text-sm text-zinc-600 dark:text-zinc-400">
            {NEVER_VISIBLE.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
