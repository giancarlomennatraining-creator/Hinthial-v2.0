import { expect, test } from "./fixtures";
import { createConfirmedTestUser, fullName, uniqueTestUser } from "./test-users";

// Requires a configured Supabase project (.env.local) --- see README.md.
//
// Il meccanismo delle proposte: le due promesse che nessun test unitario può verificare sono che accettare scrive
// davvero (l'effetto si vede altrove) e che rifiutare viene ricordato (il rifiuto passa per il database, cifrato,
// e va riletto e decifrato perché la proposta resti sparita).

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

  // Il nome del file non dice niente: categoria e scadenza possono venire solo da dentro il documento.
  await page.getByRole("link", { name: "+ Aggiungi contenuto" }).click();
  // Il passo 1 non parte più su una modalità già scelta (v. feedback utente): va scelta esplicitamente.
  await page.getByRole("radio", { name: /Carica un file/ }).click();
  await page.setInputFiles('input[type="file"]', {
    name: "scan_0012.pdf",
    mimeType: "application/pdf",
    buffer: buildPdf(POLIZZA),
  });
  await page.getByRole("button", { name: "Aggiungi all'archivio" }).click();
  await page.getByRole("link", { name: "Torna all'archivio", exact: true }).click();
  await expect(page).toHaveURL(/\/archive$/, { timeout: 30_000 });

  await page.getByRole("link", { name: /scan_0012\.pdf/ }).click();
  // Locali (categoria/scadenza da testo OCR): vivono dentro "Letto dal dispositivo" --- niente più una tab
  // "Proposte" a sé (v. feedback utente). "Scheda" è la tab di default ora, quindi va aperta esplicitamente.
  await page.getByRole("tab", { name: "Letto dal dispositivo" }).click();
  const proposte = page.getByRole("tabpanel", { name: "Letto dal dispositivo" });
  await expect(proposte.getByRole("button", { name: "Accetta" }).first()).toBeVisible({ timeout: 30_000 });

  return user;
}

test("accettare una proposta scrive davvero, e si può annullare", async ({ page }) => {
  test.slow();

  await setUpWithPolizza(page);

  const proposte = page.getByRole("tabpanel", { name: "Letto dal dispositivo" });
  await expect(proposte).toContainText("3 giu 2027");

  // La scadenza si vede sulla tab "Scheda" (v. Concept E: non più sempre a fianco) --- va aperta per guardarla.
  const schedaTab = page.getByRole("tab", { name: "Scheda" });
  const lettoTab = page.getByRole("tab", { name: "Letto dal dispositivo" });
  const scadenza = page.getByLabel("Scadenza");
  await schedaTab.click();
  await expect(scadenza).toHaveValue("");
  await lettoTab.click();

  await proposte.getByRole("button", { name: "Accetta" }).first().click();

  // La scheda si aggiorna, e la proposta sparisce: ciò che è impostato non si ripropone.
  // L'annullamento è condiviso sopra le tab (v. ArchiveItemDetail.tsx), non dentro il pannello: non deve
  // sparire cambiando tab. Nome distinto dal toast globale, anch'esso role="status".
  const lastAction = page.getByRole("status", { name: "Ultima proposta" });
  await expect(lastAction).toContainText("Scadenza impostata");
  await schedaTab.click();
  await expect(scadenza).toHaveValue("2027-06-03", { timeout: 20_000 });
  await lettoTab.click();

  // Annullamento, subito e senza lasciare la pagina: rimette il campo com'era, e la proposta torna a comparire.
  await lastAction.getByRole("button", { name: "Annulla" }).click();
  await expect(proposte).toContainText("3 giu 2027");
  await schedaTab.click();
  await expect(scadenza).toHaveValue("", { timeout: 20_000 });
  await lettoTab.click();

  // Si riaccetta, e stavolta si va a vedere l'effetto fuori dall'Archivio.
  await proposte.getByRole("button", { name: "Accetta" }).first().click();
  await schedaTab.click();
  await expect(scadenza).toHaveValue("2027-06-03", { timeout: 20_000 });

  await page.getByRole("link", { name: "Scadenze", exact: true }).click();
  await expect(page.getByText("scan_0012.pdf").first()).toBeVisible({ timeout: 20_000 });
});

