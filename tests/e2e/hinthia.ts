import { expect, type Page } from "@playwright/test";
import { createConfirmedTestUser, uniqueTestUser, type TestUser } from "./test-users";

/**
 * Aiuti per gli e2e che passano dalla lettura di Hinthia. La chiamata ad Anthropic è sempre simulata (`page.route`):
 * nessun test spedisce testo a un servizio esterno, qualunque chiave ci sia in `.env.local`.
 */

export const MASTER_PASSWORD = "una-master-password-solida";

/** PDF a pagina singola con una riga di testo per voce. */
export function buildPdf(lines: string[]): Buffer {
  const stream = lines.map((line, i) => `BT /F1 12 Tf 72 ${720 - i * 20} Td (${line}) Tj ET`).join("\n");
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

export const POLIZZA = [
  "GENERALI ITALIA S.p.A.",
  "Polizza responsabilita civile",
  "Numero polizza ABC12345",
  "Data di nascita 1990-05-12",
  "Valida fino al 3 giugno 2027",
];

/** Accede, crea la cassaforte, carica un PDF e apre la scheda del documento (sulla tab "Scheda"). */
export async function setUpWithDocument(
  page: Page,
  { filename = "polizza.pdf", lines = POLIZZA }: { filename?: string; lines?: string[] } = {},
): Promise<TestUser> {
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
  await expect(page.getByLabel("Ho salvato la recovery key in un posto sicuro.")).toBeVisible({ timeout: 45_000 });
  await page.getByLabel("Ho salvato la recovery key in un posto sicuro.").check();
  await page.getByRole("button", { name: "Continua" }).click();
  await expect(page.getByRole("heading", { name: "Archivio" })).toBeVisible();

  await page.getByRole("button", { name: "+ Aggiungi contenuto" }).click();
  await page.getByRole("menuitem", { name: "Carica un file" }).click();
  await page.getByRole("radio", { name: /Carica un file/ }).click();
  await page.setInputFiles('input[type="file"]', {
    name: filename,
    mimeType: "application/pdf",
    buffer: buildPdf(lines),
  });
  // La lettura del testo deve aver finito prima di salvare: il testo si salva col documento.
  await expect(page.getByText("Letto sul dispositivo")).toBeVisible({ timeout: 30_000 });
  await page.getByRole("button", { name: "Aggiungi all'archivio" }).click();
  await page.getByRole("link", { name: "Torna all'archivio", exact: true }).click();
  await expect(page).toHaveURL(/\/archive$/, { timeout: 30_000 });

  await page.getByRole("link", { name: new RegExp(filename.replace(/\./g, "\\.")) }).click();
  await expect(page).toHaveURL(/\/archive\/[0-9a-f-]+$/, { timeout: 15_000 });
  return user;
}

export interface MockedReading {
  /** Aggiunge numero polizza e data di nascita come campi. */
  fields?: boolean;
  /** Propone la categoria "Assicurazioni" (se esiste tra quelle inviate). */
  category?: boolean;
}

/** Risponde alla route di analisi con una lettura fissa, nel formato attuale (v. api/ai/analyze): `result` per un blocco, `synthesis` per la fusione. */
export async function mockHinthiaReading(page: Page, { fields = false, category = true }: MockedReading = {}) {
  await page.route("**/api/ai/analyze", (route) => {
    const request = route.request().postDataJSON() as { mode?: string; categories?: { id: string; name: string }[] };
    if (request.mode === "merge") {
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ synthesis: null }) });
    }
    const insurance = request.categories?.find((c) => /assicur/i.test(c.name));
    const result = {
      documentType: "polizza",
      expiry: [{ value: "2027-06-03", segmentId: "p1", quote: "Valida fino al 3 giugno 2027" }],
      issuer: [{ value: "GENERALI ITALIA S.p.A.", segmentId: "p1", quote: "GENERALI ITALIA S.p.A." }],
      category:
        category && insurance ? { id: insurance.id, segmentId: "p1", quote: "Polizza responsabilita civile" } : null,
      fields: fields
        ? [
            {
              key: "numero_polizza",
              label: "Numero polizza",
              value: "ABC12345",
              segmentId: "p1",
              quote: "Numero polizza ABC12345",
            },
            {
              key: "data_di_nascita",
              label: "Data di nascita",
              value: "1990-05-12",
              segmentId: "p1",
              quote: "Data di nascita 1990-05-12",
            },
          ]
        : [],
      events: [],
      synthesis: null,
    };
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ result }) });
  });
}

/** Cancello generale e funzione "Estrazione avanzata" accesi in Impostazioni, poi si torna alla stessa pagina e si sblocca la cassaforte. */
export async function enableHinthia(page: Page) {
  const documentUrl = page.url();

  await page.goto("/settings");
  await page.getByRole("tab", { name: "Hinthia" }).click();
  await Promise.all([
    page.waitForResponse((res) => res.url().includes("/profiles") && res.request().method() === "PATCH"),
    page.getByRole("switch", { name: "Consenti l'uso di Hinthia" }).click(),
  ]);
  await Promise.all([
    page.waitForResponse((res) => res.url().includes("/profiles") && res.request().method() === "PATCH"),
    page.getByRole("checkbox", { name: /^Estrazione avanzata/ }).check(),
  ]);

  await page.goto(documentUrl);
  await page.getByLabel("Master password", { exact: true }).fill(MASTER_PASSWORD);
  await page.getByRole("button", { name: "Sblocca", exact: true }).click();
  await expect(page.getByRole("tab", { name: "Scheda" })).toBeVisible({ timeout: 30_000 });
}

/** "Chiedi a Hinthia" -> "Solo questa volta" -> attende che arrivino le proposte (tab "Chiedi a Hinthia · N"). */
export async function askHinthia(page: Page, expectedProposals: number) {
  await page.getByRole("tab", { name: /^Chiedi a Hinthia/ }).click();
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Solo questa volta" }).click();
  await expect(page.getByRole("tab", { name: `Chiedi a Hinthia · ${expectedProposals}` })).toBeVisible({
    timeout: 20_000,
  });
}

/** Documento caricato, Hinthia attiva e già interrogata: si è sulla tab "Chiedi a Hinthia" con le proposte. */
export async function openAnalysedDocument(
  page: Page,
  options: { filename?: string; lines?: string[] } & MockedReading & { expectedProposals: number },
): Promise<TestUser> {
  const { expectedProposals, fields, category, ...file } = options;
  await mockHinthiaReading(page, { fields, category });
  const user = await setUpWithDocument(page, file);
  await enableHinthia(page);
  await askHinthia(page, expectedProposals);
  return user;
}
