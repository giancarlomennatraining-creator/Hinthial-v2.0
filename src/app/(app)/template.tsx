import { ViewTransition } from "react";

/**
 * Il cambio di pagina nell'app: una dissolvenza breve del solo contenuto (la barra laterale e quella in basso restano
 * ferme, v. `.page-in` e `.page-out` in globals.css). Un template, non il layout: si ricrea a ogni navigazione, così il
 * contenuto vecchio esce e il nuovo entra. Senza `default="none"` ogni piccolo cambiamento nella pagina si animerebbe.
 */
export default function AppTemplate({ children }: { children: React.ReactNode }) {
  return (
    <ViewTransition enter="page-in" exit="page-out" default="none">
      {children}
    </ViewTransition>
  );
}
