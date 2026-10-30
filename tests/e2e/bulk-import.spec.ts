import { expect, test } from "./fixtures";
import { createConfirmedTestUser, uniqueTestUser } from "./test-users";

// Requires a configured Supabase project (.env.local) --- see README.md.
//
// FASE 21 --- import massivo: molti file in una volta, con un riepilogo
// per gruppi. Qui si prova il percorso vero: due file con lo stesso
// nome (a meno di numeri e date) propongono un fascicolo nuovo (il "raggruppamento evidente"
// del piano), un terzo file con un nome diverso resta da
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

test("due file con lo stesso nome propongono un fascicolo, importati insieme a un terzo senza gruppo", async ({
  page,
}) => {
  test.slow();

  await signInAndSetUpVault(page);

  await page.getByRole("button", { name: "+ Aggiungi contenuto" }).click();
  await page.getByRole("menuitem", { name: "Carica un file" }).click();
  await page.getByRole("radio", { name: /Carica un file/ }).click();

  // Lo stesso percorso del file singolo, con più file: si scelgono insieme.
  await page.setInputFiles('input[type="file"]', [
    {
      name: "bolletta-luce-01.pdf",
      mimeType: "application/pdf",
      buffer: buildPdf(["ENEL ENERGIA S.p.A.", "Bolletta luce gennaio", "Totale 50,00"]),
    },
    {
      name: "bolletta-luce-02.pdf",
      mimeType: "application/pdf",
      buffer: buildPdf(["ENEL ENERGIA S.p.A.", "Bolletta luce febbraio", "Totale 55,00"]),
    },
    {
      name: "biglietto-treno.txt",
      mimeType: "text/plain",
      buffer: Buffer.from("Biglietto del treno."),
    },
  ]);

  // I tre file sono in elenco, letti uno alla volta.
  await expect(page.getByText("bolletta-luce-01.pdf")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText("bolletta-luce-02.pdf")).toBeVisible();
  await expect(page.getByText("biglietto-treno.txt")).toBeVisible();

  // Anche a passo chiuso, il riepilogo dei Dettagli dice che un fascicolo è proposto.
  await expect(page.getByText(/fascicolo «Bolletta luce»/)).toBeVisible();

  // I Dettagli valgono per tutti i file, e la proposta di un fascicolo nuovo per le due bollette è già selezionata
  // (è un raggruppamento evidente).
  await page.getByRole("button", { name: "Continua →" }).click();
  await expect(page.getByText("Questi dettagli valgono per tutti i 3 file.")).toBeVisible();
  await expect(page.getByText(/hanno lo stesso nome/, { exact: false })).toBeVisible();

  // Il titolo proposto per il fascicolo nuovo è il nome comune dei file.
  await expect(page.getByLabel("Titolo del fascicolo proposto")).toHaveValue("Bolletta luce");

  await page.getByRole("button", { name: "Aggiungi 3 file all'archivio" }).click();

  // Dopo un lotto si arriva alla conferma: una scheda per documento, i gesti per tutti in cima.
  await expect(page).toHaveURL(/\/archive\/confirm\?ids=/, { timeout: 60_000 });
  await expect(page.getByRole("heading", { name: "3 documenti da confermare" })).toBeVisible();
  await expect(page.getByRole("link", { name: "bolletta-luce-01.pdf" })).toBeVisible();
  await expect(page.getByRole("link", { name: "biglietto-treno.txt" })).toBeVisible();
  // Senza la lettura di Silva non ci sono proposte: lo dice, e non scrive nulla.
  await expect(page.getByText("Nessuna proposta, per ora").first()).toBeVisible();

  // Per tutti: una categoria applicata a ogni documento con un solo gesto, e annullabile.
  const perTutti = page.getByRole("region", { name: "Per tutti" });
  const categoriaDocumento = page.getByLabel("Categoria per biglietto-treno.txt");
  await expect(categoriaDocumento).toHaveValue("");
  await perTutti.getByLabel("Categoria").selectOption({ index: 1 });
  await perTutti.getByRole("button", { name: "Applica a tutti" }).click();
  await expect(page.getByText("Applicato a 3 documenti.")).toBeVisible({ timeout: 30_000 });
  await expect(categoriaDocumento).not.toHaveValue("");
  await expect(page.getByLabel("Categoria per bolletta-luce-01.pdf")).not.toHaveValue("");
  await page.getByRole("button", { name: "Annulla", exact: true }).click();
  await expect(page.getByText("Annullato.")).toBeVisible({ timeout: 30_000 });
  await expect(categoriaDocumento).toHaveValue("");

  // Un documento solo si cambia dai suoi campi, subito.
  await categoriaDocumento.selectOption({ index: 1 });
  await expect(categoriaDocumento).not.toHaveValue("");
  await expect(page.getByLabel("Categoria per bolletta-luce-01.pdf")).toHaveValue("");

  // Senza la lettura di Silva non c'è nulla da decidere: tornare all'archivio non lascia promemoria.
  await page.getByRole("link", { name: "Torna all'archivio", exact: true }).click();
  await expect(page).toHaveURL(/\/archive$/, { timeout: 15_000 });
  await expect(page.getByText(/importati da confermare/)).toHaveCount(0);

  // I documenti si chiamano come i file: il contenuto non decide più il titolo.
  await expect(page.getByRole("link", { name: /bolletta-luce-01\.pdf/ })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole("link", { name: /bolletta-luce-02\.pdf/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /biglietto-treno\.txt/ })).toBeVisible();

  // Il fascicolo è nato, con dentro le due bollette --- non il biglietto.
  await page.getByRole("link", { name: "Fascicoli", exact: true }).click();
  await expect(page).toHaveURL(/\/dossiers$/, { timeout: 15_000 });
  await expect(page.getByRole("heading", { name: "Archivio" })).toBeVisible();
  await page.getByRole("link", { name: /Bolletta luce/ }).click();
  const cronologia = page.getByRole("region", { name: "Cronologia" });
  await expect(cronologia.getByRole("link", { name: /bolletta-luce-01/ })).toBeVisible();
  await expect(cronologia.getByRole("link", { name: /bolletta-luce-02/ })).toBeVisible();
  await expect(cronologia.getByText(/biglietto-treno/)).not.toBeVisible();
});
