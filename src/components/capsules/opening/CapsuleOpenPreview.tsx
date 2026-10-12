"use client";

import { OpenEffectRenderer } from "@/components/capsules/opening/OpenEffectRenderer";
import { StaticAttachment, StaticReply } from "@/components/capsules/opening/OpenedParts";
import type { OpenOrigin, OpenedAttachment, OpenedCapsuleView } from "@/components/capsules/opening/types";
import type { CapsuleOpenEffect } from "@/domain/capsules/open-effects";
import type { CapsuleContentStyle } from "@/domain/capsules/types";

/** Una capsula di esempio per provare un effetto dalle Impostazioni, quando non c'è ancora una capsula vera da mostrare. */
export const SAMPLE_OPEN_PREVIEW = {
  title: "Per i tuoi 18 anni",
  letter:
    "Caro Marco, quando leggerai queste righe sarai grande. Qui dentro ci sono le foto delle nostre estati al mare e la ricetta della torta della nonna. Con affetto, mamma",
  letterStyle: "handwritten" as CapsuleContentStyle,
  attachments: [
    { id: "a1", filename: "la-mia-voce.mp3", mimeType: "audio/mpeg", size: 1_240_000 },
    { id: "a2", filename: "estate-2025.jpg", mimeType: "image/jpeg", size: 2_400_000 },
    { id: "a3", filename: "torta-della-nonna.pdf", mimeType: "application/pdf", size: 212_000 },
  ] satisfies OpenedAttachment[],
};

/**
 * "Provalo": mostra un effetto di apertura con un contenuto di prova (Impostazioni) o con la capsula che si sta scrivendo
 * (la scelta del mittente). Nulla si decifra, si scarica o si invia: gli allegati sono solo nomi e il pensiero è un segnaposto.
 */
export function CapsuleOpenPreview({
  effect,
  title,
  letter,
  letterStyle,
  attachments,
  ownerName = "Giulia",
  origin,
  onClose,
}: {
  effect: CapsuleOpenEffect;
  title: string;
  letter: string;
  letterStyle: CapsuleContentStyle;
  attachments: OpenedAttachment[];
  ownerName?: string;
  origin: OpenOrigin | null;
  onClose: () => void;
}) {
  const view: OpenedCapsuleView = {
    title: title || "La tua capsula",
    ownerName,
    letter,
    letterStyle,
    attachments,
    story: [
      { label: `Condivisa con te da ${ownerName}`, when: "oggi" },
      { label: "Si apriva il", when: "il giorno scelto" },
      { label: "Aperta", when: "ora", now: true },
    ],
  };

  return (
    <OpenEffectRenderer
      effect={effect}
      view={view}
      origin={origin}
      onClose={onClose}
      slots={{
        renderAttachment: (attachment, tone) => <StaticAttachment attachment={attachment} tone={tone} />,
        reply: <StaticReply ownerName={ownerName} />,
      }}
    />
  );
}
