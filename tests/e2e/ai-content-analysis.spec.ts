import { expect, test } from "./fixtures";
import { createConfirmedTestUser, uniqueTestUser } from "./test-users";

// Requires a configured Supabase project (.env.local) --- see README.md.

/**
 * FASE 22: consenso a tre assi (funzione, già coperto da ai-processing-consent.spec.ts; categoria; singolo
 * contenuto). Non serve una vera ANTHROPIC_API_KEY: con tutti i consensi attivi ma la chiave non configurata, la
 * route risponde con lo stesso errore chiaro già usato dalla Chat (v. api/ai/analyze/route.ts).
 */

const MASTER_PASSWORD = "una-master-password-solida";

/** PDF minimo con una riga di testo --- v. archive-item-detail.spec.ts. */
function buildPdf(line: string): Buffer {
  const stream = `BT /F1 12 Tf 72 720 Td (${line}) Tj ET`;
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
  for (const offset of offsets) pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF\n`;
  return Buffer.from(pdf, "latin1");
}

test("il bottone 'Chiedi a Hinthia' rispetta consenso generale, per categoria ed esclusione per singolo documento", async ({
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

  // Un documento con categoria, perché "abilita per categoria"/"solo questa volta" abbiano senso.
  await page.getByRole("link", { name: "+ Aggiungi contenuto" }).click();
  // Il passo 1 non parte più su una modalità già scelta (v. feedback utente): va scelta esplicitamente.
  await page.getByRole("radio", { name: /Carica un file/ }).click();
  await page.setInputFiles('input[type="file"]', {
    name: "polizza.pdf",
    mimeType: "application/pdf",
    buffer: buildPdf("Polizza responsabilita civile"),
  });
  await page.getByRole("button", { name: "Aiutaci a ritrovarlo" }).click();
  await page.getByLabel("Categoria").selectOption({ label: "🛡️ Assicurazioni" });
  await page.getByRole("button", { name: "Aggiungi all'archivio" }).click();
  await page.getByRole("link", { name: "Torna all'archivio", exact: true }).click();
  await expect(page).toHaveURL(/\/archive$/, { timeout: 30_000 });

  await page.getByRole("link", { name: /polizza\.pdf/ }).click();
  await expect(page).toHaveURL(/\/archive\/[0-9a-f-]+$/, { timeout: 15_000 });

  // Senza consenso generale/di funzione, il bottone non compare --- solo il rimando alle Impostazioni.
  await expect(page.getByText("Chiedi a Hinthia di leggere questo documento")).toBeVisible();
  await expect(page.getByRole("button", { name: "Chiedi a Hinthia" })).toHaveCount(0);
  await expect(page.getByText(/Attiva "Estrazione avanzata dei contenuti"/)).toBeVisible();

  // Attiva cancello generale + funzione, e abilita la categoria "Assicurazioni" per questo utente.
  await page.getByRole("link", { name: "Archivio", exact: true }).click();
  await page.goto("/settings");
  await page.getByRole("tab", { name: "Hinthia" }).click();
  await expect(page.getByRole("heading", { name: "Hinthia" })).toBeVisible();

  const masterSwitch = page.getByRole("switch", { name: "Consenti l'uso di Hinthia" });
  await Promise.all([
    page.waitForResponse((res) => res.url().includes("/profiles") && res.request().method() === "PATCH"),
    masterSwitch.click(),
  ]);
  const extractionCheckbox = page.getByRole("checkbox", { name: /^Estrazione avanzata/ });
  await Promise.all([
    page.waitForResponse((res) => res.url().includes("/profiles") && res.request().method() === "PATCH"),
    extractionCheckbox.check(),
  ]);

  // La categoria "Assicurazioni" è nell'elenco, spenta di default --- anche Salute lo sarebbe, non è più un'eccezione a parte.
  const assicurazioniToggle = page.getByRole("checkbox", { name: "🛡️ Assicurazioni" });
  await expect(assicurazioniToggle).toBeVisible();
  await expect(assicurazioniToggle).not.toBeChecked();

  // Torna al documento: cancello e funzione attivi, ma la categoria non ancora --- compare la scelta a tre.
  await page.goto("/archive");
  await page.getByRole("link", { name: /polizza\.pdf/ }).click();
  await expect(page.getByRole("button", { name: "Solo questa volta" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Abilita questa categoria per 30 giorni" })).toBeVisible();

  // "Solo questa volta" chiede conferma, poi arriva davvero alla route server-side (nessuna vera ANTHROPIC_API_KEY in test).
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Solo questa volta" }).click();
  await expect(
    page.getByText("Hinthia non è ancora configurata su questo server."),
  ).toBeVisible({ timeout: 15_000 });

  // Escludere il documento nasconde il bottone e resta impostato dopo un refresh.
  await page.getByLabel(/Escludi questo documento dall'analisi di Hinthia/).check();
  await page.reload();
  await expect(page.getByText("Questo documento è escluso dall'analisi di Hinthia")).toBeVisible();
  await expect(page.getByRole("button", { name: "Solo questa volta" })).toHaveCount(0);

  // Il consenso per categoria, impostato in Impostazioni, resta impostato dopo un refresh.
  await page.goto("/settings");
  await page.getByRole("tab", { name: "Hinthia" }).click();
  await Promise.all([
    page.waitForResponse((res) => res.url().includes("/categories") && res.request().method() === "PATCH"),
    page.getByRole("checkbox", { name: "🛡️ Assicurazioni" }).check(),
  ]);
  await page.reload();
  await page.getByRole("tab", { name: "Hinthia" }).click();
  await expect(page.getByRole("checkbox", { name: "🛡️ Assicurazioni" })).toBeChecked();
});
