// FASE 17c --- copia in `public/ocr/` i file di cui l'OCR ha bisogno a
// runtime (motore WebAssembly, worker, modello linguistico).
//
// Perché non lasciarli scaricare dalla CDN, come farebbe tesseract.js da
// solo: il punto dell'estrazione locale è che **nulla lascia il
// dispositivo**. Il contenuto in effetti non uscirebbe comunque --- un
// modello linguistico è un file pubblico, uguale per tutti --- ma
// scaricarlo da jsdelivr significa dire a un terzo "questo utente, a
// quest'ora, sta leggendo un documento". È esattamente il tipo di
// informazione che Hinthial promette di non far uscire. In più, serviti
// da noi, funzionano anche offline e non dipendono da un dominio che
// domani potrebbe non esserci più.
//
// Non sono in git (v. .gitignore): sono ~5,7 MB di artefatti derivati da
// node_modules, che si rigenerano con una copia. Gira da sé prima di
// `dev`, `build` e dei test e2e (v. package.json, script `pre*`).

import { copyFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const from = (...parts) => resolve(root, "node_modules", ...parts);
const to = (...parts) => resolve(root, "public", "ocr", ...parts);

const ASSETS = [
  // Lo script che gira nel Web Worker: è lui a orchestrare il motore.
  [from("tesseract.js", "dist", "worker.min.js"), to("worker.min.js")],

  // Il motore vero e proprio. Si copia **una sola variante**, invece di
  // lasciare che tesseract.js scelga tra le sei disponibili: quella SIMD
  // e solo-LSTM. SIMD perché è supportata da ogni browser dal 2021 in
  // poi (e chi non ce l'ha non arriverebbe comunque fin qui: Hinthial
  // richiede Web Crypto e molto altro); solo-LSTM perché è il modello
  // che tesseract.js usa di default e l'unico che ci serve. Il `.wasm`
  // è incorporato dentro il `.js`, quindi questo file basta a sé.
  [
    from("tesseract.js-core", "tesseract-core-simd-lstm.wasm.js"),
    to("tesseract-core-simd-lstm.wasm.js"),
  ],

  // Il modello linguistico. Solo italiano: è la lingua dei documenti di
  // chi usa Hinthial, e ogni lingua in più è qualche megabyte in più da
  // scaricare la prima volta. Aggiungerne una è una riga qui e una in
  // domain/extraction/ocr-extractor.ts (OCR_LANGUAGES).
  // `4.0.0_best_int` è la variante compatta (1,6 MB invece di 6,9): la
  // stessa che tesseract.js scaricherebbe per conto suo.
  [
    from("@tesseract.js-data", "ita", "4.0.0_best_int", "ita.traineddata.gz"),
    to("lang", "ita.traineddata.gz"),
  ],
];

for (const [source, destination] of ASSETS) {
  await mkdir(dirname(destination), { recursive: true });
  await copyFile(source, destination);
}

console.log(`[ocr] ${ASSETS.length} file copiati in public/ocr/`);
