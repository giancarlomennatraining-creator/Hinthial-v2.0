"use client";

import { useId } from "react";
import type { CapsuleListItem } from "@/domain/capsules/types";

/**
 * La capsula del tempo disegnata (SVG): un cilindro con flange, bulloni, targhetta e coperchio, e una fascia colorata che dice
 * lo stato (rossa sigillata, verde apribile, grigia bozza). Due versioni dello stesso disegno: "flat" (colori tenui, per la
 * scheda Flat) e "steel" (acciaio, per l'oblò e per le aperture). Il coperchio è il gruppo `.cap-lid`, così le animazioni di
 * apertura lo possono far scivolare via.
 */

export type CapsuleArtState = "sealed" | "ready" | "draft";
export type CapsuleArtVariant = "flat" | "steel";

const BAND: Record<CapsuleArtState, string> = { sealed: "#D6403F", ready: "#2FD27E", draft: "#9AA4B8" };

/** Lo stato disegnato: una bozza è grigia; una capsula chiusa o condivisa con la data già arrivata è apribile, altrimenti sigillata. */
export function capsuleArtState(capsule: Pick<CapsuleListItem, "status" | "openAt">, now: Date): CapsuleArtState {
  if (capsule.status === "draft") return "draft";
  return capsule.openAt !== null && new Date(capsule.openAt) <= now ? "ready" : "sealed";
}

export function CapsuleArt({
  variant,
  state,
  className,
  plate,
}: {
  variant: CapsuleArtVariant;
  state: CapsuleArtState;
  className?: string;
  /** Testo corto inciso sulla targhetta (es. l'anno), solo nella versione grande. */
  plate?: string;
}) {
  const uid = useId().replace(/:/g, "");
  const band = BAND[state];

  if (variant === "flat") {
    return (
      <svg viewBox="0 0 200 80" aria-hidden="true" className={className} overflow="visible">
        <g>
          <rect x="14" y="12" width="150" height="56" rx="10" fill="#E4ECFB" />
          <path d="M14 44h150v14a10 10 0 0 1-10 10H24a10 10 0 0 1-10-10z" fill="#C9D7F2" />
          <rect x="28" y="17" width="96" height="4" rx="2" fill="#fff" opacity=".8" />
          <rect x="8" y="6" width="14" height="68" rx="5" fill="#8FA8DE" />
          <circle cx="15" cy="16" r="1.8" fill="#6F89C8" />
          <circle cx="15" cy="64" r="1.8" fill="#6F89C8" />
          <rect x="66" y="8" width="8" height="64" rx="3" fill="#B4C5EA" />
          <rect x="116" y="8" width="13" height="64" rx="3" fill={band} />
          <rect x="116" y="8" width="13" height="8" rx="3" fill="#fff" opacity=".28" />
          <rect x="82" y="25" width="28" height="30" rx="3" fill="#F6D77A" />
          <rect x="87" y="32" width="18" height="2.5" rx="1" fill="#8a6a1f" opacity=".7" />
          <rect x="87" y="38" width="13" height="2.5" rx="1" fill="#8a6a1f" opacity=".5" />
          <rect x="87" y="44" width="16" height="2.5" rx="1" fill="#8a6a1f" opacity=".4" />
        </g>
        <g className="cap-lid">
          <rect x="152" y="5" width="16" height="70" rx="5" fill="#8FA8DE" />
          <path d="M168 14 Q192 40 168 66 Z" fill="#C9D7F2" />
          <ellipse cx="184" cy="40" rx="2.6" ry="9" fill="none" stroke="#6F89C8" strokeWidth="2" />
        </g>
      </svg>
    );
  }

  const body = `${uid}b`;
  const flange = `${uid}f`;
  const brass = `${uid}p`;
  return (
    <svg viewBox="0 0 252 92" aria-hidden="true" className={className} overflow="visible">
      <defs>
        <linearGradient id={body} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#8e9ab0" />
          <stop offset=".26" stopColor="#fff" />
          <stop offset=".6" stopColor="#c9d2e0" />
          <stop offset="1" stopColor="#56627a" />
        </linearGradient>
        <linearGradient id={flange} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#c9d2e0" />
          <stop offset=".3" stopColor="#fff" />
          <stop offset="1" stopColor="#56627a" />
        </linearGradient>
        <linearGradient id={brass} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#f6e29b" />
          <stop offset="1" stopColor="#b8902f" />
        </linearGradient>
      </defs>
      <g>
        <rect x="16" y="13" width="194" height="66" rx="13" fill={`url(#${body})`} />
        <rect x="36" y="19" width="140" height="5" rx="2.5" fill="#fff" opacity=".55" />
        <rect x="12" y="6" width="17" height="80" rx="5" fill={`url(#${flange})`} />
        <circle cx="20.5" cy="14" r="2.1" fill={`url(#${brass})`} />
        <circle cx="20.5" cy="78" r="2.1" fill={`url(#${brass})`} />
        <rect x="80" y="8" width="9" height="76" rx="3" fill={`url(#${flange})`} />
        <rect x="152" y="9" width="12" height="74" rx="3" fill={band} />
        <rect x="152" y="9" width="12" height="9" rx="3" fill="#fff" opacity=".25" />
        <rect x="98" y="29" width="42" height="34" rx="3" fill={`url(#${brass})`} stroke="#6b4e12" strokeWidth=".8" />
        {plate ? (
          <text x="119" y="43" textAnchor="middle" fontSize="9" fontFamily="monospace" fill="#3a2a08" fontWeight="600">
            {plate}
          </text>
        ) : null}
        <rect x="105" y={plate ? 50 : 38} width="28" height="2" fill="#3a2a08" opacity=".5" />
        <rect x="108" y={plate ? 55 : 44} width="22" height="2" fill="#3a2a08" opacity=".4" />
        {plate ? null : <rect x="110" y="50" width="18" height="2" fill="#3a2a08" opacity=".3" />}
      </g>
      <g className="cap-lid">
        <rect x="196" y="5" width="22" height="82" rx="6" fill={`url(#${flange})`} />
        <circle cx="207" cy="13" r="2.1" fill={`url(#${brass})`} />
        <circle cx="207" cy="79" r="2.1" fill={`url(#${brass})`} />
        <path d="M218 14 Q 246 46 218 78 Z" fill={`url(#${body})`} />
        <ellipse cx="236" cy="46" rx="3.2" ry="11" fill="none" stroke="rgba(0,0,0,.35)" strokeWidth="2" />
      </g>
    </svg>
  );
}
