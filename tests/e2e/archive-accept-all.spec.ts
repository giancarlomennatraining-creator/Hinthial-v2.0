import { expect, test } from "./fixtures";
import { createConfirmedTestUser, uniqueTestUser } from "./test-users";

// Requires a configured Supabase project (.env.local) --- see README.md.
//
// "Accetta tutto" nella Scheda, voci libere modificabili secondo il tipo di dato (una data col calendario), e la
// Scheda impilata su smartphone. La lettura di Hinthia è simulata (page.route): nessuna chiamata reale alla API.

const MASTER_PASSWORD = "una-master-password-solida";

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
  for (const offset of offsets)
    pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF\n`;
  return Buffer.from(pdf, "latin1");
}

const POLIZZA = [
  "GENERALI ITALIA S.p.A.",
  "Polizza responsabilita civile",
  "Numero polizza ABC12345",
  "Data di nascita 1990-05-12",
  "Valida fino al 3 giugno 2027",
];

async function openPolizza(page: import("@playwright/test").Page) {
  const user = uniqueTestUser();
  await createConfirmedTestUser(user);

  await page.goto("/login");
  await page.getByLabel("Email").fill(user.email);
  await page.getByLabel("Password").fill(user.password);
  await page.getByRole("button", { name: "Accedi" }).click();
  await expect(page).toHaveURL(/\/dashboard$/, { timeout: 15_000 });

  await page.getByRole("link", { name: "Archivio", exact: true }).click();
  await page
    .getByLabel("Master password", { exact: true })
    .fill(MASTER_PASSWORD);
  await page.getByLabel("Conferma master password").fill(MASTER_PASSWORD);
  await page.getByRole("button", { name: "Crea" }).click();
  await expect(
    page.getByLabel("Ho salvato la recovery key in un posto sicuro."),
  ).toBeVisible({
    timeout: 45_000,
  });
  await page
    .getByLabel("Ho salvato la recovery key in un posto sicuro.")
    .check();
  await page.getByRole("button", { name: "Continua" }).click();
  await expect(page.getByRole("heading", { name: "Archivio" })).toBeVisible();

  await page.getByRole("button", { name: "+ Aggiungi contenuto" }).click();
  await page.getByRole("menuitem", { name: "Carica un file" }).click();
  await page.getByRole("radio", { name: /Carica un file/ }).click();
  await page.setInputFiles('input[type="file"]', {
    name: "polizza.pdf",
    mimeType: "application/pdf",
    buffer: buildPdf(POLIZZA),
  });
  // Prima di salvare, la lettura deve aver finito: la categoria che Hinthial ricava dal testo viene salvata col documento, e
  // quanto trova poi la Scheda (2 informazioni: emittente e scadenza) non dipende più da chi arriva prima.
  await expect(page.getByText("Letto sul dispositivo")).toBeVisible({
    timeout: 30_000,
  });
  await page.getByRole("button", { name: "Aggiungi all'archivio" }).click();
  await page
    .getByRole("link", { name: "Torna all'archivio", exact: true })
    .click();
  await expect(page).toHaveURL(/\/archive$/, { timeout: 30_000 });

  await page.getByRole("link", { name: /polizza\.pdf/ }).click();
  await expect(page).toHaveURL(/\/archive\/[0-9a-f-]+$/, { timeout: 15_000 });
}

test("Accetta tutto aggiunge in un colpo ciò che Hinthia ha trovato, le voci restano modificabili col loro tipo di dato, e si annulla", async ({
  page,
}) => {
  test.slow();

  await page.route("**/api/ai/analyze", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        result: {
          expiry: [],
          issuer: [],
          category: null,
          fields: [
            {
              key: "numero_polizza",
              label: "Numero polizza",
              value: "ABC12345",
              source: "Numero polizza ABC12345",
            },
            {
              key: "data_di_nascita",
              label: "Data di nascita",
              value: "1990-05-12",
              source: "Data di nascita 1990-05-12",
            },
          ],
          synthesis: null,
        },
      }),
    }),
  );

  await openPolizza(page);

  // Cancello generale + funzione: senza, "Chiedi a Hinthia" non compare.
  await page.goto("/settings");
  await page.getByRole("tab", { name: "Hinthia" }).click();
  await Promise.all([
    page.waitForResponse(
      (res) =>
        res.url().includes("/profiles") && res.request().method() === "PATCH",
    ),
    page.getByRole("switch", { name: "Consenti l'uso di Hinthia" }).click(),
  ]);
  await Promise.all([
    page.waitForResponse(
      (res) =>
        res.url().includes("/profiles") && res.request().method() === "PATCH",
    ),
    page.getByRole("checkbox", { name: /^Estrazione avanzata/ }).check(),
  ]);

  await page.goto("/archive");
  await page
    .getByLabel("Master password", { exact: true })
    .fill(MASTER_PASSWORD);
  await page.getByRole("button", { name: "Sblocca", exact: true }).click();
  await page.getByRole("link", { name: /polizza\.pdf/ }).click();

  // La scheda è la tab di default: prima della lettura di Hinthia c'è già ciò che il dispositivo ha trovato.
  const banner = page.getByRole("group", {
    name: "Informazioni trovate da Hinthia",
  });
  await expect(banner).toBeVisible({ timeout: 30_000 });
  await expect(banner).toContainText("2 informazioni");

  await page.getByRole("tab", { name: /^Chiedi a Hinthia/ }).click();
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Solo questa volta" }).click();
  await expect(
    page.getByRole("tab", { name: "Chiedi a Hinthia · 2" }),
  ).toBeVisible({ timeout: 15_000 });

  await page.getByRole("tab", { name: "Scheda" }).click();
  await expect(banner).toContainText("4 informazioni");
  await banner.getByRole("button", { name: "Accetta tutto" }).click();

  const lastAction = page.getByRole("status", { name: "Ultima proposta" });
  await expect(lastAction).toContainText(
    "4 informazioni aggiunte alla Scheda",
    { timeout: 20_000 },
  );
  await expect(banner).toHaveCount(0);

  // Le voci finite in Scheda sono modificabili, ognuna col suo tipo: la data col calendario.
  const numero = page.getByLabel("Numero polizza");
  const nascita = page.getByLabel("Data di nascita");
  await expect(numero).toHaveValue("ABC12345");
  await expect(numero).toHaveAttribute("type", "text");
  await expect(nascita).toHaveValue("1990-05-12");
  await expect(nascita).toHaveAttribute("type", "date");
  await expect(page.getByLabel("Scadenza")).toHaveValue("2027-06-03");

  await nascita.fill("1991-01-02");
  await numero.fill("ZZZ999");
  await page.getByRole("button", { name: "Salva modifiche" }).click();
  await expect(
    page.getByRole("button", { name: "Salva modifiche" }),
  ).toBeDisabled({ timeout: 20_000 });

  await page.reload();
  await page
    .getByLabel("Master password", { exact: true })
    .fill(MASTER_PASSWORD);
  await page.getByRole("button", { name: "Sblocca", exact: true }).click();
  await expect(page.getByLabel("Data di nascita")).toHaveValue("1991-01-02", {
    timeout: 30_000,
  });
  await expect(page.getByLabel("Numero polizza")).toHaveValue("ZZZ999");
});

test("Accetta tutto si annulla in un colpo solo", async ({ page }) => {
  test.slow();

  await openPolizza(page);

  const banner = page.getByRole("group", {
    name: "Informazioni trovate da Hinthia",
  });
  await expect(banner).toContainText("2 informazioni", { timeout: 30_000 });
  await banner.getByRole("button", { name: "Accetta tutto" }).click();

  const lastAction = page.getByRole("status", { name: "Ultima proposta" });
  await expect(lastAction).toContainText(
    "2 informazioni aggiunte alla Scheda",
    { timeout: 20_000 },
  );
  await expect(page.getByLabel("Scadenza")).toHaveValue("2027-06-03");

  await lastAction.getByRole("button", { name: "Annulla" }).click();
  await expect(page.getByLabel("Scadenza")).toHaveValue("", {
    timeout: 20_000,
  });
  await expect(banner).toContainText("2 informazioni");
});

test("su smartphone le voci della Scheda stanno una sotto l'altra", async ({
  page,
}) => {
  test.slow();

  await openPolizza(page);
  await page.setViewportSize({ width: 390, height: 844 });

  const categoria = page.getByLabel("Categoria");
  const bene = page.getByLabel("Bene collegato");
  const scadenza = page.getByLabel("Scadenza");
  await expect(scadenza).toBeVisible();

  const [c, b, s] = await Promise.all([
    categoria.boundingBox(),
    bene.boundingBox(),
    scadenza.boundingBox(),
  ]);
  if (!c || !b || !s) throw new Error("Campi della Scheda non misurabili.");
  expect(b.y).toBeGreaterThan(c.y + c.height - 1);
  expect(s.y).toBeGreaterThan(b.y + b.height - 1);
  expect(Math.abs(b.x - c.x)).toBeLessThan(2);
  expect(Math.abs(s.x - c.x)).toBeLessThan(2);
});
