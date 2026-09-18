import { expect, test } from "./fixtures";
import { createConfirmedTestUser, uniqueTestUser } from "./test-users";

// Requires a configured Supabase project (.env.local) --- see README.md.
//
// FASE 17c --- la prova che conta per l'OCR: una foto caricata
// dall'interfaccia vera, con Tesseract che gira nel browser (Web Worker,
// WebAssembly e modello linguistico serviti da noi --- percorso che
// nessun test unitario può esercitare), e parole che esistono SOLO
// dentro l'immagine. Se la ricerca le trova, l'intera catena ha
// funzionato: lettura, cifratura, salvataggio, rilettura, decifratura.
//
// L'immagine è un file fisso in fixtures/ e non generato qui: l'OCR è
// sensibile a come il testo è disegnato, e un test che cambia immagine a
// ogni esecuzione fallirebbe per motivi che non c'entrano con Hinthial.

const MASTER_PASSWORD = "una-master-password-solida";

test("la ricerca in Archivio trova una foto per una parola scritta dentro l'immagine", async ({
  page,
}) => {
  // Il primo OCR scarica il motore (qualche megabyte) e poi legge
  // l'immagine: sul CI può richiedere parecchio più del solito.
  test.setTimeout(180_000);

  const user = uniqueTestUser();
  await createConfirmedTestUser(user);

  await page.goto("/login");
  await page.getByLabel("Email").fill(user.email);
  await page.getByLabel("Password").fill(user.password);
  await page.getByRole("button", { name: "Accedi" }).click();
  await expect(page).toHaveURL(/\/dashboard$/, { timeout: 15_000 });

  await page.getByRole("link", { name: "Archivio", exact: true }).click();
  await page.getByLabel("Master password", { exact: true }).fill(MASTER_PASSWORD);
  await page.getByLabel("Conferma master password").fill(MASTER_PASSWORD);
  await page.getByRole("button", { name: "Crea" }).click();
  await expect(page.getByLabel("Ho salvato la recovery key in un posto sicuro.")).toBeVisible({
    timeout: 45_000,
  });
  await page.getByLabel("Ho salvato la recovery key in un posto sicuro.").check();
  await page.getByRole("button", { name: "Continua" }).click();
  await expect(page.getByRole("heading", { name: "Archivio" })).toBeVisible();

  // Il nome del file non dice nulla --- è quello che esce da uno
  // smartphone. Tutto ciò che serve a ritrovarlo è dentro i pixel.
  await page.getByRole("link", { name: "+ Aggiungi contenuto" }).click();
  await page.setInputFiles('input[type="file"]', "tests/e2e/fixtures/ocr-referto.png");

  // L'avviso compare appena si sceglie un'immagine: l'attesa va
  // annunciata prima, non scoperta dopo (v. FASE 17c).
  await expect(page.getByText(/leggerà il testo scritto dentro l'immagine/)).toBeVisible();

  await page.getByRole("button", { name: "Aggiungi all'archivio" }).click();

  // Durante la lettura il pulsante dice cosa sta facendo, e sull'OCR
  // anche a che punto è.
  await expect(page.getByRole("button", { name: /Sto leggendo l'immagine/ })).toBeVisible({
    timeout: 30_000,
  });

  await expect(page).toHaveURL(/\/archive$/, { timeout: 150_000 });
  await expect(page.getByText("ocr-referto.png")).toBeVisible({ timeout: 20_000 });

  // "Sassoferrato" non compare né nel nome, né nei tag, né nelle note:
  // solo dentro l'immagine.
  await page
    .getByPlaceholder("Cerca per nome, tag, note o dentro i documenti…")
    .fill("Sassoferrato");
  await expect(page.getByText("ocr-referto.png")).toBeVisible();

  // E il risultato spiega perché è comparso, con la parola evidenziata
  // nello spezzone (FASE 17b).
  await expect(page.locator("mark").first()).toHaveText("Sassoferrato");

  // Una parola che nell'immagine non c'è non deve trovare nulla:
  // altrimenti il test passerebbe anche con una ricerca rotta.
  await page.getByPlaceholder("Cerca per nome, tag, note o dentro i documenti…").fill("ortopedia");
  await expect(page.getByText("ocr-referto.png")).not.toBeVisible();
});

// FASE 17d --- il caso che conta di più nella pratica: un PDF che è solo
// la fotografia di un foglio. Referti, atti, tutto ciò che passa da uno
// sportello. pdf.js non ci trova una sola parola: il testo esiste solo
// nei pixel, e va disegnata la pagina per poterla leggere.
//
// La fixture è un PDF con dentro un unico JPEG e **nessun livello di
// testo** --- verificato: `getTextContent()` su quella pagina
// restituisce la stringa vuota. Se la ricerca trova una parola scritta
// lì dentro, l'ha letta l'OCR e non pdf.js.
test("la ricerca in Archivio trova un PDF scansionato, che di testo non ne ha", async ({
  page,
}) => {
  test.setTimeout(180_000);

  const user = uniqueTestUser();
  await createConfirmedTestUser(user);

  await page.goto("/login");
  await page.getByLabel("Email").fill(user.email);
  await page.getByLabel("Password").fill(user.password);
  await page.getByRole("button", { name: "Accedi" }).click();
  await expect(page).toHaveURL(/\/dashboard$/, { timeout: 15_000 });

  await page.getByRole("link", { name: "Archivio", exact: true }).click();
  await page.getByLabel("Master password", { exact: true }).fill(MASTER_PASSWORD);
  await page.getByLabel("Conferma master password").fill(MASTER_PASSWORD);
  await page.getByRole("button", { name: "Crea" }).click();
  await expect(page.getByLabel("Ho salvato la recovery key in un posto sicuro.")).toBeVisible({
    timeout: 45_000,
  });
  await page.getByLabel("Ho salvato la recovery key in un posto sicuro.").check();
  await page.getByRole("button", { name: "Continua" }).click();
  await expect(page.getByRole("heading", { name: "Archivio" })).toBeVisible();

  await page.getByRole("link", { name: "+ Aggiungi contenuto" }).click();
  await page.setInputFiles('input[type="file"]', "tests/e2e/fixtures/ocr-scansione.pdf");
  await page.getByRole("button", { name: "Aggiungi all'archivio" }).click();

  await expect(page).toHaveURL(/\/archive$/, { timeout: 150_000 });
  await expect(page.getByText("ocr-scansione.pdf")).toBeVisible({ timeout: 20_000 });

  // "Gubbio" sta solo dentro l'immagine scansionata.
  await page.getByPlaceholder("Cerca per nome, tag, note o dentro i documenti…").fill("Gubbio");
  await expect(page.getByText("ocr-scansione.pdf")).toBeVisible();
  // Maiuscolo: nell'intestazione scansionata c'è scritto "GUBBIO", e lo
  // spezzone conserva la forma del testo e non quella digitata (FASE 17b).
  await expect(page.locator("mark").first()).toHaveText("GUBBIO");

  await page.getByPlaceholder("Cerca per nome, tag, note o dentro i documenti…").fill("ortopedia");
  await expect(page.getByText("ocr-scansione.pdf")).not.toBeVisible();
});
