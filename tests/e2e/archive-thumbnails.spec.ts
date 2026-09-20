import { expect, test } from "./fixtures";
import { createConfirmedTestUser, resetDocumentExtraction, uniqueTestUser } from "./test-users";

// Requires a configured Supabase project (.env.local) --- see README.md.
//
// Miniature delle anteprime --- nascono per un motivo di banda: senza,
// aprire la scheda di un contenuto ne riscaricava il file **intero**
// solo per costruirne l'anteprima --- su una scansione da 15 MB, ogni
// apertura. Quello che conta qui non è che l'anteprima compaia (già
// provato in archive-item-detail.spec.ts), ma **da dove viene**: questi
// test distinguono i due percorsi dalla didascalia che la scheda
// mostra, perché solo il file intero porta con sé il numero di pagine
// di un PDF (v. ArchiveItemDetail.tsx, `previewIsThumbnail`).

const MASTER_PASSWORD = "una-master-password-solida";

/** PDF minimo valido con due righe di testo --- v. archive-item-detail. */
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

test("l'anteprima di un PDF appena caricato viene dalla miniatura, non dal file intero", async ({
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
    buffer: buildPdf(["Referto di visita cardiologica", "Paziente: Ada Lovelace"]),
  });
  await page.getByRole("button", { name: "Aggiungi all'archivio" }).click();
  await expect(page).toHaveURL(/\/archive$/, { timeout: 30_000 });

  await page.getByRole("link", { name: /referto\.pdf/ }).click();
  await expect(page.getByRole("heading", { name: /referto\.pdf/ })).toBeVisible({ timeout: 15_000 });

  // Solo il percorso "file intero" conosce il numero di pagine: se la
  // didascalia lo riporta, la miniatura non è stata usata.
  await expect(
    page.getByText("Anteprima. Usa «Scarica» per l'originale, pagina per pagina."),
  ).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText(/Pagina unica\.|Prima pagina di \d/)).not.toBeVisible();
  await expect(page.getByRole("img", { name: /referto\.pdf/ })).toBeVisible();
});

test("l'anteprima di una foto appena caricata viene dalla miniatura", async ({ page }) => {
  test.slow();

  const user = uniqueTestUser();
  await createConfirmedTestUser(user);
  await signInAndSetUpVault(page, user.email, user.password);

  await page.getByRole("link", { name: "+ Aggiungi contenuto" }).click();
  await page.setInputFiles('input[type="file"]', "tests/e2e/fixtures/ocr-referto.png");
  await page.getByRole("button", { name: "Aggiungi all'archivio" }).click();
  await expect(page).toHaveURL(/\/archive$/, { timeout: 60_000 });

  await page.getByRole("link", { name: /ocr-referto\.png/ }).click();
  await expect(page.getByRole("heading", { name: /ocr-referto\.png/ })).toBeVisible({
    timeout: 15_000,
  });

  // Per un'immagine la didascalia non parla di pagine --- è la stessa
  // usata per un PDF, meno il pezzo che non le riguarda.
  await expect(page.getByText("Anteprima. Usa «Scarica» per l'originale.", { exact: true })).toBeVisible(
    { timeout: 20_000 },
  );
});

test("un contenuto caricato prima delle miniature la ricava rileggendolo, e la volta dopo la usa", async ({
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

  // Si riporta il documento allo stato precedente a questa fase: niente
  // testo estratto, e --- da qui in avanti --- niente miniatura (v.
  // test-users.ts, resetDocumentExtraction).
  await resetDocumentExtraction(user.email);
  await page.reload();
  await page.getByLabel("Master password", { exact: true }).fill(MASTER_PASSWORD);
  await page.getByRole("button", { name: "Sblocca", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Archivio" })).toBeVisible({ timeout: 30_000 });

  await page.getByRole("link", { name: /vecchio\.pdf/ }).click();
  await expect(page.getByRole("heading", { name: /vecchio\.pdf/ })).toBeVisible({ timeout: 15_000 });

  // Prima del recupero: nessuna miniatura, quindi l'anteprima viene dal
  // file intero --- lo prova la didascalia col numero di pagine.
  await expect(page.getByText(/Pagina unica\./)).toBeVisible({ timeout: 20_000 });

  // "Leggilo ora" rilegge il testo e, con gli stessi byte già in
  // chiaro, genera anche la miniatura che a suo tempo non c'era.
  await page.getByRole("button", { name: "Leggilo ora" }).click();
  await expect(page.getByTestId("extracted-text")).toContainText("via Manzoni 4 Milano", {
    timeout: 60_000,
  });

  // La volta successiva --- qui simulata da un ricaricamento della
  // pagina --- la scheda trova la miniatura e non riscarica più il file
  // intero solo per l'anteprima.
  await page.reload();
  await page.getByLabel("Master password", { exact: true }).fill(MASTER_PASSWORD);
  await page.getByRole("button", { name: "Sblocca", exact: true }).click();
  await expect(
    page.getByText("Anteprima. Usa «Scarica» per l'originale, pagina per pagina."),
  ).toBeVisible({ timeout: 20_000 });
});
