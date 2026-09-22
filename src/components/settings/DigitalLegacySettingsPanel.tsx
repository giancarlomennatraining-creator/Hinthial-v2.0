"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/db/supabase/client";
import {
  getDigitalLegacySettings,
  updateDigitalLegacySettings,
} from "@/domain/digital-legacy/repository";
import {
  DIGITAL_LEGACY_BOUNDS,
  DIGITAL_LEGACY_PRESET_LABEL,
  DIGITAL_LEGACY_PRESET_ORDER,
  DIGITAL_LEGACY_PRESET_VALUES,
  GUARDIAN_QUORUM_LABEL,
  clampDigitalLegacyField,
  describeDigitalLegacySettings,
  type DigitalLegacyPreset,
  type DigitalLegacySettings,
  type GuardianQuorum,
} from "@/domain/digital-legacy/types";
import { useToast } from "@/components/ui/ToastProvider";
import { DigitalLegacyStatusBanner } from "@/components/digital-legacy/DigitalLegacyStatusBanner";
import { DigitalLegacyRehearsal } from "@/components/digital-legacy/DigitalLegacyRehearsal";
import { RequireMasterKey } from "@/components/crypto/RequireMasterKey";
import { cn } from "@/lib/utils";

const GUARDIAN_QUORUM_ORDER: GuardianQuorum[] = ["unanimous", "majority", "single"];

const NUMERIC_FIELDS: {
  key: "inactivityDays" | "reminderIntervalDays" | "reminderCount" | "gracePeriodDays" | "formalVerificationDays" | "finalWaitDays";
  label: string;
  description: string;
}[] = [
  {
    key: "inactivityDays",
    label: "Soglia di inattività (giorni)",
    description: "Dopo quanti giorni senza accesso iniziamo a scriverti per assicurarci che vada tutto bene.",
  },
  {
    key: "reminderIntervalDays",
    label: "Cadenza dei promemoria (giorni)",
    description: "Ogni quanti giorni ripetiamo il promemoria, se non rispondi.",
  },
  {
    key: "reminderCount",
    label: "Numero di promemoria",
    description: "Quante volte ripetiamo il promemoria prima di passare al periodo di grazia.",
  },
  {
    key: "gracePeriodDays",
    label: "Periodo di grazia (giorni)",
    description: "Quanto tempo resta solo tuo, senza coinvolgere nessun altro, dopo l'ultimo promemoria.",
  },
  {
    key: "formalVerificationDays",
    label: "Verifica formale (giorni)",
    description: "Quanto dura la verifica dopo che i tuoi guardiani confermano di non riuscire a raggiungerti.",
  },
  {
    key: "finalWaitDays",
    label: "Attesa finale (giorni)",
    description: "L'ultima attesa, puramente cautelativa, prima dell'apertura effettiva delle capsule.",
  },
];

/**
 * Impostazioni > Eredità digitale (FASE 12, internamente Dead Man's
 * Switch --- mai questo nome qui, v. richiesta utente). Solo i
 * parametri della strategia: nessuna automazione reale li legge ancora
 * (arriverà in fasi successive). Tre preset (Prudente/Normale/
 * Rilassato) più "Personalizza i valori", che li rende modificabili a
 * mano --- toccarne anche uno solo passa la scelta a "Personalizzato".
 */
