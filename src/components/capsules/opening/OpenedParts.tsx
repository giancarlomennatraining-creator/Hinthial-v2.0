"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useSupabase } from "@/lib/db/supabase/use-supabase";
import { downloadSharedCapsuleAttachment } from "@/domain/capsules/repository";
import type { OpenedAttachment, OpenedCapsuleSlots, OpenedCapsuleView } from "@/components/capsules/opening/types";
import { contentKindFor, CONTENT_KIND_ICON, hasInlinePlayer } from "@/lib/content-kind";
import { formatSize } from "@/lib/format";
import { cn } from "@/lib/utils";

/** I pezzi di una capsula aperta che i cinque effetti si dividono: la lettera, gli allegati (veri o di anteprima) e la pagina di lettura. */

type Tone = "light" | "dark";

/** La lettera, su carta calda: a mano se chi l'ha scritta ha scelto così (v. CapsuleContentStyle). */
export function OpenedLetter({ view, from = true, large = false }: { view: OpenedCapsuleView; from?: boolean; large?: boolean }) {
  return (
    <div className="rounded-card border border-[#EDE1C4] bg-[#FBF6EA] px-6 py-5 text-[#3B331F]">
      {from ? <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-[#6B5730]">Da {view.ownerName}, per te</p> : null}
      {view.letter.trim() ? (
        <p
          className={cn(
            "whitespace-pre-wrap leading-relaxed",
            view.letterStyle === "handwritten" ? (large ? "font-caveat text-[30px]" : "font-caveat text-[24px]") : large ? "text-[17px]" : "text-[15px]",
          )}
        >
          {view.letter}
        </p>
      ) : (
        <p className="text-sm text-[#8F7A4A]">Nessun testo scritto.</p>
      )}
    </div>
  );
}

const ROW_TONE: Record<Tone, string> = {
  light: "bg-zinc-50 text-zinc-700 dark:bg-zinc-900 dark:text-zinc-300",
  dark: "bg-white/10 text-white",
};

const LINK_TONE: Record<Tone, string> = {
  light: "text-zinc-600 dark:text-zinc-400",
  dark: "text-white/80",
};

/** Un allegato vero di una capsula condivisa: si riproduce sul posto (audio, video, immagine) o si scarica, decifrato sul dispositivo. */
export function LiveAttachment({
  attachment,
  ownerId,
  capsuleId,
  tone,
}: {
  attachment: OpenedAttachment & { documentKeyRaw: string };
  ownerId: string;
  capsuleId: string;
  tone: Tone;
}) {
  const supabase = useSupabase();
  return (
    <LoadableAttachment
      attachment={attachment}
      tone={tone}
      load={() => downloadSharedCapsuleAttachment(supabase, ownerId, capsuleId, attachment)}
    />
  );
}

/** La riga di un allegato con "Riproduci" e "Apri": `load` dice come ottenere i byte in chiaro (per chi riceve, o per chi scrive nell'anteprima). */
export function LoadableAttachment({
  attachment,
  load,
  tone,
}: {
  attachment: OpenedAttachment;
  load: () => Promise<{ filename: string; mimeType: string; bytes: Uint8Array }>;
  tone: Tone;
}) {
  const [playerUrl, setPlayerUrl] = useState<string | null>(null);
  const [showPlayer, setShowPlayer] = useState(false);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const kind = contentKindFor(attachment.mimeType);

  // Libera sempre l'object URL, sia allo smontaggio sia cambiando elemento.
  useEffect(() => {
    return () => {
      if (playerUrl) URL.revokeObjectURL(playerUrl);
    };
  }, [playerUrl]);

  async function togglePlayer() {
    if (showPlayer) {
      setShowPlayer(false);
      return;
    }
    setShowPlayer(true);
    if (playerUrl) return;
    setLoading(true);
    setError(null);
    try {
      const { mimeType, bytes } = await load();
      setPlayerUrl(URL.createObjectURL(new Blob([new Uint8Array(bytes)], { type: mimeType })));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossibile riprodurre il contenuto.");
      setShowPlayer(false);
    } finally {
      setLoading(false);
    }
  }

  async function handleOpen() {
    setBusy(true);
    setError(null);
    try {
      const { filename, mimeType, bytes } = await load();
      const url = URL.createObjectURL(new Blob([new Uint8Array(bytes)], { type: mimeType }));
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossibile aprire l'allegato.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-1.5">
      <div className={cn("flex items-center justify-between gap-3 rounded-md px-3 py-1.5 text-xs", ROW_TONE[tone])}>
        <span className="truncate">
          {CONTENT_KIND_ICON[kind]} {attachment.filename} · {formatSize(attachment.size)}
        </span>
        <span className="flex shrink-0 gap-3">
          {hasInlinePlayer(kind) ? (
            <button type="button" onClick={togglePlayer} className={cn("font-medium underline-offset-2 hover:underline", LINK_TONE[tone])}>
              {showPlayer ? "Nascondi" : "Riproduci"}
            </button>
          ) : null}
          <button
            type="button"
            disabled={busy}
            onClick={handleOpen}
            className={cn("font-medium underline-offset-2 hover:underline disabled:opacity-50", LINK_TONE[tone])}
          >
            {busy ? "Apertura…" : "Apri"}
          </button>
        </span>
      </div>
      {error ? (
        <p role="alert" className="text-xs text-red-500">
          {error}
        </p>
      ) : null}
      {showPlayer ? (
        <div className={cn("rounded-md p-3", ROW_TONE[tone])}>
          {loading || !playerUrl ? (
            <p className="text-xs opacity-70">Caricamento…</p>
          ) : kind === "image" ? (
            // eslint-disable-next-line @next/next/no-img-element -- object URL locale, decifrata sul dispositivo
            <img src={playerUrl} alt={attachment.filename} className="max-h-72 max-w-full rounded-md" />
          ) : kind === "video" ? (
            <video src={playerUrl} controls className="max-h-72 max-w-full rounded-md" />
          ) : (
            <audio src={playerUrl} controls className="w-full" />
          )}
        </div>
      ) : null}
    </div>
  );
}

/** Un allegato di anteprima: solo il nome, senza pulsanti (non c'è nulla da scaricare). */
export function StaticAttachment({ attachment, tone }: { attachment: OpenedAttachment; tone: Tone }) {
  const kind = contentKindFor(attachment.mimeType);
  return (
    <div className={cn("flex items-center justify-between gap-3 rounded-md px-3 py-1.5 text-xs", ROW_TONE[tone])}>
      <span className="truncate">
        {CONTENT_KIND_ICON[kind]} {attachment.filename} · {formatSize(attachment.size)}
      </span>
      <span className={cn("shrink-0 font-medium opacity-60", LINK_TONE[tone])}>Anteprima</span>
    </div>
  );
}

/** Il segnaposto di "Lascia un pensiero" nelle anteprime: stesso aspetto, nessun invio. */
export function StaticReply({ ownerName }: { ownerName: string }) {
  return (
    <section aria-label="Lascia un pensiero" className="flex flex-col gap-2 rounded-card border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
      <h3 className="font-heading text-base font-extrabold text-[#121a35] dark:text-zinc-100">Lascia un pensiero a {ownerName}</h3>
      <p className="min-h-14 rounded-xl border border-zinc-200 px-3 py-2 text-sm text-zinc-400 dark:border-zinc-800">Cosa ti ha fatto pensare?</p>
      <p className="text-xs text-zinc-500 dark:text-zinc-400">Nell&apos;anteprima non si invia nulla.</p>
    </section>
  );
}

export function OpenedBadge({ children = "Aperta ora" }: { children?: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-[#D8F5E3] px-2.5 py-0.5 text-xs font-bold text-[#1c7c5a] dark:bg-green-950 dark:text-green-300">
      <span className="h-2 w-2 rounded-full bg-[#2FD27E]" aria-hidden="true" />
      {children}
    </span>
  );
}

/** La storia di una capsula: un filo con i suoi momenti (condivisa, data prevista, aperta). */
export function StoryTimeline({ view }: { view: OpenedCapsuleView }) {
  return (
    <section aria-label="La storia di questa capsula" className="flex flex-col rounded-card border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
      <h3 className="mb-3 font-heading text-base font-extrabold text-[#121a35] dark:text-zinc-100">La storia di questa capsula</h3>
      <ol className="flex flex-col">
        {view.story.map((event, i) => (
          <li key={`${event.label}-${i}`} className="relative grid grid-cols-[14px_minmax(0,1fr)] gap-3 pb-3 text-sm last:pb-0">
            {i < view.story.length - 1 ? <span aria-hidden="true" className="absolute bottom-0 left-[6px] top-4 w-0.5 bg-zinc-200 dark:bg-zinc-800" /> : null}
            <span
              aria-hidden="true"
              className={cn("relative z-10 mt-1 h-3.5 w-3.5 rounded-full border-[3px]", event.now ? "border-[#2FD27E] bg-[#2FD27E]" : "border-brand bg-white dark:bg-zinc-950")}
            />
            <span className="text-[#121a35] dark:text-zinc-100">
              {event.label}
              {event.when ? <small className="block text-xs text-zinc-500 dark:text-zinc-400">{event.when}</small> : null}
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}

/** La pagina di lettura: lettera a sinistra, allegati (e storia) a destra, il pensiero in fondo. Su schermi stretti, in colonna. */
export function ReadingPage({
  view,
  slots,
  withStory = false,
  compact = false,
}: {
  view: OpenedCapsuleView;
  slots: OpenedCapsuleSlots;
  withStory?: boolean;
  compact?: boolean;
}) {
  return (
    <div className="flex flex-col gap-4">
      <div className={cn("grid gap-4", compact ? "grid-cols-1" : "md:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]")}>
        <div className="flex min-w-0 flex-col gap-4">
          <OpenedLetter view={view} from={false} large />
          {!compact ? slots.reply : null}
        </div>
        <div className="flex min-w-0 flex-col gap-3">
          {view.attachments.length > 0 ? (
            <ul className="flex flex-col gap-2">
              {view.attachments.map((attachment) => (
                <li key={attachment.id}>{slots.renderAttachment(attachment, "light")}</li>
              ))}
            </ul>
          ) : null}
          {withStory ? <StoryTimeline view={view} /> : null}
        </div>
      </div>
      {compact ? slots.reply : null}
    </div>
  );
}
