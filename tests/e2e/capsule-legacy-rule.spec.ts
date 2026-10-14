import { expect, test } from "./fixtures";
import { setUpWithDocument } from "./hinthia";
import { openRowMenu } from "./row-actions";

// Requires a configured Supabase project (.env.local) --- see README.md.
//
// La regola "aprila anche prima, se non ci sono più": si sceglie accanto alla data, si legge nell'elenco e nella verifica
// prima di chiudere, e si può cambiare anche dopo aver chiuso la capsula. Richiede la colonna `capsules.open_on_legacy`
// (migrazione 20261016000000) sul database di prova.

test("ogni capsula sceglie se aprirsi anche prima, se l'eredità consegna: lo si vede nell'elenco, nella verifica e si cambia da chiusa", async ({
  page,
}) => {
  test.slow();

  await setUpWithDocument(page);
  await page.getByRole("link", { name: "Capsule", exact: true }).click();

  // Due capsule con la stessa data lontana: una chiede di aprirsi anche prima, l'altra no.
  for (const [title, early] of [
    ["Per i miei figli", true],
    ["Per Marco a 18 anni", false],
  ] as const) {
    await page.getByRole("link", { name: "+ Crea capsula" }).click();
    await expect(page.getByRole("heading", { name: "Nuova capsula" })).toBeVisible();
    await page.getByLabel("Titolo").fill(title);
    await page.getByLabel("Data e ora di apertura", { exact: true }).fill("2038-03-12T10:00");

    // Spenta per scelta, con la spiegazione di cosa significa.
    const rule = page.getByRole("checkbox", { name: /Aprila anche prima, se non ci sono più/ });
    await expect(rule).not.toBeChecked();
    await expect(page.getByText("Si apre solo alla data scelta, qualunque cosa succeda.")).toBeVisible();
    if (early) {
      await rule.check();
      await expect(page.getByText(/quando l'Eredità digitale consegna le capsule/)).toBeVisible();
    }
    await page.getByRole("button", { name: "Avanti" }).click();
    await page.getByRole("button", { name: "Avanti" }).click();
    await page.getByLabel("Il tuo messaggio").fill("Un pensiero per te.");
    await page.getByRole("button", { name: "Crea capsula" }).click();
    await expect(page).toHaveURL(/\/capsules$/, { timeout: 15_000 });
  }

  // Nell'elenco solo la prima porta la pillola.
  const figli = page.getByRole("listitem").filter({ hasText: "Per i miei figli" });
  const marco = page.getByRole("listitem").filter({ hasText: "Per Marco a 18 anni" });
  await expect(figli.getByText("Anche prima, se non ci sono più")).toBeVisible({ timeout: 15_000 });
  await expect(marco.getByText("Anche prima, se non ci sono più")).toHaveCount(0);

  // Prima di chiudere, la verifica lo dice a parole.
  await openRowMenu(figli);
  await page.getByRole("menuitem", { name: "Chiudi la capsula" }).click();
  const dialog = page.getByRole("dialog", { name: "Prima di chiudere la capsula" });
  await expect(dialog.getByText(/o prima se non ci sarai più/)).toBeVisible();
  await dialog.getByRole("button", { name: "Chiudi la capsula" }).click();
  await expect(figli.getByText("Chiusa", { exact: true })).toBeVisible({ timeout: 15_000 });

  // Anche da chiusa la regola si cambia, finché la capsula non si è aperta.
  await openRowMenu(figli);
  await page.getByRole("menuitem", { name: "Aprila solo alla data" }).click();
  await expect(page.getByText("Si aprirà solo alla data scelta.")).toBeVisible();
  await expect(figli.getByText("Anche prima, se non ci sono più")).toHaveCount(0);

  await openRowMenu(marco);
  await expect(page.getByRole("menuitem", { name: "Aprila anche prima, se non ci sono più" })).toHaveCount(0); // ancora bozza: si sceglie dal modulo
  await page.keyboard.press("Escape");
});
