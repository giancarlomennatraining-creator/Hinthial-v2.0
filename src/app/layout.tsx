import type { Metadata } from "next";
import { Geist_Mono, Manrope, Work_Sans } from "next/font/google";
import Script from "next/script";
import "./globals.css";

/**
 * Applica il tema chiaro/scuro/sistema (v. lib/theme.ts) prima del primo
 * paint --- deve restare uno script inline autonomo (non può importare
 * lib/theme.ts: gira prima che qualunque modulo dell'app sia caricato).
 * La chiave di storage ("hinthial-theme") è duplicata qui di proposito.
 */
const THEME_INIT_SCRIPT = `
(function () {
  try {
    var stored = localStorage.getItem("hinthial-theme");
    var isDark =
      stored === "dark" ||
      (stored !== "light" && window.matchMedia("(prefers-color-scheme: dark)").matches);
    if (isDark) document.documentElement.classList.add("dark");
  } catch (e) {}
})();
`;

/*
 * Font della direzione visiva "Fresh Clarity" (v. mockup condiviso con
 * l'utente): Manrope per i titoli, Work Sans per il resto --- Geist Mono
 * resta solo per gli sniplet di codice (font-mono, es. codice di
 * recovery/MFA).
 */
const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
  weight: ["500", "700", "800"],
});

const workSans = Work_Sans({
  variable: "--font-work-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "HINTHIAL",
  description:
    "Metti ordine nella tua vita digitale, proteggi ciò che conta e rendi le informazioni importanti accessibili alle persone giuste quando serve.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="it"
      suppressHydrationWarning
      className={`${manrope.variable} ${workSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <Script id="theme-init" strategy="beforeInteractive">
          {THEME_INIT_SCRIPT}
        </Script>
        {children}
      </body>
    </html>
  );
}
