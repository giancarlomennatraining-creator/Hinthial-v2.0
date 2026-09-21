import type { InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type TextFieldProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  /**
   * "halo" --- lo stesso linguaggio più arrotondato e con il focus in
   * blu brand dello sblocco (v. UnlockMasterKeyForm) e delle pagine di
   * autenticazione (login/registrazione/password dimenticata). Resta
   * opt-in, non il default: cambiare l'aspetto di ogni campo dell'app
   * con un colpo solo sarebbe una decisione di design-system a sé, non
   * implicita in un restyle mirato.
   */
  variant?: "default" | "halo";
};

export function TextField({ label, id, variant = "default", ...inputProps }: TextFieldProps) {
  return (
    <div className="flex w-full flex-col gap-1.5">
      <label
        htmlFor={id}
        className="text-sm font-medium text-zinc-700 dark:text-zinc-300"
      >
        {label}
      </label>
      <input
        id={id}
        className={cn(
          "w-full text-sm text-zinc-950 outline-none dark:bg-zinc-950 dark:text-zinc-50",
          variant === "halo"
            ? "rounded-2xl border border-zinc-300 bg-white px-4 py-2.5 focus:border-brand focus:ring-1 focus:ring-brand dark:border-zinc-700"
            : "rounded-md border border-zinc-300 bg-white px-3 py-2 focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500 dark:border-zinc-700",
        )}
        {...inputProps}
      />
    </div>
  );
}
