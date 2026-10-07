import { expect, test } from "./fixtures";
import { enableHinthia, setUpWithDocument } from "./hinthia";

// Requires a configured Supabase project (.env.local) --- see README.md.
//
// "In breve": Hinthia riassume le sintesi dei documenti che ha già letto. La lettura e il riassunto sono simulati qui
// (nessuna chiamata a Claude); i permessi veri della rotta sono provati dai test unitari (dossier-summary.test.ts).

test("un fascicolo con un documento letto da Hinthia si può riassumere, e il riassunto si ritrova", async ({ page }) => {
  test.slow();

  // La lettura del documento: una sintesi, così il documento risulta "letto da Hinthia".
  await page.route("**/api/ai/analyze", (route) => {
    const request = route.request().postDataJSON() as { mode?: string };
    if (request.mode === "merge") {
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ synthesis: null }) });
    }
    const result = {
      documentType: "generico",
      expiry: [{ value: "2027-06-03", segmentId: "p1", quote: "Valida fino al 3 giugno 2027" }],
      issuer: [{ value: "GENERALI ITALIA S.p.A.", segmentId: "p1", quote: "GENERALI ITALIA S.p.A." }],
      category: null,
      fields: [],
      events: [],
      synthesis: "Una polizza di responsabilità civile di Generali, valida fino al 3 giugno 2027.",
    };
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ result }) });
  });
  let summaryRequests = 0;
  await page.route("**/api/ai/dossier-summary", (route) => {
    summaryRequests += 1;
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ summary: "Una vicenda assicurativa: polizza Generali valida fino a giugno 2027.", used: 1, skipped: 0 }),
    });
  });

  await setUpWithDocument(page, { filename: "polizza-auto.pdf" });

  // Il fascicolo, e il documento dentro.
  await page.getByRole("link", { name: "Archivio", exact: true }).click();
  await page.getByRole("link", { name: "Fascicolo", exact: true }).click();
  await page.getByRole("link", { name: "+ Nuovo fascicolo" }).click();
  await page.getByLabel("Titolo").fill("Polizza auto");
  await page.getByRole("button", { name: "Crea fascicolo" }).click();
  await expect(page).toHaveURL(/\/dossiers$/, { timeout: 20_000 });
  await page.getByRole("link", { name: "Archivio", exact: true }).click();
  await page.getByRole("link", { name: /polizza-auto\.pdf/ }).click();
  await page.getByRole("tab", { name: "Scheda" }).click();
  await page.getByLabel("Fascicoli").selectOption({ label: "📂 Polizza auto" });
  await page.getByRole("button", { name: "+ Aggiungi fascicolo" }).click();
  await page.getByRole("button", { name: "Salva modifiche" }).click();
  await expect(page.getByRole("button", { name: "Salva modifiche" })).toBeDisabled({ timeout: 20_000 });

  // Hinthia legge il documento.
  await enableHinthia(page);
  await page.getByRole("tab", { name: /^Chiedi a Hinthia/ }).click();
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Solo questa volta" }).click();
  await expect(page.getByRole("tab", { name: /^Chiedi a Hinthia · \d+/ })).toBeVisible({ timeout: 20_000 });

  // Il fascicolo offre il riassunto, e Hinthia lo scrive solo quando glielo si chiede.
  await page.getByRole("link", { name: "Archivio", exact: true }).click();
  await page.getByRole("link", { name: "Fascicolo", exact: true }).click();
  await page.getByRole("link", { name: /Polizza auto/ }).click();
  const inBreve = page.getByRole("region", { name: "In breve" });
  await expect(inBreve).toContainText("1 letto", { timeout: 20_000 });
  expect(summaryRequests).toBe(0);
  await inBreve.getByRole("button", { name: "Scrivi il riassunto" }).click();
  await expect(inBreve).toContainText("Una vicenda assicurativa", { timeout: 20_000 });
  await expect(inBreve).toContainText("letto da 1 documento");
  expect(summaryRequests).toBe(1);

  // Il riassunto è salvato (cifrato) nel fascicolo: riaprendolo c'è ancora, e si può eliminare.
  await page.getByRole("link", { name: "← Torna ai fascicoli" }).click();
  await page.getByRole("link", { name: /Polizza auto/ }).click();
  await expect(page.getByRole("region", { name: "In breve" })).toContainText("Una vicenda assicurativa", { timeout: 15_000 });
  await page.getByRole("button", { name: "Elimina il riassunto" }).click();
  await expect(page.getByRole("region", { name: "In breve" })).toContainText("Scrivi il riassunto", { timeout: 15_000 });
});
