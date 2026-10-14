"use client";

import { useEffect, useState } from "react";
import { useSupabase } from "@/lib/db/supabase/use-supabase";
import { getDigitalLegacySettings, updateDigitalLegacySettings } from "@/domain/digital-legacy/repository";
import { legacyPhases } from "@/domain/digital-legacy/phases";
import {
  DIGITAL_LEGACY_PRESET_LABEL,
  DIGITAL_LEGACY_PRESET_ORDER,
  DIGITAL_LEGACY_PRESET_VALUES,
  describeDigitalLegacySettings,
  totalWorstCaseDays,
  type DigitalLegacyPreset,
  type DigitalLegacySettings,
} from "@/domain/digital-legacy/types";
import { useToast } from "@/components/ui/ToastProvider";
import { DigitalLegacyStatusBanner } from "@/components/digital-legacy/DigitalLegacyStatusBanner";
import { DigitalLegacyRehearsal } from "@/components/digital-legacy/DigitalLegacyRehearsal";
import { RequireMasterKey } from "@/components/crypto/RequireMasterKey";
import { cn } from "@/lib/utils";
import { BTN_PRIMARY } from "@/components/ui/styles";

/** Quanto è lungo il tutto, in una parola, per sceglierlo a colpo d'occhio. */
function totalLabel(preset: Exclude<DigitalLegacyPreset, "custom">): string {
  const days = totalWorstCaseDays(DIGITAL_LEGACY_PRESET_VALUES[preset]);
  const months = Math.round(days / 30);
  return months >= 11 ? "circa un anno" : `circa ${months} mesi`;
}

/**
 * "Quanto aspettare": l'unica scelta dell'Eredità digitale. Tre livelli di prudenza (Prudente, Normale, Rilassato) e un
 * interruttore. Sotto, le quattro fasi con i giorni veri del livello scelto (v. domain/digital-legacy/phases.ts). I
 * sei numeri e il quorum non si scelgono più uno a uno: li decide il livello. Chi li aveva personalizzati vede il
 * suo riepilogo finché non ne sceglie uno.
 */
export function LegacyWaiting({ userId }: { userId: string }) {
  const supabase = useSupabase();
  const showToast = useToast();

  const [settings, setSettings] = useState<DigitalLegacySettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [rehearsalOpen, setRehearsalOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const loaded = await getDigitalLegacySettings(supabase, userId);
        if (!cancelled) setSettings(loaded);
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

  function toggleEnabled() {
    setSettings((prev) => {
      if (!prev) return prev;
      if (
        !prev.enabled &&
        !window.confirm(
          "Attivare Eredità digitale? Da questo momento, se non accedi a Hinthial per il periodo previsto dal livello scelto qui sotto, inizierai a ricevere email di verifica.",
        )
      ) {
        return prev;
      }
      return { ...prev, enabled: !prev.enabled };
    });
  }

  async function handleSave() {
    if (!settings) return;
    setError(null);
    setSaving(true);
    try {
      await updateDigitalLegacySettings(supabase, userId, settings);
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

  const phases = legacyPhases(settings);
  const isCustom = settings.preset === "custom";

  return (
    <section aria-labelledby="legacy-waiting-title" className="flex flex-col gap-5">
      <div>
        <h2 id="legacy-waiting-title" className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
          Quanto aspettare
        </h2>
        <p className="mt-1 max-w-2xl text-sm text-zinc-500 dark:text-zinc-400">
          Se un giorno non dovessi più poter accedere a Hinthial, questo decide quanto tempo passa prima che le tue capsule
          arrivino a chi le doveva ricevere: prima ti scrivo io, poi chiedo ai tuoi guardiani, poi un&apos;ultima attesa.
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
          <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">Attiva Eredità digitale</span>
          <span className="text-xs text-zinc-500 dark:text-zinc-400">
            Finché è spento, nessuna email di verifica viene inviata e nessuna capsula si apre da sola. Puoi preparare tutto
            e accenderlo solo quando sei pronto.
          </span>
        </span>
      </label>

      <div className={cn("flex flex-col gap-3", settings.enabled ? undefined : "opacity-60")}>
        <div role="radiogroup" aria-label="Livello di prudenza" className="grid gap-2 sm:grid-cols-3">
          {DIGITAL_LEGACY_PRESET_ORDER.map((preset) => {
            const selected = settings.preset === preset;
            return (
              <button
                key={preset}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => selectPreset(preset)}
                className={cn(
                  "flex flex-col items-start gap-0.5 rounded-xl border px-4 py-3 text-left transition-colors",
                  selected
                    ? "border-brand bg-brand/10 text-brand"
                    : "border-zinc-200 text-zinc-700 hover:bg-zinc-50 dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-900",
                )}
              >
                <span className="text-sm font-semibold">{DIGITAL_LEGACY_PRESET_LABEL[preset]}</span>
                <span className="text-xs opacity-80">{totalLabel(preset)}</span>
              </button>
            );
          })}
        </div>
        {isCustom ? (
          <p className="max-w-2xl text-xs font-medium text-orange-700 dark:text-orange-400">
            I tuoi valori erano personalizzati, e non corrispondono a nessuno dei tre livelli. Scegline uno per semplificare:
            finché non lo fai restano quelli di prima.
          </p>
        ) : null}
      </div>

      <ol aria-label="Le quattro fasi" className="grid gap-3 sm:grid-cols-2">
        {phases.map((phase, index) => (
          <li key={phase.id} className="flex flex-col gap-1 rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
            <span className="flex items-baseline justify-between gap-2">
              <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                {index + 1}. {phase.name}
              </span>
            </span>
            <span className="text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">{phase.text}</span>
          </li>
        ))}
      </ol>

      <p
        className={cn(
          "max-w-2xl rounded-xl bg-zinc-50 p-4 text-sm text-zinc-600 dark:bg-zinc-900 dark:text-zinc-400",
          settings.enabled ? undefined : "opacity-60",
        )}
      >
        {settings.enabled
          ? describeDigitalLegacySettings(settings)
          : "Il monitoraggio è spento: nessuna email verrà inviata. Ecco comunque cosa succederebbe se lo accendessi così: " +
            describeDigitalLegacySettings(settings)}
      </p>

      {error ? (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-4">
        <button type="button" onClick={handleSave} disabled={saving} className={`${BTN_PRIMARY} disabled:opacity-50`}>
          {saving ? "Salvataggio…" : "Salva"}
        </button>
        <button
          type="button"
          onClick={() => setRehearsalOpen((v) => !v)}
          aria-expanded={rehearsalOpen}
          className="text-sm font-medium text-brand hover:underline"
        >
          {rehearsalOpen ? "Nascondi la prova generale" : "Vedi cosa succederebbe se cominciasse oggi"}
        </button>
      </div>

      {rehearsalOpen ? (
        <div className="flex flex-col gap-4 border-t border-zinc-200 pt-6 dark:border-zinc-800">
          <RequireMasterKey inline>
            {(masterKey) => <DigitalLegacyRehearsal masterKey={masterKey} settings={settings} />}
          </RequireMasterKey>
        </div>
      ) : null}
    </section>
  );
}
