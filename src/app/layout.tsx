import type { Metadata, Viewport } from "next";
import { Baloo_2, Caveat, Geist_Mono, Manrope, Work_Sans } from "next/font/google";
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

/**
 * Registra il service worker minimo (v. public/sw.js) --- non serve
 * prima del primo paint come lo script sopra, solo dopo che la pagina è
 * interattiva. `navigator.serviceWorker` non esiste su ogni browser
 * (es. contesti senza HTTPS): il controllo è nello script stesso, non
 * qui, perché questo gira lato client puro.
 */
const SW_REGISTER_SCRIPT = `
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("/sw.js").catch(function () {});
}
`;

/**
 * DIAGNOSTICA TEMPORANEA --- da togliere non appena trovata la causa del
 * menu che non risponde subito dopo il login su alcuni dispositivi (v.
 * conversazione). Uno script puro (non un componente React): se il
 * problema è proprio che l'idratazione di React fallisce/non si aggancia
 * su quel primo caricamento, un componente React per catturare l'errore
 * avrebbe lo stesso identico problema. Cattura errori globali,
 * unhandledrejection e console.error, e li scrive in un banner in cima
 * allo schermo --- niente da collegare, visibile direttamente sul
 * dispositivo che manifesta il problema.
 */
const DEBUG_OVERLAY_SCRIPT = `
(function () {
  var box = null;
  function ensureBox() {
    if (box) return box;
    box = document.createElement("div");
    box.id = "__hinthial_debug_overlay__";
    box.style.cssText = "position:fixed;top:0;left:0;right:0;z-index:999999;background:#b91c1c;color:#fff;font:11px/1.4 monospace;padding:8px;max-height:45vh;overflow:auto;white-space:pre-wrap;";
    document.body.appendChild(box);
    return box;
  }
  function report(label, detail) {
    try {
      var b = ensureBox();
      var line = document.createElement("div");
      line.style.cssText = "border-top:1px solid rgba(255,255,255,0.3);padding-top:4px;margin-top:4px;";
      line.textContent = "[" + new Date().toLocaleTimeString() + "] " + label + ": " + detail;
      b.appendChild(line);
    } catch (e) {}
  }
  window.addEventListener("error", function (e) {
    report("error", (e.message || "") + " @ " + (e.filename || "") + ":" + (e.lineno || ""));
  });
  window.addEventListener("unhandledrejection", function (e) {
    var reason = e.reason;
    var msg = reason && reason.message ? reason.message : String(reason);
    report("unhandledrejection", msg);
  });
  var origError = console.error;
  console.error = function () {
    try {
      report("console.error", Array.prototype.slice.call(arguments).map(String).join(" "));
    } catch (e) {}
    return origError.apply(console, arguments);
  };
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

/*
 * Baloo 2 --- lo stesso carattere (identificato a occhio, l'SVG del logo
 * è un'immagine raster, non testo vero) usato per la scritta "Hinthial"
 * nel logo (v. public/brand/logo-lockup.svg): riservato al solo titolo
 * di pagina (<h1>, es. "Capsule", "Ciao, ...") per farlo risaltare come
 * un'estensione del logo --- Manrope resta per i titoli più piccoli
 * (card, sezioni).
 */
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

/**
 * Caveat --- lo stile "a mano" opzionale per il testo di una capsula
 * (v. CreateCapsuleForm/EditCapsuleForm/CapsulePreview): chi scrive può
 * scegliere questo font al posto di Work Sans per il proprio messaggio,
 * mai imposto. Solo il peso 600: è l'unico usato (niente normale/400,
 * che il browser sostituirebbe comunque col peso più vicino caricato).
 */
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
        {/* DIAGNOSTICA TEMPORANEA --- v. commento su DEBUG_OVERLAY_SCRIPT. Da togliere insieme allo script sopra. */}
        <Script id="debug-overlay" strategy="beforeInteractive">
          {DEBUG_OVERLAY_SCRIPT}
        </Script>
        {children}
        <Script id="sw-register" strategy="afterInteractive">
          {SW_REGISTER_SCRIPT}
        </Script>
      </body>
    </html>
  );
}
