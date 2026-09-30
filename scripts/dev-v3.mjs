// Avvia il dev server HTTPS con le variabili dell'ambiente v3 (.env.v3.local).
// Le variabili già presenti in process.env hanno la precedenza su .env.local,
// quindi il Supabase v3 sostituisce quello di sviluppo.
import { spawn } from "node:child_process";

process.loadEnvFile(".env.v3.local");

const child = spawn(
  process.execPath,
  [
    "node_modules/next/dist/bin/next",
    "dev",
    "--experimental-https",
    "--experimental-https-key",
    "./certificates/localhost-key.pem",
    "--experimental-https-cert",
    "./certificates/localhost.pem",
  ],
  { stdio: "inherit", env: process.env },
);

child.on("exit", (code) => process.exit(code ?? 0));
for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => child.kill(signal));
}
