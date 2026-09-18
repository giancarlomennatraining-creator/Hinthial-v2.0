import { expect, test } from "./fixtures";
import { createConfirmedTestUser, uniqueTestUser } from "./test-users";

// Requires a configured Supabase project (.env.local) --- see README.md.
//
// FASE 19b --- il documento viene letto appena lo scegli, non quando
// premi Salva, e il form si precompila da solo.
//
// È il percorso che porta il valore di tutte le fasi precedenti nel
// punto in cui l'utente passa davvero: fino a ieri tutto ciò che
// Hinthial capiva viveva su una scheda che si apriva solo andandola a
// cercare. Qui si verifica la catena intera --- lettura, campi ricavati,
// riconoscimento del bene, salvataggio --- in una sola schermata.

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

test("scegliendo il file, Hinthial lo legge e precompila il form", async ({ page }) => {
  test.slow();

  await signInAndUnlock(page);

  // Un bene con la targa nel nome: è l'aggancio più forte che esista,
  // perché una targa è unica (v. domain/proposals/asset-match.ts).
  await page.getByRole("link", { name: "Beni", exact: true }).click();
  await page.getByRole("link", { name: "+ Crea bene" }).click();
  await page.getByLabel("Nome").fill("Fiat Panda AB123CD");
  await page.locator("#categoryId").selectOption({ label: "🛡️ Assicurazioni" });
  await page.getByRole("button", { name: "Aggiungi bene" }).click();
  await expect(page).toHaveURL(/\/assets$/, { timeout: 20_000 });

  await page.getByRole("link", { name: "Archivio", exact: true }).click();
  await page.getByRole("link", { name: "+ Aggiungi contenuto" }).click();

  // Il nome del file non dice niente: tutto quello che comparirà viene
  // da dentro il documento.
  await page.setInputFiles('input[type="file"]', {
    name: "scan_0012.pdf",
    mimeType: "application/pdf",
    buffer: buildPdf(POLIZZA),
  });

  // 1. La lettura avviene QUI, senza aver premuto Salva.
  await expect(page.getByText(/Ho letto il documento/)).toBeVisible({ timeout: 45_000 });
  // exact: l'emittente compare anche dentro al titolo proposto qui sotto.
  await expect(page.getByText("GENERALI ITALIA S.p.A.", { exact: true })).toBeVisible();

  // 2. Il titolo è **proposto**, non imposto: il nome del file è l'unico
  // campo che arriva già compilato, e sostituirlo d'ufficio violerebbe
  // la stessa regola delle proposte sulla scheda. Serve un clic.
  await expect(page.getByLabel("Titolo")).toHaveValue("");
  await page.getByRole("button", { name: /Usa il titolo che ho ricavato/ }).click();
  await expect(page.getByLabel("Titolo")).toHaveValue(
    "Polizza responsabilita civile --- GENERALI ITALIA S.p.A..pdf",
  );
  await expect(page.getByText("Titolo suggerito da Hinthial")).toBeVisible();

  // 3. Categoria e bene, riconosciuti dalla targa dentro il documento.
  await expect(page.getByLabel("Bene collegato")).toHaveValue(/.+/);
  await expect(page.getByText("Riconosciuto nel documento")).toBeVisible();

  // 4. La scadenza, con la frase da cui viene.
  await expect(page.getByLabel("Scadenza")).toHaveValue("2027-06-03");
  await expect(page.getByText(/Trovata nel documento/)).toBeVisible();

  await page.getByRole("button", { name: "Aggiungi all'archivio" }).click();
  await expect(page).toHaveURL(/\/archive$/, { timeout: 30_000 });

  // Salvato col titolo proposto, non col nome del file.
  await expect(page.getByText(/Polizza responsabilita civile/)).toBeVisible({ timeout: 20_000 });
});

test("correggendo la scadenza, Hinthial ritrova la frase da cui viene", async ({ page }) => {
  test.slow();

  await signInAndUnlock(page);
  await page.getByRole("link", { name: "Archivio", exact: true }).click();
  await page.getByRole("link", { name: "+ Aggiungi contenuto" }).click();

  await page.setInputFiles('input[type="file"]', {
    name: "scan_0012.pdf",
    mimeType: "application/pdf",
    buffer: buildPdf(POLIZZA),
  });
  await expect(page.getByText(/Ho letto il documento/)).toBeVisible({ timeout: 45_000 });

  // Il caso più frequente non è che non trovi la data: è che ne trovi
  // cinque e scelga quella sbagliata. Si corregge con l'ALTRA data del
  // documento, e Hinthial deve ritrovarne la frase --- pur avendola
  // ricevuta nel formato del calendario ("2026-03-14") mentre nel
  // documento è scritta "14 marzo 2026".
  // Si punta il suggerimento sotto al campo Scadenza e non la frase in
  // sé: quella stessa riga compare anche nel riquadro "Ho letto il
  // documento", come contesto della data del documento.
  await page.getByLabel("Scadenza").fill("2026-03-14");
  await expect(page.getByText(/^Nel documento:/)).toContainText("Emessa il 14 marzo 2026");

  // E una data che nel documento non c'è va detta, non nascosta.
  await page.getByLabel("Scadenza").fill("2031-01-01");
  await expect(page.getByText(/non l'ho trovata/)).toBeVisible();
});

test("il segno «suggerito» sparisce appena l'utente tocca il campo", async ({ page }) => {
  test.slow();

  await signInAndUnlock(page);
  await page.getByRole("link", { name: "Archivio", exact: true }).click();
  await page.getByRole("link", { name: "+ Aggiungi contenuto" }).click();

  await page.setInputFiles('input[type="file"]', {
    name: "scan_0012.pdf",
    mimeType: "application/pdf",
    buffer: buildPdf(POLIZZA),
  });
  await page
    .getByRole("button", { name: /Usa il titolo che ho ricavato/ })
    .click({ timeout: 45_000 });
  await expect(page.getByText("Titolo suggerito da Hinthial")).toBeVisible();

  // Da quando ci metti mano il valore è tuo, e continuare a chiamarlo
  // "suggerito" sarebbe falso.
  await page.getByLabel("Titolo").fill("Polizza auto 2027");
  await expect(page.getByText("Titolo suggerito da Hinthial")).not.toBeVisible();
});
