import { expect, test } from "./fixtures";
import { createConfirmedTestUser, uniqueTestUser } from "./test-users";

// Requires a configured Supabase project (.env.local) --- see README.md.
//
// Il documento viene letto appena lo scegli, non quando premi Salva, e il form si precompila da solo. Si verifica
// la catena intera: lettura, campi ricavati, riconoscimento del bene, salvataggio, in una sola schermata.

const MASTER_PASSWORD = "una-master-password-solida";

/** PDF minimo valido con più righe di testo, v. archive-item-detail. */
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

const POLIZZA = [
  "GENERALI ITALIA S.p.A.",
  "Polizza responsabilita civile",
  "Emessa il 14 marzo 2026",
  "Valida fino al 3 giugno 2027",
  "Veicolo assicurato: targa AB123CD",
];

async function signInAndUnlock(page: import("@playwright/test").Page) {
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

  return user;
}

test("scegliendo il file, Hinthial lo legge sul dispositivo ma non compila nessun campo", async ({ page }) => {
  test.slow();

  await signInAndUnlock(page);

  // Un bene con la targa nel nome: prima era l'aggancio più forte per riconoscere il documento, ora non si abbina da solo.
  await page.getByRole("link", { name: "Beni", exact: true }).click();
  await page.getByRole("link", { name: "+ Crea bene" }).click();
  await page.getByLabel("Nome").fill("Fiat Panda AB123CD");
  await page.locator("#categoryId").selectOption({ label: "🛡️ Assicurazioni" });
  await page.getByRole("button", { name: "Aggiungi bene" }).click();
  await expect(page).toHaveURL(/\/assets$/, { timeout: 20_000 });

  await page.getByRole("link", { name: "Archivio", exact: true }).click();
  await page.getByRole("button", { name: "+ Aggiungi contenuto" }).click();
  await page.getByRole("menuitem", { name: "Carica un file" }).click();
  await page.getByRole("radio", { name: /Carica un file/ }).click();

  await page.setInputFiles('input[type="file"]', {
    name: "scan_0012.pdf",
    mimeType: "application/pdf",
    buffer: buildPdf(POLIZZA),
  });

  // La lettura avviene QUI, senza aver premuto Salva: il testo si salva col documento (ricerca, analisi di Hinthia).
  await expect(page.getByText("Letto sul dispositivo")).toBeVisible({ timeout: 45_000 });

  // Ma non decide niente al posto tuo: né titolo, né categoria, né bene collegato.
  await expect(page.getByLabel("Titolo")).toHaveValue("");
  await expect(page.getByRole("button", { name: /Usa il titolo che ho ricavato/ })).toHaveCount(0);
  await page.getByRole("button", { name: "Dettagli" }).click();
  await expect(page.getByLabel("Bene collegato")).toHaveValue("");
  await expect(page.getByLabel("Categoria")).toHaveValue("");
  await expect(page.getByText("Riconosciuto nel documento")).toHaveCount(0);
  await expect(page.getByText("Suggerita da Hinthial")).toHaveCount(0);

  await page.getByRole("button", { name: "Aggiungi all'archivio" }).click();
  await page.getByRole("link", { name: "Torna all'archivio", exact: true }).click();
  await expect(page).toHaveURL(/\/archive$/, { timeout: 30_000 });

  // Salvato col nome del file, dal momento che non c'è un titolo scelto.
  await expect(page.getByRole("link", { name: /scan_0012\.pdf/ })).toBeVisible({ timeout: 20_000 });
});
