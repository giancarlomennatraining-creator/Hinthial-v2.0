import { expect, test } from "./fixtures";
import { createConfirmedTestUser, uniqueTestUser } from "./test-users";

// Requires a configured Supabase project (.env.local) --- see README.md.
//
// La prova che conta per l'OCR: una foto caricata dall'interfaccia vera, con Tesseract che gira nel browser, e
// parole che esistono SOLO dentro l'immagine. Se la ricerca le trova, l'intera catena ha funzionato.
// L'immagine è un file fisso in fixtures/: l'OCR è sensibile a come il testo è disegnato, e un'immagine
// rigenerata a ogni esecuzione fallirebbe per motivi che non c'entrano con Hinthial.

const MASTER_PASSWORD = "una-master-password-solida";

test("la ricerca in Archivio trova una foto per una parola scritta dentro l'immagine", async ({
  page,
}) => {
  // Il primo OCR scarica il motore e poi legge l'immagine: sul CI può richiedere parecchio più del solito.
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

  // Il nome del file non dice nulla: tutto ciò che serve a ritrovarlo è dentro i pixel.
  await page.getByRole("button", { name: "+ Aggiungi contenuto" }).click();
  await page.getByRole("menuitem", { name: "Carica un file" }).click();
  // Il passo 1 non parte più su una modalità già scelta (v. feedback utente): va scelta esplicitamente.
  await page.getByRole("radio", { name: /Carica un file/ }).click();
  await page.setInputFiles('input[type="file"]', "tests/e2e/fixtures/ocr-referto.png");

  // L'avviso compare appena si sceglie un'immagine: l'attesa va annunciata prima, non scoperta dopo.
  await expect(page.getByText(/leggerà il testo scritto dentro l'immagine/)).toBeVisible();

  // La lettura parte qui, appena scelto il file, non al salvataggio: quando si preme "Aggiungi" ha già finito.
  await expect(page.getByText("Letto sul dispositivo")).toBeVisible({ timeout: 150_000 });

  await page.getByRole("button", { name: "Aggiungi all'archivio" }).click();
  await page.getByRole("link", { name: "Torna all'archivio", exact: true }).click();
  await expect(page).toHaveURL(/\/archive$/, { timeout: 150_000 });
  await expect(page.getByText("ocr-referto.png")).toBeVisible({ timeout: 20_000 });

  // "Sassoferrato" non compare né nel nome, né nei tag, né nelle note: solo dentro l'immagine.
  await page
    .getByPlaceholder("Cerca per nome, tag, note o dentro i documenti…")
    .fill("Sassoferrato");
  await expect(page.getByText("ocr-referto.png")).toBeVisible();

  // E il risultato spiega perché è comparso, con la parola evidenziata nello spezzone.
  await expect(page.locator("mark").first()).toHaveText("Sassoferrato");

  // Una parola che nell'immagine non c'è non deve trovare nulla: altrimenti il test passerebbe anche con una ricerca rotta.
  await page.getByPlaceholder("Cerca per nome, tag, note o dentro i documenti…").fill("ortopedia");
  await expect(page.getByText("ocr-referto.png")).not.toBeVisible();
});

// Il caso che conta di più nella pratica: un PDF che è solo la fotografia di un foglio. pdf.js non ci trova una
// sola parola: il testo esiste solo nei pixel. La fixture è un PDF con un unico JPEG e nessun livello di testo
// (verificato: `getTextContent()` restituisce stringa vuota). Se la ricerca trova qualcosa, l'ha letto l'OCR.
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

  await page.getByRole("button", { name: "+ Aggiungi contenuto" }).click();
  await page.getByRole("menuitem", { name: "Carica un file" }).click();
  // Il passo 1 non parte più su una modalità già scelta (v. feedback utente): va scelta esplicitamente.
  await page.getByRole("radio", { name: /Carica un file/ }).click();
  await page.setInputFiles('input[type="file"]', "tests/e2e/fixtures/ocr-scansione.pdf");
  await page.getByRole("button", { name: "Aggiungi all'archivio" }).click();
  await page.getByRole("link", { name: "Torna all'archivio", exact: true }).click();

  await expect(page).toHaveURL(/\/archive$/, { timeout: 150_000 });
  await expect(page.getByText("ocr-scansione.pdf")).toBeVisible({ timeout: 20_000 });

  // "Gubbio" sta solo dentro l'immagine scansionata.
  await page.getByPlaceholder("Cerca per nome, tag, note o dentro i documenti…").fill("Gubbio");
  await expect(page.getByText("ocr-scansione.pdf")).toBeVisible();
  // Maiuscolo: nell'intestazione scansionata c'è scritto "GUBBIO", e lo spezzone conserva la forma del testo, non quella digitata.
  await expect(page.locator("mark").first()).toHaveText("GUBBIO");

  await page.getByPlaceholder("Cerca per nome, tag, note o dentro i documenti…").fill("ortopedia");
  await expect(page.getByText("ocr-scansione.pdf")).not.toBeVisible();
});
