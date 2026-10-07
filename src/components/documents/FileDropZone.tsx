"use client";

import { useState, type FocusEvent, type RefObject } from "react";

const LINES = 5;

/**
 * La zona in cui si trascina un documento (o si clicca per sceglierlo). Quattro stati: a riposo, con un file che ci passa
 * sopra, mentre Hinthial ne legge il testo sul dispositivo, a lettura finita. Gli stili stanno in globals.css (`.file-drop`);
 * `state` lo decide chi la usa, il "file sopra" lo sa solo lei. Il campo vero ricopre il riquadro, invisibile ma presente:
 * resta un controllo raggiungibile da tastiera.
 */
export function FileDropZone({
  inputRef,
  state,
  progress,
  onFile,
  onInputBlur,
}: {
  inputRef: RefObject<HTMLInputElement | null>;
  state: "idle" | "loading" | "done";
  /** 0..1 durante la lettura; null se non si sa ancora quanto manca (la luce va e viene). */
  progress: number | null;
  onFile: (file: File | null) => void;
  onInputBlur: (event: FocusEvent<HTMLInputElement>) => void;
}) {
  const [dragging, setDragging] = useState(false);
  const shown = state === "idle" && dragging ? "over" : state;
  const lit = progress === null ? 0 : Math.floor(progress * (LINES + 1));
  const percent = progress === null ? "" : ` ${Math.round(progress * 100)}%`;

  return (
    <div
      className="file-drop"
      data-state={shown}
      data-indeterminate={shown === "loading" && progress === null ? "true" : undefined}
      style={{ "--fd-p": progress ?? 0 } as React.CSSProperties}
      onDragEnter={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={(e) => {
        // Passare da un elemento interno a un altro non è uscire dal riquadro.
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDragging(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        onFile(e.dataTransfer.files?.[0] ?? null);
      }}
    >
      <input
        id="file"
        ref={inputRef}
        type="file"
        onChange={(e) => onFile(e.target.files?.[0] ?? null)}
        onBlur={onInputBlur}
        aria-label="Scegli un file"
        className="fd-input"
      />
      <span className="fd-grid" aria-hidden="true" />
      <span className="fd-c tl" aria-hidden="true" />
      <span className="fd-c tr" aria-hidden="true" />
      <span className="fd-c bl" aria-hidden="true" />
      <span className="fd-c br" aria-hidden="true" />
      <span className="fd-scan" aria-hidden="true" />
      <div className="fd-content">
        <div className="fd-page" aria-hidden="true">
          {Array.from({ length: LINES }, (_, i) => (
            <i key={i} data-on={progress !== null && shown === "loading" && i < lit ? "true" : undefined} style={{ "--i": i } as React.CSSProperties} />
          ))}
          <span className="fd-stamp">
            <svg viewBox="0 0 24 24">
              <path d="M5 12.5l4.5 4.5L19 7" />
            </svg>
          </span>
        </div>
        <p className="fd-msg" aria-live="polite">
          <span className="fd-m-idle">Trascina qui un documento, o clicca per sceglierlo</span>
          <span className="fd-m-over">Inquadrato: rilascia</span>
          <span className="fd-m-load">Leggo il testo sul tuo dispositivo…{percent}</span>
          <span className="fd-m-done">Fatto</span>
        </p>
        <p className="fd-sub">PDF, immagini, file di testo</p>
      </div>
    </div>
  );
}
