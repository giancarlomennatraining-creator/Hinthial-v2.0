"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/db/supabase/client";
import { fetchAccountVisibilitySummary } from "@/domain/privacy/repository";
import { NAV_ORIENTATION_LABEL } from "@/lib/nav-orientation";
import type { AccountVisibilitySummary } from "@/domain/privacy/types";

const NEVER_VISIBLE = [
  "Il nome dei tuoi file",
  "Il contenuto dei tuoi documenti, foto, audio e video",
  "Il testo delle tue note e delle trascrizioni",
  "Nome ed email dei tuoi contatti fiduciari",
  "Titolo e contenuto delle tue capsule",
  "La tua master password --- non lascia mai il tuo dispositivo",
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
  const supabase = useRef(createClient()).current;
  const [summary, setSummary] = useState<AccountVisibilitySummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setError(null);
    try {
      setSummary(await fetchAccountVisibilitySummary(supabase, userId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossibile caricare il riepilogo.");
    }
  }, [supabase, userId]);

  useEffect(() => {
    // See DocumentsPanel.tsx for why fetch-on-mount is legitimate here.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refresh();
  }, [refresh]);

  if (error) {
    return (
      <p role="alert" className="text-sm text-red-600 dark:text-red-400">
        {error}
      </p>
    );
  }

  if (!summary) {
    return <p className="text-sm text-zinc-500 dark:text-zinc-400">Caricamento…</p>;
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
    `${summary.reminderCount} promemoria/scadenze (${summary.pendingReminderCount} ancora da completare) --- solo la data e se è stato completato, non il titolo`,
    `${summary.dossierCount} fascicoli (${summary.dossierStatusCounts.open} aperti, ${summary.dossierStatusCounts.closed} chiusi)`,
    summary.categoryNames.length > 0
      ? `Le tue categorie: ${summary.categoryNames.join(", ")}`
      : "Nessuna categoria configurata",
    "Per ogni contenuto in archivio: a quale categoria, bene e fascicolo è collegato, e la sua scadenza --- non il nome del file né cosa contiene",
    `Disposizione del menu: ${NAV_ORIENTATION_LABEL[summary.navOrientation]}`,
    summary.onboardingWidgetHidden
      ? "Indicatore di onboarding nella barra: nascosto"
      : "Indicatore di onboarding nella barra: visibile",
    "Indirizzo IP e dispositivo/browser di ogni accesso, ed eventuali tentativi di accesso falliti (registrati in Impostazioni > Attività)",
  ];

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
          Cosa sa Hinthial di te
        </h2>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Non una dichiarazione generica: questi sono i dati reali e attuali del tuo account. Il
          resto --- il contenuto vero e proprio di ciò che ci affidi --- resta cifrato sul tuo
          dispositivo prima ancora di lasciarlo.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="flex flex-col gap-3 rounded-2xl border border-zinc-200 bg-white shadow-[0_8px_20px_rgba(16,24,40,0.04)] p-4 dark:border-zinc-800 dark:bg-zinc-950">
          <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            👁️ Quello che vediamo
          </h3>
          <ul className="flex flex-col gap-2 text-sm text-zinc-600 dark:text-zinc-400">
            {visibleNow.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </div>

        <div className="flex flex-col gap-3 rounded-2xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900">
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
