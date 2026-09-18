import { expect, test } from "./fixtures";
import { createConfirmedTestUser, resetDocumentExtraction, uniqueTestUser } from "./test-users";

// Requires a configured Supabase project (.env.local) --- see README.md.
//
// FASE 17 --- la prova che conta: un PDF caricato dall'interfaccia vera,
// con pdf.js che gira nel browser (worker incluso, percorso che i test
// unitari non possono esercitare), e una parola che esiste SOLO dentro
// il file. Se la ricerca la trova, l'estrazione ha funzionato, il testo
// è stato cifrato, salvato, riletto e decifrato.

/** PDF minimo valido con una riga di testo --- v. tests/unit/extraction. */
function buildPdf(text: string): Buffer {
  const stream = `BT /F1 12 Tf 72 720 Td (${text}) Tj ET`;
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

test("la ricerca in Archivio trova un PDF per una parola scritta solo dentro il file", async ({
  page,
}) => {
  test.slow();

  const user = uniqueTestUser();
  await createConfirmedTestUser(user);

  await page.goto("/login");
  await page.getByLabel("Email").fill(user.email);
  await page.getByLabel("Password").fill(user.password);
  await page.getByRole("button", { name: "Accedi" }).click();
  await expect(page).toHaveURL(/\/dashboard$/, { timeout: 15_000 });

  await page.getByRole("link", { name: "Archivio", exact: true }).click();
  await page.getByLabel("Master password", { exact: true }).fill("una-master-password-solida");
  await page.getByLabel("Conferma master password").fill("una-master-password-solida");
  await page.getByRole("button", { name: "Crea" }).click();
  await expect(
    page.getByLabel("Ho salvato la recovery key in un posto sicuro."),
  ).toBeVisible({ timeout: 45_000 });
  await page.getByLabel("Ho salvato la recovery key in un posto sicuro.").check();
  await page.getByRole("button", { name: "Continua" }).click();
  await expect(page.getByRole("heading", { name: "Archivio" })).toBeVisible();

  // Il nome del file non contiene "cardiologia": quella parola vive solo
  // dentro il PDF.
  await page.getByRole("link", { name: "+ Aggiungi contenuto" }).click();
  await page.setInputFiles('input[type="file"]', {
    name: "scan_0012.pdf",
    mimeType: "application/pdf",
    buffer: buildPdf("Referto visita cardiologia del 14 marzo 2026 - dott Ferrari"),
  });
  await page.getByRole("button", { name: "Aggiungi all'archivio" }).click();
  await expect(page).toHaveURL(/\/archive$/, { timeout: 30_000 });
  await expect(page.getByText("scan_0012.pdf")).toBeVisible({ timeout: 20_000 });

  // Prima della FASE 17 questa ricerca non avrebbe trovato nulla:
  // guardava solo nome, tag, note e trascrizione.
  await page.getByPlaceholder("Cerca per nome, tag, note o dentro i documenti…").fill("cardiologia");
  await expect(page.getByText("scan_0012.pdf")).toBeVisible();

  // Una parola che non compare da nessuna parte non deve trovare nulla:
  // altrimenti il test passerebbe anche con una ricerca rotta.
  await page.getByPlaceholder("Cerca per nome, tag, note o dentro i documenti…").fill("ortopedia");
  await expect(page.getByText("scan_0012.pdf")).not.toBeVisible();

  // FASE 17b --- il risultato spiega PERCHÉ è comparso: lo spezzone di
  // testo attorno alla parola trovata, che nel nome del file non c'è.
  await page.getByPlaceholder("Cerca per nome, tag, note o dentro i documenti…").fill("cardiologia");
  await expect(page.locator("mark").first()).toHaveText("cardiologia");
  await expect(page.getByText(/Referto visita/)).toBeVisible();

  // Cercando per NOME lo spezzone non serve: il motivo è già evidente.
  await page.getByPlaceholder("Cerca per nome, tag, note o dentro i documenti…").fill("scan_0012");
  await expect(page.getByText("scan_0012.pdf")).toBeVisible();
  await expect(page.locator("mark")).toHaveCount(0);

  // E lo stesso vale per la ricerca globale, che usa lo stesso motore.
  await page.getByPlaceholder("Cerca per nome, tag, note o dentro i documenti…").fill("");
  await page.keyboard.press("Control+KeyK");
  await page.getByPlaceholder(/Cerca/).last().fill("Ferrari");
  await expect(page.getByText("scan_0012.pdf").first()).toBeVisible({ timeout: 10_000 });
});

test("i documenti caricati prima della FASE 17 si recuperano dal banner in Archivio", async ({
  page,
}) => {
  test.slow();

  const user = uniqueTestUser();
  await createConfirmedTestUser(user);

  await page.goto("/login");
  await page.getByLabel("Email").fill(user.email);
  await page.getByLabel("Password").fill(user.password);
  await page.getByRole("button", { name: "Accedi" }).click();
  await expect(page).toHaveURL(/\/dashboard$/, { timeout: 15_000 });

  await page.getByRole("link", { name: "Archivio", exact: true }).click();
  await page.getByLabel("Master password", { exact: true }).fill("una-master-password-solida");
  await page.getByLabel("Conferma master password").fill("una-master-password-solida");
  await page.getByRole("button", { name: "Crea" }).click();
  await expect(
    page.getByLabel("Ho salvato la recovery key in un posto sicuro."),
  ).toBeVisible({ timeout: 45_000 });
  await page.getByLabel("Ho salvato la recovery key in un posto sicuro.").check();
  await page.getByRole("button", { name: "Continua" }).click();
  await expect(page.getByRole("heading", { name: "Archivio" })).toBeVisible();

  await page.getByRole("link", { name: "+ Aggiungi contenuto" }).click();
  await page.setInputFiles('input[type="file"]', {
    name: "vecchio.pdf",
    mimeType: "application/pdf",
    buffer: buildPdf("Contratto di locazione immobile via Manzoni 4 Milano"),
  });
  await page.getByRole("button", { name: "Aggiungi all'archivio" }).click();
  await expect(page).toHaveURL(/\/archive$/, { timeout: 30_000 });
  await expect(page.getByText("vecchio.pdf")).toBeVisible({ timeout: 20_000 });

  // Appena caricato è già stato letto, quindi nessun banner da mostrare.
  await expect(page.getByRole("button", { name: "Leggili ora" })).not.toBeVisible();

  // Si riporta il documento nello stato "mai letto", come lo sarebbe se
  // fosse stato caricato prima che l'estrazione esistesse --- l'unico
  // modo di ricreare quella situazione senza un archivio storico vero.
  await resetDocumentExtraction(user.email);
  await page.reload();
  await page.getByLabel("Master password", { exact: true }).fill("una-master-password-solida");
  await page.getByRole("button", { name: "Sblocca", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Archivio" })).toBeVisible({ timeout: 30_000 });

  // Ora il banner compare, e la ricerca per contenuto non trova nulla.
  await expect(page.getByRole("button", { name: "Leggili ora" })).toBeVisible({ timeout: 15_000 });
  await page.getByPlaceholder("Cerca per nome, tag, note o dentro i documenti…").fill("Manzoni");
  await expect(page.getByText("vecchio.pdf")).not.toBeVisible();

  // Si preme "Leggili ora": da quel momento la ricerca lo trova.
  await page.getByPlaceholder("Cerca per nome, tag, note o dentro i documenti…").fill("");
  await page.getByRole("button", { name: "Leggili ora" }).click();
  await expect(page.getByText(/Lettura completata/)).toBeVisible({ timeout: 45_000 });
  await expect(page.getByRole("button", { name: "Leggili ora" })).not.toBeVisible();

  await page.getByPlaceholder("Cerca per nome, tag, note o dentro i documenti…").fill("Manzoni");
  await expect(page.getByText("vecchio.pdf")).toBeVisible();
});
