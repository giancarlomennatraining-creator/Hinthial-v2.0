import type { MetadataRoute } from "next";

/**
 * Rende Hinthial installabile (v. richiesta utente) --- Next.js serve
 * questo file su /manifest.webmanifest e lo collega da sé nell'<head>,
 * nessun <link rel="manifest"> a mano. Le icone sono ricavate dal logo
 * (v. public/brand/logo.svg): "any" per i contesti che mostrano l'icona
 * così com'è, "maskable" per Android, che la ritaglia con una propria
 * maschera --- da qui il margine extra e lo sfondo blu pieno su quelle.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Hinthial",
    short_name: "Hinthial",
    description:
      "Metti ordine nella tua vita digitale, proteggi ciò che conta e rendi le informazioni importanti accessibili alle persone giuste quando serve.",
    start_url: "/dashboard",
    display: "standalone",
    background_color: "#f7fafb",
    theme_color: "#2b4fc4",
    lang: "it",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
