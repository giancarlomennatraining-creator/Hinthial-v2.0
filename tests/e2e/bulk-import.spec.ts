import { expect, test } from "./fixtures";
import { createConfirmedTestUser, uniqueTestUser } from "./test-users";

// Requires a configured Supabase project (.env.local) --- see README.md.
//
// FASE 21 --- import massivo: molti file in una volta, con un riepilogo
// per gruppi. Qui si prova il percorso vero: due file con lo stesso
// emittente propongono un fascicolo nuovo (il "raggruppamento evidente"
// del piano), un terzo file senza emittente riconoscibile resta da
// solo; si importa tutto con un clic e si verifica che il fascicolo sia
// nato con dentro i documenti giusti.

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

async function signInAndSetUpVault(page: import("@playwright/test").Page) {
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
}

test("due file con lo stesso emittente propongono un fascicolo, importati insieme a un terzo senza gruppo", async ({
  page,
}) => {
  test.slow();

  await signInAndSetUpVault(page);

  await page.getByRole("link", { name: "Importa più file insieme" }).click();
  await expect(page.getByRole("heading", { name: "Importa più file insieme" })).toBeVisible();

  await page.getByLabel("Scegli i file da importare").setInputFiles([
    {
      name: "bolletta-gennaio.pdf",
      mimeType: "application/pdf",
      buffer: buildPdf(["ENEL ENERGIA S.p.A.", "Bolletta luce gennaio", "Totale 50,00"]),
    },
    {
      name: "bolletta-febbraio.pdf",
      mimeType: "application/pdf",
      buffer: buildPdf(["ENEL ENERGIA S.p.A.", "Bolletta luce febbraio", "Totale 55,00"]),
    },
    {
      name: "biglietto-treno.txt",
      mimeType: "text/plain",
      buffer: Buffer.from("Biglietto del treno, nessun emittente riconoscibile qui dentro."),
    },
  ]);

  // Il riepilogo per gruppi: la proposta di un fascicolo nuovo per le
  // due bollette, già selezionata (è un raggruppamento evidente).
  const proposal = page.getByText(/hanno lo stesso emittente/, { exact: false });
  await expect(proposal).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText("bolletta-gennaio.pdf")).toBeVisible();
  await expect(page.getByText("bolletta-febbraio.pdf")).toBeVisible();
  await expect(page.getByText("biglietto-treno.txt")).toBeVisible();

  // Il titolo proposto per il fascicolo nuovo è l'emittente stesso.
  await expect(page.locator('input[value="ENEL ENERGIA S.p.A."]')).toBeVisible();

  await page.getByRole("button", { name: "Importa tutto" }).click();
  await expect(page).toHaveURL(/\/archive$/, { timeout: 60_000 });

  // Le due bollette prendono il titolo che Hinthial ha ricavato dal
  // contenuto (FASE 19b), non il nome del file --- lo stesso
  // comportamento del caricamento singolo. Il biglietto, che non ha un
  // titolo riconoscibile, mantiene il proprio nome.
  await expect(page.getByRole("link", { name: /Bolletta luce gennaio/ })).toBeVisible({
    timeout: 15_000,
  });
  await expect(page.getByRole("link", { name: /Bolletta luce febbraio/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /biglietto-treno\.txt/ })).toBeVisible();

  // Il fascicolo è nato, con dentro le due bollette --- non il biglietto.
  await page.getByRole("link", { name: "Fascicolo", exact: true }).click();
  await expect(page).toHaveURL(/\/dossiers$/, { timeout: 15_000 });
  await expect(page.getByRole("heading", { name: "Fascicoli" })).toBeVisible();
  await page.getByRole("link", { name: /ENEL ENERGIA S\.p\.A\./ }).click();
  const cronologia = page.getByRole("region", { name: "Cronologia" });
  await expect(cronologia.getByRole("link", { name: /Bolletta luce gennaio/ })).toBeVisible();
  await expect(cronologia.getByRole("link", { name: /Bolletta luce febbraio/ })).toBeVisible();
  await expect(cronologia.getByText(/biglietto-treno/)).not.toBeVisible();
});