test("un rifiuto viene ricordato e sopravvive al ricaricamento", async ({ page }) => {
  test.slow();

  await setUpWithPolizza(page);

  const proposte = page.getByRole("tabpanel", { name: "Letto dal dispositivo" });
  await expect(proposte).toContainText("Scadenza");
  // 3 proposte (scadenza/categoria/emittente): il conteggio, non il testo, distingue una proposta accettabile
  // dal fatto grezzo che "Cosa ne ho ricavato" mostra comunque --- rifiutare una proposta non fa sparire il
  // valore da lì, lo rende di nuovo visibile come informazione (v. ArchiveItemDetail.tsx, filtro structuredFields).
  const accetta = proposte.getByRole("button", { name: "Accetta" });
  await expect(accetta).toHaveCount(3);

  await proposte.getByRole("button", { name: "No, grazie" }).first().click();
  // L'annullamento è condiviso sopra le tab (v. ArchiveItemDetail.tsx), non dentro il pannello.
  await expect(page.getByRole("status", { name: "Ultima proposta" })).toContainText(
    "Non te lo richiederò più",
  );
  await expect(accetta).toHaveCount(2);

  // La prova vera: il rifiuto è cifrato nel database, e per restare valido dev'essere riletto e decifrato al caricamento successivo.
  await page.reload();
  await page.getByLabel("Master password", { exact: true }).fill(MASTER_PASSWORD);
  await page.getByRole("button", { name: "Sblocca", exact: true }).click();
  // Il reload azzera la tab attiva su "Scheda" (v. ArchiveItemDetail.tsx): si riapre "Letto dal dispositivo".
  await page.getByRole("tab", { name: "Letto dal dispositivo" }).click();

  // La proposta di categoria resta (rifiutarne una non è rifiutarle tutte), ma la scadenza rifiutata non deve tornare.
  await expect(proposte).toBeVisible({ timeout: 30_000 });
  await expect(accetta).toHaveCount(2);
});

test("modificare una proposta prima di accettarla", async ({ page }) => {
  test.slow();

  await setUpWithPolizza(page);

  const proposte = page.getByRole("tabpanel", { name: "Letto dal dispositivo" });
  await proposte.getByRole("button", { name: "Modifica" }).first().click();

  // Il caso più frequente: la data c'è ma è quella sbagliata.
  await page.getByLabel("Scadenza da impostare").fill("2028-01-15");
  // exact: senza, ambiguo con "Salva modifiche" della Scheda sempre modificabile (v. Concept E).
  await page.getByRole("button", { name: "Salva", exact: true }).click();

  // La scadenza si vede sulla tab "Scheda", non più a fianco (v. Concept E).
  await page.getByRole("tab", { name: "Scheda" }).click();
  await expect(page.getByLabel("Scadenza")).toHaveValue("2028-01-15", { timeout: 20_000 });
});

test("le scelte sulle proposte restano in Attività", async ({ page }) => {
  test.slow();

  const user = await setUpWithPolizza(page);

  await page
    .getByRole("tabpanel", { name: "Letto dal dispositivo" })
    .getByRole("button", { name: "Accetta" })
    .first()
    .click();
  // La scadenza si vede sulla tab "Scheda", non più a fianco (v. Concept E).
  await page.getByRole("tab", { name: "Scheda" }).click();
  await expect(page.getByLabel("Scadenza")).toHaveValue("2027-06-03", { timeout: 20_000 });

  // Ogni scrittura automatica deve lasciare traccia.
  await page.getByRole("button", { name: fullName(user) }).click();
  // exact: senza, "Impostazioni" ambiguo con il link "Impostazioni → Hinthia" di AIAnalysisTrigger (FASE 22).
  await page.getByRole("link", { name: "Impostazioni", exact: true }).click();
  await page.getByRole("tab", { name: "Attività" }).click();
  await page.getByRole("button", { name: "Trova" }).click();

  await expect(page.getByText("Proposta accettata").first()).toBeVisible({ timeout: 30_000 });
});
