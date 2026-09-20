import { expect, test } from "./fixtures";
import { createConfirmedTestUser, resetDocumentExtraction, uniqueTestUser } from "./test-users";

// Requires a configured Supabase project (.env.local) --- see README.md.
//
// FASE 17e --- la scheda di un contenuto d'Archivio: l'unico posto in cui
// l'utente vede cosa Hinthial ha letto dentro un suo file. Quello che
// conta qui non è il layout, è che il testo mostrato sia davvero quello
// estratto dal contenuto (letto, cifrato, riletto, decifrato) e che i
// quattro stati di lettura raccontino la verità.

const MASTER_PASSWORD = "una-master-password-solida";

/** PDF minimo valido con due righe di testo --- v. archive-search-inside-pdf. */
function buildPdf(lines: string[]): Buffer {
  const stream = lines
    .map((line, i) => `BT /F1 12 Tf 72 ${720 - i * 20} Td (${line}) Tj ET`)
    .join("\n");
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];

  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [];
  objects.forEach((body, i) => {
    offsets.push(pdf.length);
    pdf += `${i + 1} 0 obj\n${body}\nendobj\n`;
  });

  const xrefStart = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets) {
    pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF\n`;

  return Buffer.from(pdf, "latin1");
}

async function signInAndSetUpVault(page: import("@playwright/test").Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
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
}

test("la scheda di un documento mostra il testo che Hinthial ci ha letto dentro", async ({
  page,
}) => {
  test.slow();

  const user = uniqueTestUser();
  await createConfirmedTestUser(user);
  await signInAndSetUpVault(page, user.email, user.password);

  await page.getByRole("link", { name: "+ Aggiungi contenuto" }).click();
  await page.setInputFiles('input[type="file"]', {
    name: "referto.pdf",
    mimeType: "application/pdf",
    buffer: buildPdf([
      "Azienda Ospedaliera di Perugia",
      "Referto di visita cardiologica",
      "Paziente: Ada Lovelace",
    ]),
  });
  await page.getByRole("button", { name: "Aggiungi all'archivio" }).click();
  await expect(page).toHaveURL(/\/archive$/, { timeout: 30_000 });

  // Si arriva alla scheda dal nome nell'elenco --- è l'unica strada
  // offerta all'utente, e deve funzionare.
  await page.getByRole("link", { name: /referto\.pdf/ }).click();
  await expect(page).toHaveURL(/\/archive\/[0-9a-f-]+$/, { timeout: 15_000 });
  await expect(page.getByRole("heading", { name: /referto\.pdf/ })).toBeVisible();

  // Il cuore della pagina: cosa ha letto.
  const extracted = page.getByTestId("extracted-text");
  await expect(extracted).toContainText("Azienda Ospedaliera di Perugia");
  await expect(extracted).toContainText("Paziente: Ada Lovelace");

  // FASE 17e --- l'impaginazione è conservata: prima della modifica a
  // normalizeExtractedText le tre righe sarebbero arrivate qui come un
  // periodo unico. Si verifica sul testo vero, non sul CSS.
  const text = (await extracted.textContent()) ?? "";
  expect(text).toContain("Azienda Ospedaliera di Perugia\nReferto di visita cardiologica");

  // La promessa dichiarata sulla pagina stessa.
  await expect(page.getByText(/non è mai uscito/)).toBeVisible();

  // FASE 17e --- l'anteprima: la prima pagina del PDF. Un PDF non si può
  // mostrare com'è, e il messaggio di ripiego ("usa Scarica") non deve
  // comparire. Dalla miniatura (v. lib/thumbnail.ts): un documento
  // appena caricato ne ha già una, e la didascalia col numero di pagine
  // --- che solo il file intero porta con sé --- non compare (v.
  // archive-thumbnails.spec.ts per il percorso dedicato).
  await expect(page.getByRole("img", { name: /Prima pagina di referto\.pdf/ })).toBeVisible({
    timeout: 30_000,
  });
  await expect(
    page.getByText("Anteprima. Usa «Scarica» per l'originale, pagina per pagina."),
  ).toBeVisible();
});

// FASE 18 --- dal testo ai campi. Il documento è la scansione: nessun
// livello di testo, quindi tutto ciò che compare qui è passato per OCR e
// poi per il riconoscimento degli schemi. Se funziona su questo, la
// catena regge per intero.
test("la scheda ricava data, emittente e scadenza dal testo del documento", async ({ page }) => {
  test.setTimeout(180_000);

  const user = uniqueTestUser();
  await createConfirmedTestUser(user);
  await signInAndSetUpVault(page, user.email, user.password);

  await page.getByRole("link", { name: "+ Aggiungi contenuto" }).click();
  await page.setInputFiles('input[type="file"]', "tests/e2e/fixtures/ocr-scansione.pdf");
  await page.getByRole("button", { name: "Aggiungi all'archivio" }).click();
  await expect(page).toHaveURL(/\/archive$/, { timeout: 150_000 });

  await page.getByRole("link", { name: /ocr-scansione\.pdf/ }).click();

  const ricavato = page.getByRole("region", { name: "Cosa ne ho ricavato" });
  await expect(ricavato).toBeVisible({ timeout: 30_000 });

  // "AZIENDA OSPEDALIERA DI GUBBIO" è l'intestazione, non il titolo del
  // documento ("Referto di esame istologico", che deve essere scartato).
  await expect(ricavato).toContainText("AZIENDA OSPEDALIERA DI GUBBIO");
  await expect(ricavato).toContainText("14 mar 2026");

  // La scadenza non è scritta da nessuna parte sul foglio: viene da
  // "Si consiglia controllo tra dodici mesi" più la data del prelievo.
  // Dalla FASE 19 vive fra le proposte, non qui: un campo che aspetta
  // una risposta non si mostra anche come semplice informazione.
  const proposte = page.getByRole("region", { name: "Proposte" });
  await expect(proposte).toContainText("14 mar 2027");
  await expect(proposte).toContainText("calcolata da Hinthial");
  await expect(ricavato).not.toContainText("14 mar 2027");

  // E soprattutto: non ha scritto niente: la scheda resta vuota.
  await expect(ricavato).toContainText("non ho cambiato niente");
  const scheda = page.getByRole("region", { name: "Scheda" });
  await expect(scheda).not.toContainText("2027");
});

test("la scheda dice quando un contenuto non è ancora stato letto, e lo legge", async ({
  page,
}) => {
  test.slow();

  const user = uniqueTestUser();
  await createConfirmedTestUser(user);
  await signInAndSetUpVault(page, user.email, user.password);

  await page.getByRole("link", { name: "+ Aggiungi contenuto" }).click();
  await page.setInputFiles('input[type="file"]', {
    name: "vecchio.pdf",
    mimeType: "application/pdf",
    buffer: buildPdf(["Contratto di locazione", "via Manzoni 4 Milano"]),
  });
  await page.getByRole("button", { name: "Aggiungi all'archivio" }).click();
  await expect(page).toHaveURL(/\/archive$/, { timeout: 30_000 });

  // Si riporta il documento allo stato "mai letto", come lo sarebbe se
  // fosse stato caricato prima che l'estrazione esistesse.
  await resetDocumentExtraction(user.email);
  await page.reload();
  await page.getByLabel("Master password", { exact: true }).fill(MASTER_PASSWORD);
  await page.getByRole("button", { name: "Sblocca", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Archivio" })).toBeVisible({ timeout: 30_000 });

  await page.getByRole("link", { name: /vecchio\.pdf/ }).click();
  await expect(page.getByRole("heading", { name: /vecchio\.pdf/ })).toBeVisible({ timeout: 15_000 });

  // Lo stato "mai letto" è dichiarato, non dedotto da un riquadro vuoto.
  await expect(page.getByText(/Non l'ho ancora letto/)).toBeVisible();
  await expect(page.getByTestId("extracted-text")).toHaveCount(0);

  // E da qui lo si fa leggere, senza tornare all'elenco.
  await page.getByRole("button", { name: "Leggilo ora" }).click();
  await expect(page.getByTestId("extracted-text")).toContainText("via Manzoni 4 Milano", {
    timeout: 60_000,
  });
  await expect(page.getByText(/Non l'ho ancora letto/)).not.toBeVisible();
});
