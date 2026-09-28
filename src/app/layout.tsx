import type { Metadata, Viewport } from "next";
import { Baloo_2, Caveat, Geist_Mono, Manrope, Work_Sans } from "next/font/google";
import Script from "next/script";
import "./globals.css";

/** Applica il tema chiaro/scuro/sistema (v. lib/theme.ts) prima del primo paint: deve restare uno script inline autonomo, gira prima che qualunque modulo dell'app sia caricato. */
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
    "Metti ordine nella tua vita digitale, proteggi ciò che conta e rendi le informazioni importanti accessibili alle persone giuste quando serve.",
};

/** Colore della barra di stato/degli strumenti del browser quando Hinthial è installata (v. manifest.ts, stesso blu). */
export const viewport: Viewport = {
  themeColor: "#2b4fc4",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="it"
      suppressHydrationWarning
      className={`${manrope.variable} ${workSans.variable} ${geistMono.variable} ${baloo2.variable} ${caveat.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <Script id="theme-init" strategy="beforeInteractive">
          {THEME_INIT_SCRIPT}
        </Script>
        {children}
        <Script id="sw-register" strategy="afterInteractive">
          {SW_REGISTER_SCRIPT}
        </Script>
      </body>
    </html>
  );
}
