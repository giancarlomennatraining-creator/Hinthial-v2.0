import type { NextConfig } from "next";

/**
 * Gli header di sicurezza uguali per ogni risposta. La Content-Security-Policy no: ha un nonce diverso a ogni richiesta e
 * la mette proxy.ts (v. lib/security/csp.ts).
 */
const SECURITY_HEADERS = [
  // Nessun sito può mostrare Hinthial dentro un proprio riquadro (clickjacking); la CSP lo dice anche con frame-ancestors.
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Fotocamera e microfono servono a registrare capsule e racconti; il resto non serve a nulla, quindi è spento.
  {
    key: "Permissions-Policy",
    value: "camera=(self), microphone=(self), geolocation=(), payment=(), usb=(), display-capture=()",
  },
  // Solo in produzione su Vercel: in locale un HSTS ricordato dal browser impedirebbe poi di aprire http://localhost.
  ...(process.env.VERCEL_ENV === "production"
    ? [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" }]
    : []),
];

const nextConfig: NextConfig = {
  // Permette di aprire il dev server (es. http://192.168.0.180:3000) da
  // altri dispositivi sulla stessa rete locale --- per default Next.js
  // blocca le richieste cross-origin alle risorse di sviluppo (HMR, RSC)
  // che non arrivano da "localhost". Wildcard sull'ultimo ottetto: l'IP
  // di questo PC sulla LAN può cambiare (DHCP) da un riavvio all'altro.
  allowedDevOrigins: ["192.168.0.*"],
  async headers() {
    return [{ source: "/(.*)", headers: SECURITY_HEADERS }];
  },
};

export default nextConfig;
