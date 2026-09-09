/**
 * Icone di sistema, in linea con la direzione visiva "Fresh Clarity" (v.
 * mockup condiviso con l'utente) --- SVG a tratto, non emoji: usate per
 * la barra di navigazione, i contatori in dashboard e i badge di stato
 * (fatto/da fare, ok/attenzione). Le emoji restano invece dove sono una
 * scelta dell'utente (icona di una categoria, v. IconPicker) o un
 * ornamento nel testo (es. "🎥 Registra video"): non sono in scope qui.
 *
 * Tutte 24x24, stroke="currentColor" (eredita il colore del testo del
 * chiamante, incluso lo stato attivo/hover della nav) --- mai un colore
 * fisso incollato dentro l'icona.
 */
import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

function baseProps(props: IconProps): IconProps {
  return {
    width: 20,
    height: 20,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    "aria-hidden": true,
    ...props,
  };
}

export function DashboardIcon(props: IconProps) {
  return (
    <svg {...baseProps(props)}>
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="12" y="3" width="7" height="5" rx="1.5" />
      <rect x="3" y="12" width="7" height="5" rx="1.5" />
      <rect x="12" y="10" width="7" height="9" rx="1.5" />
    </svg>
  );
}

export function ArchiveIcon(props: IconProps) {
  return (
    <svg {...baseProps(props)}>
      <rect x="3" y="4" width="18" height="4" rx="1" />
      <path d="M4 9h16v9a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V9z" />
      <line x1="9" y1="13" x2="15" y2="13" />
    </svg>
  );
}

export function ReminderIcon(props: IconProps) {
  return (
    <svg {...baseProps(props)}>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 8v4l3 2" />
    </svg>
  );
}

export function AssetIcon(props: IconProps) {
  return (
    <svg {...baseProps(props)}>
      <path d="M4 11.5 12 4l8 7.5" />
      <path d="M6 10v9a1 1 0 0 0 1 1h4v-6h2v6h4a1 1 0 0 0 1-1v-9" />
    </svg>
  );
}

export function ContactIcon(props: IconProps) {
  return (
    <svg {...baseProps(props)}>
      <circle cx="8.5" cy="8" r="3" />
      <path d="M2.5 19c0-3.5 2.7-6 6-6s6 2.5 6 6" />
      <circle cx="17" cy="9" r="2.5" />
      <path d="M15 19c.3-2.7 2-4.7 4.5-5" />
    </svg>
  );
}

export function CapsuleIcon(props: IconProps) {
  return (
    <svg {...baseProps(props)}>
      <path d="M12 3 3 7.5v9L12 21l9-4.5v-9L12 3z" />
      <path d="M3 7.5 12 12l9-4.5" />
      <line x1="12" y1="12" x2="12" y2="21" />
    </svg>
  );
}

export function TimelineIcon(props: IconProps) {
  return (
    <svg {...baseProps(props)}>
      <path d="M3 12a9 9 0 1 0 3-6.7" />
      <polyline points="3 4 3 9 8 9" />
      <path d="M12 8v4l3 2" />
    </svg>
  );
}

export function AIIcon(props: IconProps) {
  return (
    <svg {...baseProps(props)}>
      <path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3z" />
      <path d="M19 15l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7.7-2z" />
    </svg>
  );
}

/** Solo per il contatore "Categorie" in dashboard (v. DashboardCounters) --- non l'icona di una categoria vera e propria, che resta emoji scelta dall'utente (v. IconPicker). */
export function CategoryIcon(props: IconProps) {
  return (
    <svg {...baseProps(props)}>
      <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z" />
    </svg>
  );
}

/** Scheda "Informazioni utente" in Impostazioni --- testa e spalle allargate per riempire il riquadro come le altre icone della pagina (v. richiesta utente: prima appariva più piccola delle altre). */
export function UserIcon(props: IconProps) {
  return (
    <svg {...baseProps(props)}>
      <circle cx="12" cy="7" r="5" />
      <path d="M3 21c0-5 4-9 9-9s9 4 9 9" />
    </svg>
  );
}

