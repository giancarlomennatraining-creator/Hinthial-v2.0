"use client";

import { useMemo } from "react";
import { useSupabase } from "@/lib/db/supabase/use-supabase";
import { downloadCapsuleAttachment } from "@/domain/capsules/repository";
import { downloadDocument } from "@/domain/documents/repository";
import { formatDateTime } from "@/components/capsules/CapsuleCardParts";
import { OpenEffectRenderer } from "@/components/capsules/opening/OpenEffectRenderer";
import { OpenPreviewContext } from "@/components/capsules/opening/EffectShell";
import { LoadableAttachment, StaticReply } from "@/components/capsules/opening/OpenedParts";
import type { OpenOrigin, OpenedAttachment, OpenedCapsuleSlots, OpenedCapsuleView } from "@/components/capsules/opening/types";
import { parseOpenEffect } from "@/domain/capsules/open-effects";
import type { CapsuleListItem } from "@/domain/capsules/types";

/** Nell'anteprima chi riceve è "l'altro": nessun nome, perché la capsula non è ancora stata condivisa con nessuno. */
const WRITER_LABEL = "chi l'ha scritta";

/**
 * "Così la vedrà chi la riceve": l'anteprima del proprietario, prima ancora di chiudere la capsula. Mostra la stessa apertura
 * che vedrà il destinatario, con l'effetto scelto per questa capsula (Sblocco discreto, Zoom, Tieni premuto, …), la lettera e
 * gli allegati veri (si riproducono e si aprono, decifrati sul dispositivo). L'unica differenza: "Lascia un pensiero" è un
 * segnaposto, perché qui non c'è nessuno a cui rispondere. Non concede alcun accesso reale ai destinatari.
 */
export function CapsulePreview({
  masterKey,
  capsule,
  origin = null,
  onClose,
}: {
  masterKey: CryptoKey;
  /** null: niente da mostrare. */
  capsule: CapsuleListItem | null;
  /** L'oblò (o la capsula) da cui parte l'apertura, per gli effetti che si allargano o escono da lì. */
  origin?: OpenOrigin | null;
  onClose: () => void;
}) {
  const supabase = useSupabase();

  const view: OpenedCapsuleView | null = useMemo(() => {
    if (!capsule) return null;
    const attachments: OpenedAttachment[] = [...capsule.attachments, ...capsule.linkedDocuments].map((a) => ({
      id: a.id,
      filename: a.filename,
      mimeType: a.mimeType,
      size: a.size,
    }));
    return {
      title: capsule.title,
      ownerName: WRITER_LABEL,
      letter: capsule.content,
      letterStyle: capsule.contentStyle,
      attachments,
      story: [
        { label: "Condivisa con te", when: "quando la chiuderai" },
        ...(capsule.openAt ? [{ label: "Si apre il", when: formatDateTime(capsule.openAt) }] : []),
        { label: "Aperta", when: "ora", now: true },
      ],
    };
  }, [capsule]);

  if (!capsule || !view) return null;

  const slots: OpenedCapsuleSlots = {
    renderAttachment: (attachment, tone) => {
      const own = capsule.attachments.find((a) => a.id === attachment.id);
      const linked = own ? undefined : capsule.linkedDocuments.find((d) => d.id === attachment.id);
      return (
        <LoadableAttachment
          attachment={attachment}
          tone={tone}
          load={async () => {
            if (own) {
              const {
                data: { user },
              } = await supabase.auth.getUser();
              if (!user) throw new Error("Devi essere autenticato.");
              return downloadCapsuleAttachment(supabase, masterKey, user.id, capsule.id, own);
            }
            if (!linked) throw new Error("Contenuto collegato non trovato.");
            const { mimeType, bytes } = await downloadDocument(supabase, masterKey, linked);
            return { filename: linked.filename, mimeType, bytes };
          }}
        />
      );
    },
    reply: <StaticReply ownerName={WRITER_LABEL} />,
  };

  return (
    <OpenPreviewContext.Provider value>
      <OpenEffectRenderer effect={parseOpenEffect(capsule.openEffect)} view={view} slots={slots} origin={origin} onClose={onClose} />
    </OpenPreviewContext.Provider>
  );
}
