import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Permette di aprire il dev server (es. http://192.168.0.180:3000) da
  // altri dispositivi sulla stessa rete locale --- per default Next.js
  // blocca le richieste cross-origin alle risorse di sviluppo (HMR, RSC)
  // che non arrivano da "localhost". Wildcard sull'ultimo ottetto: l'IP
  // di questo PC sulla LAN può cambiare (DHCP) da un riavvio all'altro.
  allowedDevOrigins: ["192.168.0.*"],
};

export default nextConfig;
