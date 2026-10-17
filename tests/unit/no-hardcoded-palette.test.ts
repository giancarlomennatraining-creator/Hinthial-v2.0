import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * I colori dell'interfaccia sono gettoni (v. globals.css: le scale `zinc-*` e `brand` leggono le variabili dello stile
 * attivo). Un esadecimale nella classe di un componente non cambia con lo stile (Foglia, Notte, Luce) né col tema
 * scuro: questo controllo ferma il ritorno dei vecchi colori fissi "Fresh Clarity" (il blu #2b4fc4 e i suoi grigi
 * azzurrati) scritti nelle classi Tailwind. I colori semantici (verde ok, rosso errore, ambra avviso) e quelli scelti
 * dall'utente (categorie) non sono in questo elenco.
 */
const RETIRED = [
  "2b4fc4",
  "5b6483",
  "121a35",
  "8a91ad",
  "3d4670",
  "4a5275",
  "dfe3f0",
  "c9d0e6",
  "eef0f8",
  "eceff4",
  "f3f6ff",
  "f1f5ff",
  "f7fafb",
  "e8edfc",
  "d9e2fb",
  "9db6ff",
  "9aa1bd",
];
const CLASS_HEX = new RegExp(
  `(?:text|bg|border|ring|outline|fill|stroke|from|to|via|divide|decoration)-\\[#(?:${RETIRED.join("|")})\\]`,
  "i",
);

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.(tsx|ts)$/.test(name) ? [path] : [];
  });
}

describe("colori scritti a mano nelle classi", () => {
  it("nessun componente usa un esadecimale dei vecchi colori fissi in una classe Tailwind", () => {
    const offenders: string[] = [];
    for (const file of sourceFiles(join(process.cwd(), "src"))) {
      readFileSync(file, "utf8")
        .split(/\r?\n/)
        .forEach((line, i) => {
          const match = CLASS_HEX.exec(line);
          if (match) offenders.push(`${relative(process.cwd(), file).split("\\").join("/")}:${i + 1} ${match[0]}`);
        });
    }
    expect(offenders, "Usa i gettoni (zinc-*, brand, accent, title) al posto di un esadecimale: v. globals.css").toEqual([]);
  });

  it("nessun testo è scritto in zinc-400 (chiaro) o zinc-600 (scuro): sotto il contrasto minimo di 4,5 a 1", () => {
    // Nei tre stili `zinc-400` in chiaro e `zinc-600` in scuro sono grigi da bordo o da icona, non da testo. Per il testo
    // meno importante c'è `zinc-500`. Le icone decorative (aria-hidden) e i bordi possono usarli: v. le eccezioni.
    const FAINT = /(?<![\w:-])text-zinc-400(?![\w-])|dark:text-zinc-600(?![\w-])/;
    const offenders: string[] = [];
    for (const file of sourceFiles(join(process.cwd(), "src"))) {
      readFileSync(file, "utf8")
        .split(/\r?\n/)
        .forEach((line, i) => {
          if (FAINT.test(line) && !line.includes("aria-hidden")) {
            offenders.push(`${relative(process.cwd(), file).split("\\").join("/")}:${i + 1}`);
          }
        });
    }
    expect(offenders, "Per il testo usa text-zinc-500 (in scuro dark:text-zinc-400)").toEqual([]);
  });
});
