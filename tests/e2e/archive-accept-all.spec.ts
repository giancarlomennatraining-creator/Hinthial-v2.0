import { expect, test } from "./fixtures";
import { MASTER_PASSWORD, openAnalysedDocument, setUpWithDocument } from "./hinthia";

// Requires a configured Supabase project (.env.local) --- see README.md.
//
// "Accetta tutto" nella Scheda, voci libere modificabili secondo il tipo di dato (una data col calendario), e la
// Scheda impilata su smartphone. La lettura di Hinthia è simulata (v. hinthia.ts): nessuna chiamata reale alla API.

test("Accetta tutto aggiunge in un colpo ciò che Hinthia ha trovato, le voci restano modificabili col loro tipo di dato, e si annulla", async ({
  page,
}) => {
  test.slow();

  // Scadenza, emittente e due campi liberi: 4 proposte (senza categoria).
  await openAnalysedDocument(page, { expectedProposals: 4, fields: true, category: false });

  // Prima che Hinthia abbia letto non c'è niente da accettare: il banner compare solo con le sue proposte.
  await page.getByRole("tab", { name: "Scheda" }).click();
  const banner = page.getByRole("group", { name: "Informazioni trovate da Hinthia" });
  await expect(banner).toContainText("4 informazioni");
  await banner.getByRole("button", { name: "Accetta tutto" }).click();

  const lastAction = page.getByRole("status", { name: "Ultima proposta" });
  await expect(lastAction).toContainText("4 informazioni aggiunte alla Scheda", { timeout: 20_000 });
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
  await expect(page.getByRole("button", { name: "Salva modifiche" })).toBeDisabled({ timeout: 20_000 });

  await page.reload();
  await page.getByLabel("Master password", { exact: true }).fill(MASTER_PASSWORD);
  await page.getByRole("button", { name: "Sblocca", exact: true }).click();
  await expect(page.getByLabel("Data di nascita")).toHaveValue("1991-01-02", { timeout: 30_000 });
  await expect(page.getByLabel("Numero polizza")).toHaveValue("ZZZ999");
});

test("Accetta tutto si annulla in un colpo solo", async ({ page }) => {
  test.slow();

  // Solo scadenza ed emittente: 2 proposte.
  await openAnalysedDocument(page, { expectedProposals: 2, category: false });

  await page.getByRole("tab", { name: "Scheda" }).click();
  const banner = page.getByRole("group", { name: "Informazioni trovate da Hinthia" });
  await expect(banner).toContainText("2 informazioni", { timeout: 30_000 });
  await banner.getByRole("button", { name: "Accetta tutto" }).click();

  const lastAction = page.getByRole("status", { name: "Ultima proposta" });
  await expect(lastAction).toContainText("2 informazioni aggiunte alla Scheda", { timeout: 20_000 });
  await expect(page.getByLabel("Scadenza")).toHaveValue("2027-06-03");

  await lastAction.getByRole("button", { name: "Annulla" }).click();
  await expect(page.getByLabel("Scadenza")).toHaveValue("", { timeout: 20_000 });
  await expect(banner).toContainText("2 informazioni");
});

test("senza Hinthia il documento ha il testo letto ma nessuna proposta da accettare", async ({ page }) => {
  test.slow();

  await setUpWithDocument(page);

  // Nessuna lettura di Hinthia: la Scheda è vuota e il dispositivo non ricava scadenza, emittente o categoria.
  await expect(page.getByRole("group", { name: "Informazioni trovate da Hinthia" })).toHaveCount(0);
  await expect(page.getByLabel("Scadenza")).toHaveValue("");

  await page.getByRole("tab", { name: "Letto dal dispositivo" }).click();
  await expect(page.getByTestId("extracted-text")).toContainText("GENERALI ITALIA S.p.A.");
  await expect(page.getByRole("button", { name: "Accetta", exact: true })).toHaveCount(0);
  await expect(page.getByRole("region", { name: "Cosa ne ho ricavato" })).toHaveCount(0);
});

test("su smartphone le voci della Scheda stanno una sotto l'altra", async ({ page }) => {
  test.slow();

  await setUpWithDocument(page);
  await page.setViewportSize({ width: 390, height: 844 });

  const categoria = page.getByLabel("Categoria");
  const bene = page.getByLabel("Bene collegato");
  const scadenza = page.getByLabel("Scadenza");
  await expect(scadenza).toBeVisible();

  const [c, b, s] = await Promise.all([categoria.boundingBox(), bene.boundingBox(), scadenza.boundingBox()]);
  if (!c || !b || !s) throw new Error("Campi della Scheda non misurabili.");
  expect(b.y).toBeGreaterThan(c.y + c.height - 1);
  expect(s.y).toBeGreaterThan(b.y + b.height - 1);
  expect(Math.abs(b.x - c.x)).toBeLessThan(2);
  expect(Math.abs(s.x - c.x)).toBeLessThan(2);
});
