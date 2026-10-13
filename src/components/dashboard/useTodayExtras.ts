"use client";

import { useEffect, useState } from "react";
import { useSupabase } from "@/lib/db/supabase/use-supabase";
import { listCapsulesSharedWithMe } from "@/domain/capsules/repository";
import { getDigitalLegacySettings } from "@/domain/digital-legacy/repository";
import { getEmergencyCard } from "@/domain/emergency-card/repository";
import { isEmergencyCardEmpty } from "@/domain/emergency-card/types";
import type { SharedCapsuleListItem } from "@/domain/capsules/types";

export interface TodayExtras {
  legacyEnabled: boolean;
  emergencyCardFilled: boolean;
  /** Capsule che altri hanno condiviso con me. */
  sharedWithMe: SharedCapsuleListItem[];
}

/**
 * Quello che "Oggi" mostra oltre al contesto già in pagina (v. useDashboardData): se l'eredità digitale è accesa, se la
 * scheda d'emergenza ha dei dati, le capsule condivise con me. Ogni lettura è indipendente e non blocca le altre: se una
 * fallisce, vale "non fatto"/"nessuna" e la home si vede lo stesso.
 */
export function useTodayExtras(masterKey: CryptoKey): TodayExtras | null {
  const supabase = useSupabase();
  const [extras, setExtras] = useState<TodayExtras | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const userId = user?.id;
      const [legacyEnabled, emergencyCardFilled, sharedWithMe] = await Promise.all([
        userId
          ? getDigitalLegacySettings(supabase, userId).then((s) => s.enabled, () => false)
          : Promise.resolve(false),
        userId
          ? getEmergencyCard(supabase, masterKey, userId).then((card) => !isEmergencyCardEmpty(card), () => false)
          : Promise.resolve(false),
        listCapsulesSharedWithMe(supabase).catch((): SharedCapsuleListItem[] => []),
      ]);
      if (!cancelled) setExtras({ legacyEnabled, emergencyCardFilled, sharedWithMe });
    })();
    return () => {
      cancelled = true;
    };
  }, [supabase, masterKey]);

  return extras;
}
