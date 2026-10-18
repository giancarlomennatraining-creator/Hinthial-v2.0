"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { useSearchParams } from "next/navigation";

interface LoginSplashValue {
  /** Il benvenuto dopo il login (v. LoginSplash) è ancora sullo schermo: nient'altro deve comparire sopra di lui. */
  active: boolean;
  /** Il benvenuto è finito (barra piena e dissolvenza compiuta): ora può comparire il resto. */
  finish: () => void;
}

const LoginSplashContext = createContext<LoginSplashValue>({ active: false, finish: () => {} });

/**
 * Lo stato "il benvenuto dopo il login è in corso", condiviso da chi, altrimenti, comparirebbe nello stesso momento: la
 * finestra di sblocco della cassaforte (v. DashboardPanel) e il popup "Crea la tua master key" (v. MasterKeyIntroModal).
 * Prima partivano insieme al logo, che si riempiva sotto una finestra già aperta; ora aspettano che il logo abbia finito.
 *
 * Il valore iniziale viene dal "?justLoggedIn=1" che il redirect dopo il login mette nell'indirizzo (v. lib/auth/actions.ts):
 * si legge una volta sola al montaggio della shell, e DashboardPanel lo toglie subito dall'indirizzo. Senza il parametro
 * (una visita normale, o i test e2e con DISABLE_LOGIN_SPLASH) non c'è benvenuto e non si aspetta nulla.
 */
export function LoginSplashProvider({ children }: { children: ReactNode }) {
  const searchParams = useSearchParams();
  const [active, setActive] = useState(() => searchParams.get("justLoggedIn") === "1");
  const finish = useCallback(() => setActive(false), []);
  const value = useMemo(() => ({ active, finish }), [active, finish]);
  return <LoginSplashContext.Provider value={value}>{children}</LoginSplashContext.Provider>;
}

export function useLoginSplash(): LoginSplashValue {
  return useContext(LoginSplashContext);
}