export function DigitalLegacySettingsPanel({ userId }: { userId: string }) {
  const [supabase] = useState(() => createClient());
  const showToast = useToast();

  const [settings, setSettings] = useState<DigitalLegacySettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [customOpen, setCustomOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const loaded = await getDigitalLegacySettings(supabase, userId);
        if (cancelled) return;
        setSettings(loaded);
        setCustomOpen(loaded.preset === "custom");
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Impossibile caricare le impostazioni.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [supabase, userId]);

  function selectPreset(preset: Exclude<DigitalLegacyPreset, "custom">) {
    setSettings((prev) => (prev ? { ...prev, preset, ...DIGITAL_LEGACY_PRESET_VALUES[preset] } : prev));
  }

  function updateNumericField(key: (typeof NUMERIC_FIELDS)[number]["key"], raw: string) {
    setSettings((prev) => {
      if (!prev) return prev;
      const parsed = Number.parseInt(raw, 10);
      return { ...prev, preset: "custom", [key]: Number.isFinite(parsed) ? parsed : prev[key] };
    });
  }

  function updateQuorum(quorum: GuardianQuorum) {
    setSettings((prev) => (prev ? { ...prev, preset: "custom", guardianQuorum: quorum } : prev));
  }

  async function handleSave() {
    if (!settings) return;
    setError(null);
    setSaving(true);
    try {
      const clamped: DigitalLegacySettings = {
        ...settings,
        inactivityDays: clampDigitalLegacyField("inactivityDays", settings.inactivityDays),
        reminderIntervalDays: clampDigitalLegacyField("reminderIntervalDays", settings.reminderIntervalDays),
        reminderCount: clampDigitalLegacyField("reminderCount", settings.reminderCount),
        gracePeriodDays: clampDigitalLegacyField("gracePeriodDays", settings.gracePeriodDays),
        formalVerificationDays: clampDigitalLegacyField("formalVerificationDays", settings.formalVerificationDays),
        finalWaitDays: clampDigitalLegacyField("finalWaitDays", settings.finalWaitDays),
      };
      await updateDigitalLegacySettings(supabase, userId, clamped);
      setSettings(clamped);
      showToast("Impostazioni di Eredità digitale salvate.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossibile salvare le impostazioni.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <p className="text-sm text-zinc-500 dark:text-zinc-400">Caricamento…</p>;
  }
  if (!settings) {
    return (
      <p role="alert" className="text-sm text-red-600 dark:text-red-400">
        {error ?? "Impossibile caricare le impostazioni."}
      </p>
    );
  }

  function toggleEnabled() {
    setSettings((prev) => {
      if (!prev) return prev;
      if (
        !prev.enabled &&
        !window.confirm(
          "Attivare Eredità digitale? Da questo momento, se non accedi a Hinthial per il periodo previsto dalla strategia scelta qui sotto, inizierai a ricevere email di verifica.",
        )
      ) {
        return prev;
      }
      return { ...prev, enabled: !prev.enabled };
    });
  }

  return (
    // Niente max-w qui: come nel resto di Impostazioni (v. Aspetto), il
    // contenuto usa tutta la larghezza disponibile --- v. richiesta
    // utente. Solo il testo discorsivo (paragrafi) resta limitato a una
    // lunghezza di riga leggibile con un max-w-2xl sul singolo elemento,
    // non sul contenitore: il resto (interruttore, preset, valori
    // personalizzati) si allarga per davvero, non solo di nome.
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Eredità digitale</h2>
        <p className="mt-1 max-w-2xl text-sm text-zinc-500 dark:text-zinc-400">
          Se un giorno non dovessi più poter accedere a Hinthial, questa è la strategia che
          decide quando le tue capsule arrivano davvero a chi le doveva ricevere --- con più
          promemoria a te prima, e la verifica dei tuoi guardiani dopo, non un&apos;apertura
          improvvisa.
        </p>
      </div>

      <DigitalLegacyStatusBanner userId={userId} reminderCount={settings.reminderCount} />

      <label className="flex max-w-2xl items-center gap-3 rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
        <input
          type="checkbox"
          checked={settings.enabled}
          onChange={toggleEnabled}
          className="h-4 w-4 shrink-0 accent-brand"
        />
        <span className="flex flex-col gap-0.5">
          <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
            Attiva Eredità digitale
          </span>
          <span className="text-xs text-zinc-500 dark:text-zinc-400">
            Finché è spento, nessuna email di verifica viene inviata e nessuna capsula si apre da
            sola, qualunque preset o valore tu scelga qui sotto --- puoi configurare tutto in
            anticipo e accendere l&apos;interruttore solo quando sei pronto.
          </span>
        </span>
      </label>

      <div className={cn("flex flex-col gap-2", settings.enabled ? undefined : "opacity-60")}>
        <div
          role="radiogroup"
          aria-label="Preset di Eredità digitale"
          className="inline-flex flex-col gap-1 rounded-md border border-zinc-300 p-1 dark:border-zinc-700 sm:inline-flex sm:flex-row"
        >
          {DIGITAL_LEGACY_PRESET_ORDER.map((preset) => (
            <button
              key={preset}
              type="button"
              role="radio"
              aria-checked={settings.preset === preset}
              onClick={() => selectPreset(preset)}
              className={cn(
                "rounded px-3 py-1.5 text-sm font-medium transition-colors",
                settings.preset === preset
                  ? "bg-brand text-white"
                  : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-900",
              )}
            >
              {DIGITAL_LEGACY_PRESET_LABEL[preset]}
            </button>
          ))}
        </div>
        {settings.preset === "custom" ? (
          <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
            {DIGITAL_LEGACY_PRESET_LABEL.custom} --- almeno un valore non corrisponde più a nessuno dei tre preset.
          </p>
        ) : null}
      </div>

      <p
        className={cn(
          "max-w-2xl rounded-xl bg-zinc-50 p-4 text-sm text-zinc-600 dark:bg-zinc-900 dark:text-zinc-400",
          settings.enabled ? undefined : "opacity-60",
        )}
      >
        {settings.enabled
          ? describeDigitalLegacySettings(settings)
          : "Il monitoraggio è spento: nessuna email verrà inviata. Ecco comunque cosa succederebbe se lo accendessi con questi valori --- " +
            describeDigitalLegacySettings(settings)}
      </p>

      <div className="flex flex-col gap-4">
        <button
          type="button"
          onClick={() => setCustomOpen((v) => !v)}
          aria-expanded={customOpen}
          className="w-fit text-sm font-medium text-brand hover:underline"
        >
          {customOpen ? "Nascondi i valori" : "Personalizza i valori"}
        </button>

        {customOpen ? (
          // Griglia responsiva, non più una colonna sola --- v. richiesta
          // utente: usa per davvero la larghezza disponibile invece di
          // impilare 7 campi corti uno sotto l'altro con tutto quello
          // spazio vuoto ai lati sugli schermi larghi.
          <div className="grid gap-4 rounded-xl border border-zinc-200 p-4 sm:grid-cols-2 lg:grid-cols-3 dark:border-zinc-800">
            {NUMERIC_FIELDS.map((field) => (
              <div key={field.key} className="flex flex-col gap-1">
                <label
                  htmlFor={`digital-legacy-${field.key}`}
                  className="text-sm font-medium text-zinc-700 dark:text-zinc-300"
                >
                  {field.label}
                </label>
                <input
                  id={`digital-legacy-${field.key}`}
                  type="number"
                  min={DIGITAL_LEGACY_BOUNDS[field.key].min}
                  max={DIGITAL_LEGACY_BOUNDS[field.key].max}
                  value={settings[field.key]}
                  onChange={(e) => updateNumericField(field.key, e.target.value)}
                  className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-950 outline-none focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
                />
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  {field.description} Tra {DIGITAL_LEGACY_BOUNDS[field.key].min} e{" "}
                  {DIGITAL_LEGACY_BOUNDS[field.key].max}.
                </p>
              </div>
            ))}

            <div className="flex flex-col gap-1">
              <label
                htmlFor="digital-legacy-guardian-quorum"
                className="text-sm font-medium text-zinc-700 dark:text-zinc-300"
              >
                Quorum dei guardiani
              </label>
              <select
                id="digital-legacy-guardian-quorum"
                value={settings.guardianQuorum}
                onChange={(e) => updateQuorum(e.target.value as GuardianQuorum)}
                className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-950 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
              >
                {GUARDIAN_QUORUM_ORDER.map((quorum) => (
                  <option key={quorum} value={quorum}>
                    {GUARDIAN_QUORUM_LABEL[quorum]}
                  </option>
                ))}
              </select>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Quanti dei tuoi guardiani devono confermare che non riesci più a essere raggiunto,
                prima di procedere con la verifica formale.
              </p>
            </div>
          </div>
        ) : null}
      </div>

      {error ? (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      ) : null}

      <button
        type="button"
        onClick={handleSave}
        disabled={saving}
        className="w-fit rounded-xl bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-hover disabled:opacity-50"
      >
        {saving ? "Salvataggio…" : "Salva"}
      </button>

      <div className="flex flex-col gap-4 border-t border-zinc-200 pt-10 dark:border-zinc-800">
        <RequireMasterKey>
          {(masterKey) => <DigitalLegacyRehearsal masterKey={masterKey} settings={settings} />}
        </RequireMasterKey>
      </div>
    </div>
  );
}
