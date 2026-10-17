import Link from "next/link";
import { BrandLockup } from "@/components/layout/BrandLockup";

/**
 * Shell condivisa da login/registrazione/verifica account/password
 * dimenticata: sfondo e "bolla" decorativa come nella homepage (v.
 * app/page.tsx), il contenuto di ogni pagina dentro una card bianca ---
 * coerente con lo stesso linguaggio visivo del resto dell'app, invece
 * di restare a galleggiare nudo sullo sfondo come prima.
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex min-h-screen flex-1 flex-col items-center justify-center overflow-hidden bg-background px-6 py-12">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-40 -top-40 h-[520px] w-[520px] rounded-full"
        style={{
          background: "radial-gradient(circle, rgba(31,175,149,0.16) 0%, rgba(31,175,149,0) 70%)",
        }}
      />

      <Link href="/" className="relative mb-8 w-full max-w-sm">
        <BrandLockup className="h-auto w-full" darkSize="lg" />
      </Link>
      <div className="relative w-full max-w-sm rounded-card border border-zinc-200 bg-white p-8 shadow-[0_8px_20px_rgba(16,24,40,0.04)] dark:border-zinc-800 dark:bg-zinc-950">
        {children}
      </div>
    </div>
  );
}
