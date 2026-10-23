"use client";

import { DIGITAL_LEGACY_PRESET_LABEL } from "@/domain/digital-legacy/types";
import type { LegacySettingsState } from "@/components/legacy/LegacyWaiting";
import { DigitalLegacyStatusBanner } from "@/components/digital-legacy/DigitalLegacyStatusBanner";
import { cn } from "@/lib/utils";
import { PANEL_FLAT } from "@/components/ui/styles";

/** I blocchi della pagina, nell'ordine in cui compaiono: i primi due non cifrano nulla, gli altri chiedono la master key. */
const SECTIONS = [
  { id: "waiting", label: "Quanto aspettare" },
  { id: "guardians", label: "Guardiani" },
  { id: "capsules", label: "Cosa arriverà" },
  { id: "assets", label: "I tuoi beni" },
];

/**
 * La prima cosa che si vede di Eredità digitale: è accesa o spenta, a che livello, e cosa succederebbe. Prima l'interruttore
 * stava a metà pagina, sotto i guardiani, e non c'era modo di capire a colpo d'occhio in che stato si era. Sotto, un
 * indice dei blocchi, per saltare a quello che serve (solo quando ci sono: con la cassaforte bloccata ne esiste uno).
 */
export function LegacyOverview({ userId, legacy, showIndex }: { userId: string; legacy: LegacySettingsState; showIndex: boolean }) {
  const { settings, loading } = legacy;
  if (loading || !settings) return null;
  const on = settings.enabled;

  return (
    <div className="flex flex-col gap-4">
      {/* Se una verifica è in corso, è la cosa più importante della pagina: sta subito sotto il titolo, non in fondo a un blocco. */}
      <DigitalLegacyStatusBanner userId={userId} reminderCount={settings.reminderCount} />
      <section
        aria-label="Stato di Eredità digitale"
        className={`${PANEL_FLAT} flex flex-col gap-4 p-5`}
      >
        <div className="flex flex-wrap items-start gap-x-4 gap-y-2">
          <span
            className={cn(
              "inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1 text-sm font-semibold",
              on ? "bg-brand/10 text-accent" : "bg-zinc-100 text-zinc-600 dark:bg-zinc-900 dark:text-zinc-400",
            )}
          >
            <span aria-hidden="true" className={cn("h-2 w-2 rounded-full", on ? "bg-brand" : "bg-zinc-400")} />
            {on ? "Accesa" : "Spenta"}
          </span>
          <p className="min-w-0 flex-1 basis-72 text-sm text-zinc-600 dark:text-zinc-400">
            {on
              ? `Livello ${DIGITAL_LEGACY_PRESET_LABEL[settings.preset]}. Se smetti di accedere, prima ti scrivo io, poi chiedo ai tuoi guardiani, poi consegno le capsule che hai scelto. Un tuo accesso annulla tutto, in qualunque fase.`
              : "Nessuna email parte e nessuna capsula si apre da sola. Prepara tutto qui sotto e accendila quando sei pronto."}
          </p>
        </div>

        {showIndex ? (
          <nav aria-label="Sezioni della pagina" className="flex flex-wrap gap-2">
            {SECTIONS.map((s) => (
              <a
                key={s.id}
                href={`#settings-block-${s.id}`}
                className="rounded-full border border-zinc-200 px-3 py-1 text-sm font-medium text-accent hover:bg-brand/10 dark:border-zinc-800"
              >
                {s.label}
              </a>
            ))}
          </nav>
        ) : null}
      </section>
    </div>
  );
}
