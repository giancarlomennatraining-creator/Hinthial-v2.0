import type { ArchiveViewMode } from "@/lib/list-view";

/** Un'icona per ogni vista dell'Archivio: stesso tratto, così nel menu si riconoscono a colpo d'occhio. */
export function ArchiveViewIcon({ view, size = 18 }: { view: ArchiveViewMode; size?: number }) {
  const common = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };

  switch (view) {
    case "list":
      return (
        <svg {...common}>
          <line x1="8" y1="6" x2="20" y2="6" />
          <line x1="8" y1="12" x2="20" y2="12" />
          <line x1="8" y1="18" x2="20" y2="18" />
          <circle cx="4" cy="6" r="0.8" fill="currentColor" />
          <circle cx="4" cy="12" r="0.8" fill="currentColor" />
          <circle cx="4" cy="18" r="0.8" fill="currentColor" />
        </svg>
      );
    case "table":
      return (
        <svg {...common}>
          <rect x="3" y="4" width="18" height="16" rx="2" />
          <line x1="3" y1="10" x2="21" y2="10" />
          <line x1="3" y1="15" x2="21" y2="15" />
          <line x1="9" y1="4" x2="9" y2="20" />
        </svg>
      );
    case "gallery":
      return (
        <svg {...common}>
          <rect x="3" y="3" width="8" height="8" rx="1.5" />
          <rect x="13" y="3" width="8" height="8" rx="1.5" />
          <rect x="3" y="13" width="8" height="8" rx="1.5" />
          <rect x="13" y="13" width="8" height="8" rx="1.5" />
        </svg>
      );
    case "timeline":
      return (
        <svg {...common}>
          <line x1="6" y1="3" x2="6" y2="21" />
          <circle cx="6" cy="6" r="2" fill="currentColor" />
          <circle cx="6" cy="14" r="2" fill="currentColor" />
          <line x1="11" y1="6" x2="20" y2="6" />
          <line x1="11" y1="14" x2="18" y2="14" />
          <line x1="11" y1="19" x2="16" y2="19" />
        </svg>
      );
    case "collections":
      return (
        <svg {...common}>
          <rect x="4" y="8" width="11" height="13" rx="1.5" />
          <path d="M8 5h9a2 2 0 0 1 2 2v10" />
          <path d="M11 2.5h6.5" />
        </svg>
      );
    case "shelf":
      return (
        <svg {...common}>
          <line x1="3" y1="21" x2="21" y2="21" />
          <rect x="5" y="9" width="3" height="12" rx="0.8" />
          <rect x="10" y="4" width="3.5" height="17" rx="0.8" />
          <rect x="15.5" y="7" width="3" height="14" rx="0.8" />
        </svg>
      );
  }
}
