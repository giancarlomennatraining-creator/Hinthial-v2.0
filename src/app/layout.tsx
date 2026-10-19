import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import { Baloo_2, Caveat, Geist_Mono, Manrope, Work_Sans } from "next/font/google";
import Script from "next/script";
import { ErrorReporter } from "@/components/errors/ErrorReporter";
import { AppIntro } from "@/components/layout/AppIntro";
import { INTRO_INIT_SCRIPT } from "@/lib/app-intro";
import "./globals.css";

/** Applica il tema chiaro/scuro/sistema e lo stile (v. lib/theme.ts) prima del primo paint: deve restare uno script inline autonomo, gira prima che qualunque modulo dell'app sia caricato. */
const THEME_INIT_SCRIPT = `
(function () {
  try {
    var stored = localStorage.getItem("hinthial-theme");
    var isDark =
      stored === "dark" ||
      (stored !== "light" && window.matchMedia("(prefers-color-scheme: dark)").matches);
    if (isDark) document.documentElement.classList.add("dark");
    var style = localStorage.getItem("hinthial-stile");
    document.documentElement.setAttribute("data-stile", style === "notte" || style === "luce" ? style : "foglia");
  } catch (e) {}
})();
`;

/** Registra il service worker minimo (v. public/sw.js), solo dopo che la pagina è interattiva. Il controllo `"serviceWorker" in navigator` è nello script stesso, che gira lato client puro. */
const SW_REGISTER_SCRIPT = `
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("/sw.js").catch(function () {});
}
`;

// Manrope per i titoli, Work Sans per il resto, Geist Mono solo per gli snippet di codice (recovery/MFA).
const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
  weight: ["500", "700", "800"],
});

// Baloo 2, lo stesso carattere della scritta "Hinthial" nel logo, riservato al solo titolo di pagina per farlo risaltare come un'estensione del logo.
const baloo2 = Baloo_2({
  variable: "--font-baloo",
  subsets: ["latin"],
  weight: ["700", "800"],
});

const workSans = Work_Sans({
  variable: "--font-work-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

/** Caveat, lo stile "a mano" opzionale per il testo di una capsula, mai imposto. Solo il peso 600: l'unico usato. */
const caveat = Caveat({
  variable: "--font-caveat",
  subsets: ["latin"],
  weight: ["600"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "HINTHIAL",
  description:
    "Ciò che sai e ciò che hai, alla persona giusta, al momento giusto. Ricordi, documenti e istruzioni cifrati sul tuo dispositivo, consegnati a chi scegli tu.",
};

/** Colore della barra di stato/degli strumenti del browser quando Hinthial è installata (v. manifest.ts, stesso blu). */
export const viewport: Viewport = {
  themeColor: "#1d7a4a",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  // Il nonce della CSP (v. proxy.ts): senza, i due script inline qui sotto sarebbero bloccati. Leggere gli header rende
  // ogni pagina dinamica, ed è voluto: un nonce vale per una sola richiesta.
  const nonce = (await headers()).get("x-nonce") ?? undefined;

  return (
    <html
      lang="it"
      suppressHydrationWarning
      className={`${manrope.variable} ${workSans.variable} ${geistMono.variable} ${baloo2.variable} ${caveat.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <Script id="theme-init" strategy="beforeInteractive" nonce={nonce}>
          {THEME_INIT_SCRIPT}
        </Script>
        {/* L'entrata animata della prima apertura (v. lib/app-intro.ts): lo script decide prima del primo paint, il velo è CSS. */}
        <Script id="intro-init" strategy="beforeInteractive" nonce={nonce}>
          {INTRO_INIT_SCRIPT}
        </Script>
        <AppIntro />
        <ErrorReporter />
        {children}
        <Script id="sw-register" strategy="afterInteractive" nonce={nonce}>
          {SW_REGISTER_SCRIPT}
        </Script>
      </body>
    </html>
  );
}
