import type { OpenOrigin } from "@/components/capsules/opening/types";

/** Il centro e il raggio di un elemento (di solito un oblò) in coordinate della finestra, per far partire un effetto da lì. */
export function originOf(element: Element | null): OpenOrigin | null {
  if (!element) return null;
  const rect = element.getBoundingClientRect();
  if (rect.width === 0 && rect.height === 0) return null;
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2, r: Math.max(8, rect.width * 0.4) };
}

/** True se il sistema chiede di ridurre il movimento: gli effetti saltano allora direttamente alla pagina di lettura. */
export function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}
