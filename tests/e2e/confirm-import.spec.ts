import { expect, test } from "./fixtures";
import { buildPdf } from "./hinthia";
import { createConfirmedTestUser, uniqueTestUser } from "./test-users";

// Requires a configured Supabase project (.env.local) --- see README.md.
//
// La conferma dopo un'importazione: più documenti, una lettura di gruppo di Hinthia con una sola conferma, le proposte per
// documento e "Accetta le sicure" (con annulla). La risposta del modello è simulata sulla route: non serve una vera chiave.

const MASTER_PASSWORD = "una-master-password-solida";

test("dopo un lotto Hinthia legge i documenti con una sola conferma e le proposte si accettano in blocco", async ({ page }) => {
  test.slow();

  const user = uniqueTestUser();
  await createConfirmedTestUser(user);

  await page.goto("/login");
  await page.getByLabel("Email").fill(user.email);
  await page.getByLabel("Password").fill(user.password);
  await page.getByRole("button", { name: "Accedi" }).click();
  await expect(page).toHaveURL(/\/dashboard$/, { timeout: 15_000 });

  // La lettura di Hinthia è un consenso: si accende dalle Impostazioni (funzione generale + estrazione avanzata).
  await page.goto("/settings");
  await page.getByRole("tab", { name: "Privacy e Hinthia" }).click();
  const masterSwitch = page.getByRole("switch", { name: "Consenti l'uso di Hinthia" });
  await Promise.all([
    page.waitForResponse((res) => res.url().includes("/profiles") && res.request().method() === "PATCH"),
    masterSwitch.click(),
  ]);
  await expect(masterSwitch).toHaveAttribute("aria-checked", "true");
  await Promise.all([
    page.waitForResponse((res) => res.url().includes("/profiles") && res.request().method() === "PATCH"),
    page.getByRole("checkbox", { name: /^Estrazione avanzata/ }).check(),
  ]);

  // Il modello, simulato: per ogni blocco trova una scadenza e un emittente, citando il testo inviato.
  await page.route("**/api/ai/analyze", async (route) => {
    const body = route.request().postDataJSON() as { mode: string; block?: { segmentIds: string[] } };
    if (body.mode !== "block" || !body.block) {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ synthesis: "Documento di prova." }) });
      return;
    }
    const segmentId = body.block.segmentIds[0];
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        result: {
          documentType: "generico",
          expiry: [{ value: "2027-03-15", segmentId, quote: "scade il 2027-03-15" }],
          issuer: [{ value: "ENEL Energia", segmentId, quote: "Emittente: ENEL Energia" }],
          category: null,
          fields: [],
          events: [],
          synthesis: "Polizza di prova.",
        },
      }),
    });
  });

  await page.goto("/archive");
  await page.getByLabel("Master password", { exact: true }).fill(MASTER_PASSWORD);
  await page.getByLabel("Conferma master password").fill(MASTER_PASSWORD);
  await page.getByRole("button", { name: "Crea" }).click();
  await expect(page.getByLabel("Ho salvato la recovery key in un posto sicuro.")).toBeVisible({ timeout: 45_000 });
  await page.getByLabel("Ho salvato la recovery key in un posto sicuro.").check();
  await page.getByRole("button", { name: "Continua" }).click();
  await expect(page.getByRole("heading", { name: "Archivio" })).toBeVisible();

  // Due documenti caricati insieme.
  await page.getByRole("button", { name: "+ Aggiungi contenuto" }).click();
  await page.getByRole("menuitem", { name: "Carica un file" }).click();
  await page.getByRole("radio", { name: /Carica un file/ }).click();
  await page.setInputFiles('input[type="file"]', [
    { name: "polizza-casa.pdf", mimeType: "application/pdf", buffer: buildPdf(["Polizza casa", "Emittente: ENEL Energia", "La polizza scade il 2027-03-15"]) },
    { name: "polizza-auto.pdf", mimeType: "application/pdf", buffer: buildPdf(["Polizza auto", "Emittente: ENEL Energia", "La polizza scade il 2027-03-15"]) },
  ]);
  await expect(page.getByText("polizza-auto.pdf")).toBeVisible({ timeout: 30_000 });
  await page.getByRole("button", { name: "Aggiungi 2 file all'archivio" }).click();

  // La conferma: nessuna proposta finché Hinthia non ha letto, e la lettura parte solo dopo una conferma.
  await expect(page).toHaveURL(/\/archive\/confirm\?ids=/, { timeout: 60_000 });
  await expect(page.getByRole("heading", { name: "2 documenti da confermare" })).toBeVisible();
  await expect(page.getByText("Nessuna proposta, per ora").first()).toBeVisible();

  // Con una lettura ancora da fare, tornare all'archivio lascia la conferma in sospeso: da lì si riapre.
  await page.getByRole("link", { name: "Torna all'archivio", exact: true }).click();
  await expect(page).toHaveURL(/\/archive$/, { timeout: 15_000 });
  await expect(page.getByText("Hai 2 documenti importati da confermare.")).toBeVisible({ timeout: 15_000 });
  await page.getByRole("link", { name: "Rivedi" }).click();
  await expect(page.getByRole("heading", { name: "2 documenti da confermare" })).toBeVisible();

  let confirmMessage = "";
  page.once("dialog", async (dialog) => {
    confirmMessage = dialog.message();
    await dialog.accept();
  });
  await page.getByRole("button", { name: "Chiedi a Hinthia di leggere questi 2 documenti" }).click();
  await expect(page.getByText("Hinthia ha letto 2 documenti.")).toBeVisible({ timeout: 60_000 });
  expect(confirmMessage).toContain("Il testo di 2 documenti verrà inviato a Hinthia");
  expect(confirmMessage).toContain("polizza-casa.pdf");

  // Le proposte, per documento: scadenza ed emittente, con la citazione del testo.
  const casa = page.getByRole("list", { name: "Proposte per polizza-casa.pdf" });
  await expect(casa.getByText(/Scadenza del documento:/)).toBeVisible();
  await expect(casa.getByText("Emittente: ENEL Energia", { exact: true })).toBeVisible();
  await expect(casa.getByText(/scade il 2027-03-15/)).toBeVisible();

  // "Accetta le sicure": una per tipo e per documento, quindi quattro in tutto.
  await page.getByRole("button", { name: "Accetta le 4 proposte sicure" }).click();
  await expect(page.getByText("4 informazioni aggiunte ai documenti.")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText("Nessuna proposta da decidere").first()).toBeVisible();

  // Annullare riporta le proposte.
  await page.getByRole("button", { name: "Annulla", exact: true }).click();
  await expect(page.getByText("Annullato.")).toBeVisible({ timeout: 30_000 });
  await expect(casa.getByText("Emittente: ENEL Energia", { exact: true })).toBeVisible();

  // Un Sì su una sola proposta, un No su un'altra.
  await page.getByRole("button", { name: /^Sì: Emittente: ENEL Energia$/ }).first().click();
  await expect(casa.getByText("Emittente: ENEL Energia", { exact: true })).toHaveCount(0, { timeout: 30_000 });
  await page.getByRole("button", { name: /^No: Scadenza del documento:/ }).first().click();
  await expect(casa.getByText(/Scadenza del documento:/)).toHaveCount(0, { timeout: 30_000 });

  await page.getByRole("button", { name: "Ho finito" }).click();
  await expect(page).toHaveURL(/\/archive$/, { timeout: 15_000 });
});
