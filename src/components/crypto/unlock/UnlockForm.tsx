"use client";

import { useEffect, type FormEvent } from "react";
import { UnlockedIcon } from "@/components/icons/nav-icons";
import { PasswordInput } from "@/components/ui/PasswordInput";
import type { UnlockFlow } from "@/components/crypto/unlock/useUnlockFlow";

/**
 * Il campo (master password o recovery key) e il pulsante "Sblocca", uguali in tutte le pelli. Il campo prende il
 * focus all'apertura, e di nuovo quando si cambia tra password e recovery key o quando `focusSignal` cambia (il
 * cassetto della pelle "Impronta" che si apre).
 */
export function UnlockForm({
  flow,
  onLengthChange,
  focusSignal,
  showError = true,
}: {
  flow: UnlockFlow;
  /** Quanti caratteri ci sono nel campo: la ruota della cassaforte gira di conseguenza. */
  onLengthChange?: (length: number) => void;
  focusSignal?: unknown;
  showError?: boolean;
}) {
  const fieldId = flow.recovery ? "recoveryKey" : "masterPassword";
  const busy = flow.phase === "verifying" || flow.phase === "success";

  useEffect(() => {
    const timer = setTimeout(() => document.getElementById(fieldId)?.focus(), 60);
    return () => clearTimeout(timer);
  }, [fieldId, focusSignal]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    void flow.submit(String(data.get(fieldId) ?? ""));
  }

  function handleChange(event: React.ChangeEvent<HTMLInputElement>) {
    flow.touch();
    onLengthChange?.(event.target.value.length);
  }

  return (
    <form onSubmit={handleSubmit} className="w-full">
      <div className="unlock-field">
        <label htmlFor={fieldId}>{flow.recovery ? "Recovery key" : "Master password"}</label>
        {flow.recovery ? (
          <input
            key="recovery"
            id="recoveryKey"
            name="recoveryKey"
            type="text"
            autoComplete="off"
            placeholder="XXXX-XXXX-XXXX-…"
            required
            onChange={handleChange}
            aria-invalid={flow.phase === "error"}
            className="unlock-input"
          />
        ) : (
          <PasswordInput
            key="password"
            id="masterPassword"
            name="masterPassword"
            autoComplete="current-password"
            required
            onChange={handleChange}
            aria-invalid={flow.phase === "error"}
            className="unlock-input"
          />
        )}
      </div>
      {showError ? (
        // Il posto dell'errore resta riservato, ma un avviso (role="alert") c'è solo quando c'è davvero un errore.
        <div className="unlock-err-slot">
          {flow.error ? (
            <p role="alert" className="unlock-err">
              {flow.error}
            </p>
          ) : null}
        </div>
      ) : null}
      <button type="submit" disabled={busy} className="unlock-go">
        <UnlockedIcon width={16} height={16} />
        {busy ? "Sblocco…" : "Sblocca"}
      </button>
    </form>
  );
}
