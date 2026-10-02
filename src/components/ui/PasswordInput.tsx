"use client";

import { useState, type InputHTMLAttributes } from "react";

/**
 * Un campo password con l'occhio che mostra o nasconde i caratteri. Parte nascosto, ogni campo ha il suo stato.
 * Il padding a destra è inline (non una classe): `cn()` non risolve i conflitti tra utility Tailwind, e un `pr-*`
 * accanto al `px-*` del chiamante darebbe un risultato che dipende dall'ordine del CSS.
 * Il nome del pulsante non contiene la parola "password": un'etichetta così sarebbe trovata anche da chi cerca il campo.
 */
export function PasswordInput({ style, ...inputProps }: Omit<InputHTMLAttributes<HTMLInputElement>, "type">) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="relative w-full">
      <input {...inputProps} type={visible ? "text" : "password"} style={{ ...style, paddingRight: "2.75rem" }} />
      <button
        type="button"
        onClick={() => setVisible((current) => !current)}
        aria-label={visible ? "Nascondi caratteri" : "Mostra caratteri"}
        aria-pressed={visible}
        title={visible ? "Nascondi caratteri" : "Mostra caratteri"}
        className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-2xl text-zinc-500 hover:text-zinc-900 focus-visible:text-brand focus-visible:outline-none dark:text-zinc-400 dark:hover:text-zinc-100"
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          {visible ? (
            <>
              <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
              <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
              <path d="M14.12 14.12a3 3 0 1 1-4.24-4.24" />
              <path d="M1 1l22 22" />
            </>
          ) : (
            <>
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
              <circle cx="12" cy="12" r="3" />
            </>
          )}
        </svg>
      </button>
    </div>
  );
}