/** Scheda "Sicurezza" in Impostazioni (stesso lucchetto del badge "zero-knowledge" nella hero). */
export function SecurityIcon(props: IconProps) {
  return (
    <svg {...baseProps(props)}>
      <rect x="5" y="10" width="14" height="10" rx="2" />
      <path d="M8 10V7a4 4 0 0 1 8 0v3" />
    </svg>
  );
}

/** Bottone "Sblocca" (v. UnlockMasterKeyForm) --- lo stesso lucchetto di SecurityIcon, ma aperto: il gancio si stacca dal corpo invece di richiuderlo. */
export function UnlockedIcon(props: IconProps) {
  return (
    <svg {...baseProps(props)}>
      <rect x="5" y="10" width="14" height="10" rx="2" />
      <path d="M8 10V7a4 4 0 0 1 7.4-2.3" />
    </svg>
  );
}

/** Scheda "Privacy" in Impostazioni. */
export function EyeIcon(props: IconProps) {
  return (
    <svg {...baseProps(props)}>
      <path d="M2 12s3.8-7 10-7 10 7 10 7-3.8 7-10 7-10-7-10-7z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

/** Scheda "Importa/Esporta" in Impostazioni. */
export function ImportExportIcon(props: IconProps) {
  return (
    <svg {...baseProps(props)}>
      <path d="M8 3v11" />
      <path d="M4.5 10.5 8 14l3.5-3.5" />
      <path d="M16 21V10" />
      <path d="M19.5 13.5 16 10l-3.5 3.5" />
    </svg>
  );
}

/** Scheda "Onboarding" in Impostazioni. */
export function ChecklistIcon(props: IconProps) {
  return (
    <svg {...baseProps(props)}>
      <path d="M3.5 6.5 5 8l2.5-2.5" />
      <line x1="10.5" y1="6.5" x2="20.5" y2="6.5" />
      <path d="M3.5 12.5 5 14l2.5-2.5" />
      <line x1="10.5" y1="12.5" x2="20.5" y2="12.5" />
      <path d="M3.5 18.5 5 20l2.5-2.5" />
      <line x1="10.5" y1="18.5" x2="20.5" y2="18.5" />
    </svg>
  );
}

/** Scheda "Attività" (registro di audit) in Impostazioni. */
export function ActivityIcon(props: IconProps) {
  return (
    <svg {...baseProps(props)}>
      <path d="M3 12h4l2-8 4 16 2-8h6" />
    </svg>
  );
}

/** Scheda "Aspetto" in Impostazioni. */
export function SlidersIcon(props: IconProps) {
  return (
    <svg {...baseProps(props)}>
      <line x1="4" y1="6" x2="20" y2="6" />
      <circle cx="9" cy="6" r="2" />
      <line x1="4" y1="12" x2="20" y2="12" />
      <circle cx="15" cy="12" r="2" />
      <line x1="4" y1="18" x2="20" y2="18" />
      <circle cx="7" cy="18" r="2" />
    </svg>
  );
}

/** Freccia nel bottone principale della homepage ("Crea account"). */
export function ArrowRightIcon(props: IconProps) {
  return (
    <svg {...baseProps(props)}>
      <path d="M9 5l6 7-6 7" />
    </svg>
  );
}

/** Badge di stato "fatto"/"ok" (sostituisce ✅). */
export function CheckCircleIcon(props: IconProps) {
  return (
    <svg {...baseProps(props)}>
      <circle cx="12" cy="12" r="9" />
      <path d="M8 12.5l2.5 2.5L16 9" />
    </svg>
  );
}

/** Badge di stato "attenzione" (sostituisce ⚠️). */
export function AlertTriangleIcon(props: IconProps) {
  return (
    <svg {...baseProps(props)}>
      <path d="M12 3 2 20h20L12 3z" />
      <line x1="12" y1="10" x2="12" y2="14" />
    </svg>
  );
}

/** Passo non ancora fatto nella checklist di onboarding (sostituisce ⬜). */
export function CircleIcon(props: IconProps) {
  return (
    <svg {...baseProps(props)}>
      <circle cx="12" cy="12" r="9" />
    </svg>
  );
}
