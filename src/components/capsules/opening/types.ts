import type { ReactNode } from "react";
import type { CapsuleContentStyle, SharedCapsuleAttachment } from "@/domain/capsules/types";

/** Da dove parte l'apertura: il centro e il raggio dell'oblò (o della capsula) toccato, in coordinate della finestra. */
export interface OpenOrigin {
  x: number;
  y: number;
  /** Raggio del cerchio da cui si allarga lo "zoom": il vetro dell'oblò. */
  r: number;
}

/** Un allegato come lo vedono gli effetti: solo ciò che serve a mostrarlo (la chiave non esce da chi lo apre). */
export type OpenedAttachment = Pick<SharedCapsuleAttachment, "id" | "filename" | "mimeType" | "size">;

/** Un passo della storia di una capsula ("Condivisa con te", "Aperta ora"), per la pagina dell'effetto discreto. */
export interface StoryEvent {
  label: string;
  /** Già formattata, o null se non nota. */
  when: string | null;
  now?: boolean;
}

/** Tutto ciò che un effetto di apertura mostra, comune ai cinque. */
export interface OpenedCapsuleView {
  title: string;
  ownerName: string;
  letter: string;
  letterStyle: CapsuleContentStyle;
  attachments: OpenedAttachment[];
  story: StoryEvent[];
}

/** Le parti "vive" che cambiano tra l'apertura vera e un'anteprima: come si mostra un allegato e il pensiero finale. */
export interface OpenedCapsuleSlots {
  /** Un allegato, con i suoi pulsanti. `tone` dice se lo sfondo è chiaro o scuro. */
  renderAttachment: (attachment: OpenedAttachment, tone: "light" | "dark") => ReactNode;
  /** "Lascia un pensiero": il vero riquadro, o un segnaposto nell'anteprima. */
  reply: ReactNode;
}

export interface OpenEffectProps {
  view: OpenedCapsuleView;
  slots: OpenedCapsuleSlots;
  origin: OpenOrigin | null;
  onClose: () => void;
}
