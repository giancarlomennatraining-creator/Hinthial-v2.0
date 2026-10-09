"use client";

import { useEffect, type RefObject } from "react";

/**
 * Chiude un menu o un pannello a comparsa con un click fuori dal suo contenitore (`ref`), e con Esc se `escape`. Con
 * `touch` anche al tocco, per i pulsanti che su telefono non generano `mousedown` subito. Ascolta solo finché è
 * `open`. `onDismiss` va tenuta stabile o poco importa: l'ascolto riparte solo se cambia `open`.
 */
export function useDismissOnOutside(
  ref: RefObject<HTMLElement | null>,
  open: boolean,
  onDismiss: () => void,
  { escape = false, touch = false }: { escape?: boolean; touch?: boolean } = {},
) {
  useEffect(() => {
    if (!open) return;
    function handleOutside(event: MouseEvent | TouchEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) onDismiss();
    }
    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape") onDismiss();
    }
    document.addEventListener("mousedown", handleOutside);
    if (touch) document.addEventListener("touchstart", handleOutside);
    if (escape) document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleOutside);
      document.removeEventListener("touchstart", handleOutside);
      document.removeEventListener("keydown", handleKey);
    };
    // onDismiss è quasi sempre un setState: non deve far ripartire l'ascolto a ogni render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, ref, escape, touch]);
}
