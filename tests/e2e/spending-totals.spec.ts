import { expect, test } from "./fixtures";
import { createConfirmedTestUser, uniqueTestUser } from "./test-users";

// Requires a configured Supabase project (.env.local) --- see README.md.
//
// FASE 21 --- "totali di spesa per anno e categoria": una lettura, non
// un cruscotto. Solo la somma, mai un giudizio su di essa.

const MASTER_PASSWORD = "una-master-password-solida";

/** PDF minimo valido con più righe di testo --- v. archive-item-detail. */
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

test("i totali di spesa sommano gli importi riconosciuti, per anno e categoria", async ({
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
  await page.getByLabel("Master password", { exact: true }).fill(MASTER_PASSWORD);
  await page.getByLabel("Conferma master password").fill(MASTER_PASSWORD);
  await page.getByRole("button", { name: "Crea" }).click();
  await expect(page.getByLabel("Ho salvato la recovery key in un posto sicuro.")).toBeVisible({
    timeout: 45_000,
  });
  await page.getByLabel("Ho salvato la recovery key in un posto sicuro.").check();
  await page.getByRole("button", { name: "Continua" }).click();
  await expect(page.getByRole("heading", { name: "Archivio" })).toBeVisible();

  // Prima di caricare qualcosa, nessun totale --- non uno zero, niente.
  await page.getByRole("link", { name: "Totali di spesa" }).click();
  await expect(page.getByRole("heading", { name: "Totali di spesa" })).toBeVisible();
  await expect(page.getByText(/Nessun importo riconosciuto ancora/)).toBeVisible();

  await page.getByRole("link", { name: "← Torna all'archivio" }).click();
  await page.getByRole("link", { name: "+ Aggiungi contenuto" }).click();
  await page.setInputFiles('input[type="file"]', {
    name: "fattura.pdf",
    mimeType: "application/pdf",
    buffer: buildPdf(["Emesso il 14 marzo 2026", "Totale 120,00"]),
  });
  await page.getByText(/Ho letto il documento/).waitFor({ timeout: 45_000 });
  await page.getByLabel("Categoria").selectOption({ label: "🚗 Veicoli" });
  await page.getByRole("button", { name: "Aggiungi all'archivio" }).click();
  await expect(page).toHaveURL(/\/archive$/, { timeout: 30_000 });

  await page.getByRole("link", { name: "Totali di spesa" }).click();
  await expect(page.getByRole("heading", { name: "Totali di spesa" })).toBeVisible();
  const row = page.locator("tr", { hasText: "2026" });
  await expect(row).toContainText("Veicoli");
  await expect(row).toContainText("120,00");
});
