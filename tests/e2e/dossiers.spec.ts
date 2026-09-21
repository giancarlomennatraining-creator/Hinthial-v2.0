import { expect, test } from "./fixtures";
import { createConfirmedTestUser, uniqueTestUser } from "./test-users";

// Requires a configured Supabase project (.env.local) --- see README.md.
//
// FASE 20 --- Fascicoli: vicende trasversali alle categorie, con una
// cronologia (i documenti collegati, in ordine di data) e un totale
// delle spese. Il collegamento si fa dal form del documento ("Fascicolo"),
// non da una UI di gestione sul fascicolo --- stesso schema di beni e
// categorie. Qui si prova il percorso vero, da capo a fondo: creare un
// fascicolo, collegarci un documento al caricamento, vedere la
// cronologia e il totale, chiudere/riaprire, ed eliminare senza perdere
// il documento.

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

test("creare un fascicolo, collegarci un documento al caricamento, e vederne la cronologia e il totale", async ({
  page,
}) => {
  test.slow();

  await signInAndSetUpVault(page);

  await page.getByRole("link", { name: "Fascicolo", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Fascicoli" })).toBeVisible();
  // La scheda "Fascicolo" è quella attiva adesso, "Contenuti" no.
  await expect(page.getByRole("link", { name: "Fascicolo", exact: true })).toHaveAttribute(
    "aria-current",
    "page",
  );
  await expect(page.getByRole("link", { name: "Contenuti", exact: true })).not.toHaveAttribute(
    "aria-current",
    "page",
  );
  await page.getByRole("link", { name: "+ Nuovo fascicolo" }).click();
  await page.getByLabel("Titolo").fill("Intervento al ginocchio");
  await page.getByLabel("Descrizione").fill("Visita, esami e intervento del 2026.");
  await page.getByRole("button", { name: "Crea fascicolo" }).click();
  await expect(page).toHaveURL(/\/dossiers$/, { timeout: 20_000 });
  await expect(page.getByText("Fascicolo creato.")).toBeVisible();
  await expect(page.getByRole("link", { name: /Intervento al ginocchio/ })).toBeVisible();

  // Il collegamento si fa dal form del documento, non da qui.
  await page.getByRole("link", { name: "Archivio", exact: true }).click();
  await page.getByRole("link", { name: "+ Aggiungi contenuto" }).click();
  await page.setInputFiles('input[type="file"]', {
    name: "referto-visita.pdf",
    mimeType: "application/pdf",
    buffer: buildPdf([
      "Ospedale San Giovanni",
      "Referto di visita ortopedica",
      "Emesso il 14 marzo 2026",
      // Niente simbolo di valuta: nel content stream di un PDF costruito
      // a mano un carattere fuori da Latin-1 (come "€") si corromperebbe
      // alla scrittura dei byte. L'etichetta "Totale" da sola basta a far
      // scattare AMOUNT_WITH_LABEL (v. structured-fields.ts).
      "Totale 85,00",
    ]),
  });
  await page.getByText(/Ho letto il documento/).waitFor({ timeout: 45_000 });
  await page.getByLabel("Fascicoli").selectOption({ label: "📂 Intervento al ginocchio" });
  await page.getByRole("button", { name: "+ Aggiungi fascicolo" }).click();
  await page.getByRole("button", { name: "Aggiungi all'archivio" }).click();
  await expect(page).toHaveURL(/\/archive$/, { timeout: 30_000 });

  // Nell'elenco, l'icona del documento ha il badge "in un fascicolo".
  await expect(page.getByTitle("In un fascicolo")).toBeVisible();
  await expect(page.getByRole("link", { name: "Contenuti", exact: true })).toHaveAttribute(
    "aria-current",
    "page",
  );

  // La scheda del documento mostra il fascicolo, con un link.
  await page.getByRole("link", { name: /referto-visita\.pdf/ }).click();
  await expect(page.getByRole("link", { name: /Intervento al ginocchio/ })).toBeVisible({
    timeout: 15_000,
  });
  await page.getByRole("link", { name: /Intervento al ginocchio/ }).click();

  // La cronologia del fascicolo: il documento c'è, con la data letta
  // dentro (14 mar 2026, non la data di caricamento) e il totale.
  await expect(page.getByRole("heading", { name: /Intervento al ginocchio/ })).toBeVisible();
  const cronologia = page.getByRole("region", { name: "Cronologia" });
  await expect(cronologia.getByRole("link", { name: /referto-visita\.pdf/ })).toBeVisible();
  await expect(cronologia).toContainText("14 mar 2026");
  await expect(cronologia).toContainText("85,00");

  // Chiudere e riaprire: un clic, non un form.
  await page.getByRole("button", { name: "Chiudi fascicolo" }).click();
  await expect(page.getByRole("button", { name: "Riapri fascicolo" })).toBeVisible({
    timeout: 10_000,
  });
  await page.getByRole("button", { name: "Riapri fascicolo" }).click();
  await expect(page.getByRole("button", { name: "Chiudi fascicolo" })).toBeVisible({
    timeout: 10_000,
  });

  // Eliminare il fascicolo non elimina il documento: solo lo scollega.
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Elimina" }).click();
  await expect(page).toHaveURL(/\/dossiers$/, { timeout: 15_000 });
  await expect(page.getByText("Fascicolo eliminato.")).toBeVisible();
  await expect(page.getByText(/Ancora nessun fascicolo/)).toBeVisible();

  await page.getByRole("link", { name: "Archivio", exact: true }).click();
  await expect(page.getByRole("link", { name: /referto-visita\.pdf/ })).toBeVisible();
});

test("un documento può stare in più di un fascicolo insieme (FASE 20c)", async ({ page }) => {
  test.slow();

  await signInAndSetUpVault(page);

  // Due vicende distinte. Un'attesa esplicita dell'URL dopo ogni
  // navigazione --- cliccare "+ Nuovo fascicolo" una seconda volta
  // troppo in fretta dopo il redirect della creazione precedente può
  // far leggere/scrivere sulla pagina sbagliata (v. lo stesso principio
  // già seguito più sotto per ogni altra navigazione in questo test).
  await page.getByRole("link", { name: "Fascicolo", exact: true }).click();
  await expect(page).toHaveURL(/\/dossiers$/, { timeout: 15_000 });
  await page.getByRole("link", { name: "+ Nuovo fascicolo" }).click();
  await expect(page).toHaveURL(/\/dossiers\/new$/, { timeout: 15_000 });
  await page.getByLabel("Titolo").fill("Acquisto casa");
  await page.getByRole("button", { name: "Crea fascicolo" }).click();
  await expect(page).toHaveURL(/\/dossiers$/, { timeout: 20_000 });
  await expect(page.getByText("Fascicolo creato.")).toBeVisible();
  await expect(page.getByRole("link", { name: /Acquisto casa/ })).toBeVisible();

  await page.getByRole("link", { name: "+ Nuovo fascicolo" }).click();
  await expect(page).toHaveURL(/\/dossiers\/new$/, { timeout: 15_000 });
  await page.getByLabel("Titolo").fill("Problema di salute");
  await page.getByRole("button", { name: "Crea fascicolo" }).click();
  await expect(page).toHaveURL(/\/dossiers$/, { timeout: 20_000 });
  await expect(page.getByText("Fascicolo creato.")).toBeVisible();
  await expect(page.getByRole("link", { name: /Problema di salute/ })).toBeVisible();

  // Un documento "a corredo" di entrambe --- il caso reale che ha
  // motivato il passaggio da un fascicolo solo a più fascicoli insieme.
  await page.getByRole("link", { name: "Contenuti", exact: true }).click();
  await expect(page).toHaveURL(/\/archive$/, { timeout: 15_000 });
  await page.getByRole("link", { name: "+ Aggiungi contenuto" }).click();
  await expect(page).toHaveURL(/\/archive\/new$/, { timeout: 15_000 });
  await page.setInputFiles('input[type="file"]', {
    name: "codice-fiscale.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("RSSMRA80A01H501U"),
  });
  await page.getByLabel("Fascicoli").selectOption({ label: "📂 Acquisto casa" });
  await page.getByRole("button", { name: "+ Aggiungi fascicolo" }).click();
  await page.getByLabel("Fascicoli").selectOption({ label: "📂 Problema di salute" });
  await page.getByRole("button", { name: "+ Aggiungi fascicolo" }).click();

  // Entrambi i chip, prima ancora di salvare.
  await expect(page.getByText("📂 Acquisto casa", { exact: true })).toBeVisible();
  await expect(page.getByText("📂 Problema di salute", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Aggiungi all'archivio" }).click();
  await expect(page).toHaveURL(/\/archive$/, { timeout: 15_000 });

  // La scheda del documento mostra entrambi i fascicoli, ognuno con un link.
  await page.getByRole("link", { name: /codice-fiscale\.txt/ }).click();
  await expect(page).toHaveURL(/\/archive\/[^/]+$/, { timeout: 15_000 });
  await expect(page.getByRole("link", { name: /Acquisto casa/ })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole("link", { name: /Problema di salute/ })).toBeVisible();

  // Ognuno dei due fascicoli lo elenca nella propria cronologia.
  await page.getByRole("link", { name: /Acquisto casa/ }).click();
  await expect(page).toHaveURL(/\/dossiers\/[^/]+$/, { timeout: 15_000 });
  await expect(page.getByRole("heading", { name: /Acquisto casa/ })).toBeVisible();
  await expect(
    page.getByRole("region", { name: "Cronologia" }).getByRole("link", { name: /codice-fiscale\.txt/ }),
  ).toBeVisible();

  await page.getByRole("link", { name: "← Torna ai fascicoli" }).click();
  await expect(page).toHaveURL(/\/dossiers$/, { timeout: 15_000 });
  await page.getByRole("link", { name: /Problema di salute/ }).click();
  await expect(page).toHaveURL(/\/dossiers\/[^/]+$/, { timeout: 15_000 });
  await expect(page.getByRole("heading", { name: /Problema di salute/ })).toBeVisible();
  await expect(
    page.getByRole("region", { name: "Cronologia" }).getByRole("link", { name: /codice-fiscale\.txt/ }),
  ).toBeVisible();

  // Rimuovere uno dei due fascicoli dalla scheda del documento non tocca l'altro.
  await page.getByRole("link", { name: "Archivio", exact: true }).click();
  await expect(page).toHaveURL(/\/archive$/, { timeout: 15_000 });
  await page.getByRole("link", { name: /codice-fiscale\.txt/ }).click();
  await expect(page).toHaveURL(/\/archive\/[^/]+$/, { timeout: 15_000 });
  await page.getByRole("link", { name: "Modifica" }).click();
  await expect(page).toHaveURL(/\/archive\/[^/]+\/edit$/, { timeout: 15_000 });
  await expect(page.getByRole("button", { name: "Rimuovi Problema di salute" })).toBeVisible();
  await page.getByRole("button", { name: "Rimuovi Problema di salute" }).click();
  await page.getByRole("button", { name: "Salva modifiche" }).click();
  await expect(page).toHaveURL(/\/archive$/, { timeout: 15_000 });

  await page.getByRole("link", { name: /codice-fiscale\.txt/ }).click();
  await expect(page).toHaveURL(/\/archive\/[^/]+$/, { timeout: 15_000 });
  await expect(page.getByRole("link", { name: /Acquisto casa/ })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole("link", { name: /Problema di salute/ })).not.toBeVisible();
});
