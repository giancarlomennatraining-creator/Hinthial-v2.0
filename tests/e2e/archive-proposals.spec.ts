import { expect, test } from "./fixtures";
import { createConfirmedTestUser, fullName, uniqueTestUser } from "./test-users";

// Requires a configured Supabase project (.env.local) --- see README.md.
//
// FASE 19 --- il meccanismo delle proposte. Quello che va provato qui non
// è il disegno della sezione, sono le due promesse che la fase fa
// all'utente e che nessun test unitario può verificare:
//
//   1. accettare **scrive davvero**, e l'effetto si vede altrove
//      (una scadenza accettata compare in Scadenze);
//   2. rifiutare **viene ricordato**, cioè sopravvive a un ricaricamento
//      --- il rifiuto passa per il database, cifrato, e va riletto e
//      decifrato perché la proposta resti sparita.

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
];

async function setUpWithPolizza(page: import("@playwright/test").Page) {
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

  // Il nome del file non dice niente: categoria e scadenza possono
  // venire solo da dentro il documento.
  await page.getByRole("link", { name: "+ Aggiungi contenuto" }).click();
  await page.setInputFiles('input[type="file"]', {
    name: "scan_0012.pdf",
    mimeType: "application/pdf",
    buffer: buildPdf(POLIZZA),
  });
  await page.getByRole("button", { name: "Aggiungi all'archivio" }).click();
  await expect(page).toHaveURL(/\/archive$/, { timeout: 30_000 });

  await page.getByRole("link", { name: /scan_0012\.pdf/ }).click();
  await expect(page.getByRole("region", { name: "Proposte" })).toBeVisible({ timeout: 30_000 });

  return user;
}

test("accettare una proposta scrive davvero, e si può annullare", async ({ page }) => {
  test.slow();

  await setUpWithPolizza(page);

  const proposte = page.getByRole("region", { name: "Proposte" });
  await expect(proposte).toContainText("3 giu 2027");

  // Prima di accettare, la scheda è vuota.
  const scheda = page.getByRole("region", { name: "Scheda" });
  await expect(scheda).not.toContainText("3 giu 2027");

  await proposte.getByRole("button", { name: "Accetta" }).first().click();

  // La scheda si aggiorna, e la proposta sparisce: ciò che è impostato
  // non si ripropone.
  await expect(scheda).toContainText("3 giu 2027", { timeout: 20_000 });
  await expect(proposte).toContainText("Scadenza impostata");

  // Annullamento, subito e senza lasciare la pagina --- che è il momento
  // in cui serve. Rimette il campo com'era, e la proposta torna a
  // comparire: il documento è di nuovo senza scadenza.
  await proposte.getByRole("button", { name: "Annulla" }).click();
  await expect(scheda).not.toContainText("3 giu 2027", { timeout: 20_000 });
  await expect(proposte).toContainText("3 giu 2027");

  // Si riaccetta, e stavolta si va a vedere l'effetto fuori
  // dall'Archivio: è quello il punto di accettare una scadenza.
  await proposte.getByRole("button", { name: "Accetta" }).first().click();
  await expect(scheda).toContainText("3 giu 2027", { timeout: 20_000 });

  await page.getByRole("link", { name: "Scadenze", exact: true }).click();
  await expect(page.getByText("scan_0012.pdf").first()).toBeVisible({ timeout: 20_000 });
});

test("un rifiuto viene ricordato e sopravvive al ricaricamento", async ({ page }) => {
  test.slow();

  await setUpWithPolizza(page);

  const proposte = page.getByRole("region", { name: "Proposte" });
  await expect(proposte).toContainText("Scadenza");

  await proposte.getByRole("button", { name: "No, grazie" }).first().click();
  await expect(proposte).toContainText("Non te lo richiederò più");
  await expect(proposte).not.toContainText("3 giu 2027");

  // La prova vera: il rifiuto è cifrato nel database, e per restare
  // valido dev'essere riletto e decifrato al caricamento successivo.
  await page.reload();
  await page.getByLabel("Master password", { exact: true }).fill(MASTER_PASSWORD);
  await page.getByRole("button", { name: "Sblocca", exact: true }).click();

  // La proposta di categoria resta (rifiutarne una non è rifiutarle
  // tutte), ma la scadenza rifiutata non deve tornare.
  await expect(page.getByRole("region", { name: "Proposte" })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole("region", { name: "Proposte" })).not.toContainText("3 giu 2027");
});

test("modificare una proposta prima di accettarla", async ({ page }) => {
  test.slow();

  await setUpWithPolizza(page);

  const proposte = page.getByRole("region", { name: "Proposte" });
  await proposte.getByRole("button", { name: "Modifica" }).first().click();

  // Il caso più frequente: la data c'è ma è quella sbagliata.
  await page.getByLabel("Scadenza da impostare").fill("2028-01-15");
  await page.getByRole("button", { name: "Salva" }).click();

  const scheda = page.getByRole("region", { name: "Scheda" });
  await expect(scheda).toContainText("15 gen 2028", { timeout: 20_000 });
  await expect(scheda).not.toContainText("3 giu 2027");
});

test("le scelte sulle proposte restano in Attività", async ({ page }) => {
  test.slow();

  const user = await setUpWithPolizza(page);

  await page
    .getByRole("region", { name: "Proposte" })
    .getByRole("button", { name: "Accetta" })
    .first()
    .click();
  await expect(page.getByRole("region", { name: "Scheda" })).toContainText("3 giu 2027", {
    timeout: 20_000,
  });

  // Ogni scrittura automatica deve lasciare traccia: è metà del motivo
  // per cui la FASE 19 esiste (v. tests/e2e/audit-log.spec.ts per il
  // percorso fino al registro).
  await page.getByRole("button", { name: fullName(user) }).click();
  await page.getByRole("link", { name: "Impostazioni" }).click();
  await page.getByRole("tab", { name: "Attività" }).click();
  await page.getByRole("button", { name: "Trova" }).click();

  await expect(page.getByText("Proposta accettata").first()).toBeVisible({ timeout: 30_000 });
});
