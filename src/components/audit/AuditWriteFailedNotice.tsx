"use client";

import { useEffect, useState } from "react";
import { AUDIT_WRITE_FAILED_EVENT } from "@/lib/audit/log-event";

/** Avviso fisso quando la scrittura di un evento nel registro fallisce: l'azione è andata a buon fine, ma non comparirà in Impostazioni > Attività. */
export function AuditWriteFailedNotice() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const show = () => setVisible(true);
    window.addEventListener(AUDIT_WRITE_FAILED_EVENT, show);
    return () => window.removeEventListener(AUDIT_WRITE_FAILED_EVENT, show);
  }, []);

  if (!visible) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-4 z-[60] flex justify-center px-4">
      <div
        role="alert"
        className="pointer-events-auto flex max-w-md items-start gap-3 rounded-xl bg-amber-500 px-4 py-3 text-sm text-zinc-950 shadow-lg"
      >
        <p className="flex-1">
          L&apos;azione è stata eseguita, ma non è stato possibile registrarla in Impostazioni &gt; Attività.
        </p>
        <button
          type="button"
          onClick={() => setVisible(false)}
          aria-label="Chiudi avviso"
          className="shrink-0 rounded-md px-1 font-medium hover:bg-black/10"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
