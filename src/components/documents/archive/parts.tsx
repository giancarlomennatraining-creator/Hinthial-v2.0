"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import type { ExpiryInfo, ExpiryLevel } from "@/domain/documents/archive-views";
import type { MobileAddFabMenuItem } from "@/components/ui/MobileAddFab";
import { cn } from "@/lib/utils";
import { useDismissOnOutside } from "@/lib/use-dismiss-on-outside";

/** Pezzi condivisi dalle viste alternative dell'Archivio: pagina disegnata, scadenza, puntino di lettura, menu "Aggiungi". */

export const ADD_CONTENT_ITEMS: MobileAddFabMenuItem[] = [
  { href: "/archive/new", label: "Carica un file", icon: "📄" },
  { href: "/archive/new?mode=record", label: "Registra audio/video", icon: "🎬" },
  { href: "/archive/new?mode=note", label: "Scrivi una nota", icon: "📝" },
  { href: "/archive/import", label: "Importa più file insieme", icon: "📥", separated: true },
];

/** Una pagina disegnata: una fascia del colore della categoria e qualche riga di testo finto. Dove manca la miniatura vera. */
export function DrawnPage({
  color,
  headerHeight = 14,
  lines = [82, 58, 90, 46, 70],
  lineHeight = 5,
  gap = 6,
  padding = "9px 10px",
  className,
  style,
}: {
  color: string;
  headerHeight?: number;
  lines?: number[];
  lineHeight?: number;
  gap?: number;
  padding?: string;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div className={cn("overflow-hidden bg-white", className)} style={style}>
      <div style={{ height: headerHeight, background: color }} />
      <div className="flex flex-col" style={{ padding, gap }}>
        {lines.map((width, i) => (
          <div key={i} className="rounded-[3px] bg-[#dfe3f0]" style={{ height: lineHeight, width: `${width}%` }} />
        ))}
      </div>
    </div>
  );
}

const PILL_COLORS: Record<ExpiryLevel, { bg: string; fg: string } | null> = {
  overdue: { bg: "#fde9e7", fg: "#b42318" },
  danger: { bg: "#fde9e7", fg: "#b42318" },
  warn: { bg: "#fdf3dd", fg: "#8a5a00" },
  soft: { bg: "#eef0f8", fg: "#4a5275" },
  none: null,
};

/** La scadenza come pillola: rossa se imminente o passata, ambra entro due mesi, grigia se lontana. Resta chiara anche sul tema scuro, come nei disegni. */
export function ExpiryPill({
  info,
  className,
  prefix = "",
}: {
  info: ExpiryInfo;
  className?: string;
  prefix?: string;
}) {
  const colors = PILL_COLORS[info.level];
  if (!colors || !info.text) return null;
  return (
    <span
      className={cn("inline-block whitespace-nowrap rounded-full px-[9px] py-[3px] text-[11.5px] font-bold", className)}
      style={{ background: colors.bg, color: colors.fg }}
    >
      {prefix}
      {info.text}
    </span>
  );
}

/** Il puntino "letto da Hinthia": pieno blu se letto, vuoto se ancora da leggere. */
export function ReadDot({ read, size = 9, className }: { read: boolean; size?: number; className?: string }) {
  return (
    <span
      role="img"
      aria-label={read ? "Letto da Hinthia" : "Ancora da leggere con Hinthia"}
      title={read ? "Letto da Hinthia" : "Ancora da leggere"}
      className={cn("inline-block shrink-0 rounded-full border-[1.5px] box-border", className)}
      style={{
        width: size,
        height: size,
        background: read ? "#2b4fc4" : "transparent",
        borderColor: read ? "#2b4fc4" : "#8a91ad",
      }}
    />
  );
}

/** "+ Aggiungi contenuto" con il suo menu: lo stesso per tutte le viste. */
export function AddContentMenu({
  className,
  label = "+ Aggiungi contenuto",
  align = "right",
}: {
  className?: string;
  label?: string;
  align?: "left" | "right";
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Si chiude a un click fuori da bottone e pannello.
  useDismissOnOutside(ref, open, () => setOpen(false));

  return (
    <div ref={ref} className="relative hidden shrink-0 sm:block">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        className={cn("flex items-center gap-1.5 rounded-xl bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-hover", className)}
      >
        {label}
        <span aria-hidden="true" className="text-xs">
          {open ? "▴" : "▾"}
        </span>
      </button>
      {open ? (
        <div
          role="menu"
          aria-label="Aggiungi contenuto"
          className={cn(
            "absolute top-full z-30 mt-1 w-56 overflow-hidden rounded-md border border-zinc-200 bg-white py-1 shadow-lg dark:border-zinc-800 dark:bg-zinc-950",
            align === "right" ? "right-0" : "left-0",
          )}
        >
          {ADD_CONTENT_ITEMS.map((item) => (
            <div key={item.href}>
              {item.separated ? <div className="my-1 border-t border-zinc-100 dark:border-zinc-900" /> : null}
              <Link
                href={item.href}
                role="menuitem"
                onClick={() => setOpen(false)}
                className="flex items-center gap-2 px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-900"
              >
                <span aria-hidden="true">{item.icon}</span> {item.label}
              </Link>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
