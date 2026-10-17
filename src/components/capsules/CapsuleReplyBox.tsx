"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useSupabase } from "@/lib/db/supabase/use-supabase";
import { deleteReply, getMyReply, leaveReply } from "@/domain/capsules/replies-repository";
import { MAX_REPLY_LENGTH, normalizeReply } from "@/domain/capsules/replies";
import { formatDate } from "@/lib/format";
import { BTN_PRIMARY, BTN_SECONDARY, INPUT_FIELD } from "@/components/ui/styles";

/**
 * "Lascia un pensiero": in fondo a una capsula aperta, due righe per chi l'ha lasciata. Il pensiero è cifrato sul dispositivo
 * per il proprietario (v. domain/capsules/replies-repository.ts): non si può rileggere, ma si può ritirare e riscrivere. Se
 * non si riesce nemmeno a controllare (la funzione non è disponibile), il riquadro non compare: la capsula si legge lo stesso.
 */
export function CapsuleReplyBox({
  capsuleId,
  ownerId,
  ownerName,
}: {
  capsuleId: string;
  ownerId: string;
  ownerName: string;
}) {
  const supabase = useSupabase();
  const [status, setStatus] = useState<"loading" | "unavailable" | "ready">("loading");
  const [sent, setSent] = useState<{ id: string; createdAt: string } | null>(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const existing = await getMyReply(supabase, capsuleId);
        if (cancelled) return;
        setSent(existing);
        setStatus("ready");
      } catch {
        if (!cancelled) setStatus("unavailable");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [supabase, capsuleId]);

  if (status !== "ready") return null;

  async function handleSend(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      setSent(await leaveReply(supabase, capsuleId, ownerId, text));
      setText("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossibile inviare il pensiero.");
    } finally {
      setBusy(false);
    }
  }

  async function handleWithdraw() {
    if (!sent) return;
    setBusy(true);
    setError(null);
    try {
      await deleteReply(supabase, sent.id);
      setSent(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossibile ritirare il pensiero.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section aria-label="Lascia un pensiero" className="flex flex-col gap-3 rounded-card border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
      <h3 className="font-heading text-base font-extrabold text-zinc-900 dark:text-zinc-100">Lascia un pensiero a {ownerName}</h3>

      {sent ? (
        <>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Il tuo pensiero è arrivato a {ownerName} il {formatDate(sent.createdAt)}. Lo leggerà solo {ownerName}: non puoi
            rileggerlo, ma puoi ritirarlo e scriverne un altro.
          </p>
          <button type="button" disabled={busy} onClick={handleWithdraw} className={`self-start ${BTN_SECONDARY} disabled:opacity-50`}>
            {busy ? "Ritiro…" : "Ritira il pensiero"}
          </button>
        </>
      ) : (
        <form onSubmit={handleSend} className="flex flex-col gap-2">
          <label htmlFor={`reply-${capsuleId}`} className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
            Due righe per {ownerName}
          </label>
          <textarea
            id={`reply-${capsuleId}`}
            rows={3}
            maxLength={MAX_REPLY_LENGTH}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Cosa ti ha fatto pensare?"
            className={INPUT_FIELD}
          />
          <div className="flex items-center justify-between gap-3">
            <button
              type="submit"
              disabled={busy || normalizeReply(text) === null}
              className={`${BTN_PRIMARY} disabled:cursor-not-allowed disabled:opacity-50`}
            >
              {busy ? "Invio…" : "Invia il pensiero"}
            </button>
            <span className="text-xs text-zinc-500 dark:text-zinc-400">
              {text.length} / {MAX_REPLY_LENGTH}
            </span>
          </div>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">Lo legge solo {ownerName}: è cifrato sul tuo dispositivo prima di partire.</p>
        </form>
      )}

      {error ? (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      ) : null}
    </section>
  );
}
