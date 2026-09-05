"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { createClient } from "@/lib/db/supabase/client";
import { updateNavOrientation } from "@/domain/profile/repository";
import type { NavOrientation } from "@/lib/nav-orientation";

interface NavOrientationContextValue {
  orientation: NavOrientation;
  setOrientation: (next: NavOrientation) => Promise<void>;
}

const NavOrientationContext = createContext<NavOrientationContextValue | null>(null);

/**
 * Disposizione del menu di navigazione (verticale a sinistra/destra, o
 * orizzontale in alto) --- sincronizzata sul server
 * (profiles.nav_orientation), come la visualizzazione delle liste (v.
 * ListViewPreferencesProvider), così resta la stessa su tutti i
 * dispositivi dell'utente. A differenza di quella, qui il valore
 * iniziale arriva già letto lato server (v. AppLayout/getCurrentUser):
 * decide il layout dell'intera shell, quindi va noto prima del primo
 * render per evitare un lampo del layout sbagliato.
 */
export function NavOrientationProvider({
  userId,
  initialOrientation,
  children,
}: {
  userId: string;
  initialOrientation: NavOrientation;
  children: React.ReactNode;
}) {
  const [orientation, setOrientationState] = useState<NavOrientation>(initialOrientation);

  const setOrientation = useCallback(
    async (next: NavOrientation) => {
      const previous = orientation;
      setOrientationState(next); // optimistic: il layout cambia subito

      try {
        const supabase = createClient();
        await updateNavOrientation(supabase, userId, next);
      } catch (err) {
        setOrientationState(previous); // il server non ha salvato: si torna indietro
        throw err;
      }
    },
    [orientation, userId],
  );

  const value = useMemo<NavOrientationContextValue>(
    () => ({ orientation, setOrientation }),
    [orientation, setOrientation],
  );

  return <NavOrientationContext.Provider value={value}>{children}</NavOrientationContext.Provider>;
}

export function useNavOrientation(): NavOrientationContextValue {
  const ctx = useContext(NavOrientationContext);
  if (!ctx) {
    throw new Error("useNavOrientation must be used within a NavOrientationProvider");
  }
  return ctx;
}
