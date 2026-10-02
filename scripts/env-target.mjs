// Il dev server incorpora le variabili NEXT_PUBLIC_* nella cache di .next:
// passando da un ambiente all'altro (dev / v3) va svuotata, altrimenti resta
// la configurazione dell'ambiente precedente.
import fs from "node:fs";

const target = process.argv[2];
if (!target) {
  console.error("Uso: node scripts/env-target.mjs <dev|v3>");
  process.exit(1);
}

const marker = ".next/.env-target";
const current = fs.existsSync(marker) ? fs.readFileSync(marker, "utf8").trim() : null;

if (current !== target) {
  if (fs.existsSync(".next")) {
    console.log(`Ambiente cambiato (${current ?? "sconosciuto"} -> ${target}): svuoto .next`);
    fs.rmSync(".next", { recursive: true, force: true, maxRetries: 10, retryDelay: 300 });
  }
  fs.mkdirSync(".next", { recursive: true });
  fs.writeFileSync(marker, target);
}
