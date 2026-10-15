import { expect, test } from "./fixtures";
import { setUpWithDocument } from "./hinthia";

// Requires a configured Supabase project (.env.local) --- see README.md.
//
// Nuova capsula da un modello: compila titolo e data (senza mai scavalcare ciò che si è già scritto) e porta con sé gli spunti.

test("una capsula nata da un modello ha titolo, data e spunti, e non scavalca ciò che scrivi tu", async ({ page }) => {
  test.slow();

  await setUpWithDocument(page);

  await page.getByRole("link", { name: "Capsule", exact: true }).click();
  await page.getByRole("link", { name: "+ Crea capsula" }).click();
  await expect(page.getByRole("heading", { name: "Nuova capsula" })).toBeVisible();

  // Parti da zero è il percorso di default: niente è compilato e il riquadro del modello non c'è.
  await expect(page.getByLabel("Titolo")).toHaveValue("");
  await expect(page.getByRole("region", { name: "Cosa propone il modello" })).toHaveCount(0);

  // Un modello con una data (tra 5 anni, alle 10:00) compila titolo e data e racconta cosa propone.
  await page.getByRole("button", { name: /Al me stesso di domani/ }).click();
  await expect(page.getByLabel("Titolo")).toHaveValue("Una lettera a me stesso");
  const expectedYear = new Date().getFullYear() + 5;
  await expect(page.getByLabel("Data e ora di apertura", { exact: true })).toHaveValue(
    new RegExp("^" + expectedYear + "-[0-9]{2}-[0-9]{2}T10:00$"),
  );
  const proposta = page.getByRole("region", { name: "Cosa propone il modello" });
  await expect(proposta).toContainText("Come sto oggi");
  await expect(proposta).toContainText("Una foto di oggi");

  // Un modello senza data (dipende dalla persona) la svuota, finché non l'hai scelta tu.
  await page.getByRole("button", { name: /Per i tuoi 18 anni/ }).click();
  await expect(page.getByLabel("Titolo")).toHaveValue("Per i tuoi 18 anni");
  await expect(page.getByLabel("Data e ora di apertura", { exact: true })).toHaveValue("");

  // Ciò che hai scritto tu non viene scavalcato da un altro modello.
  await page.getByLabel("Titolo").fill("Per Marco");
  await page.getByLabel("Data e ora di apertura", { exact: true }).fill("2038-03-12T10:00");
  await page.getByRole("button", { name: /Una lettera a me stesso|Al me stesso di domani/ }).click();
  await expect(page.getByLabel("Titolo")).toHaveValue("Per Marco");
  await expect(page.getByLabel("Data e ora di apertura", { exact: true })).toHaveValue("2038-03-12T10:00");
  await page.getByRole("button", { name: /Per i tuoi 18 anni/ }).click();

  // Gli spunti del modello sono nell'ultimo passo: toccarne uno lo mette nella lettera, da completare.
  await page.getByRole("button", { name: "Avanti" }).click();
  await expect(page.getByText("Passo 2 di 3")).toBeVisible();
  await page.getByRole("button", { name: "Avanti" }).click();
  await expect(page.getByText("Passo 3 di 3")).toBeVisible();
  await expect(page.getByText("Dal modello «Per i tuoi 18 anni»")).toBeVisible();

  const spunti = page.getByRole("group", { name: "Spunti per cominciare" });
  await expect(spunti.getByRole("button")).toHaveCount(4);
  await spunti.getByRole("button", { name: "Cosa spero per te" }).click();
  const lettera = page.getByLabel("Il tuo messaggio");
  await expect(lettera).toHaveValue("Cosa spero per te: ");
  await expect(spunti.getByRole("button", { name: "Cosa spero per te" })).toBeDisabled();
  // Il cursore entra nella lettera al fotogramma dopo lo spunto: si scrive solo quando c'è, o la prima lettera va persa.
  await expect(lettera).toBeFocused();
  await page.keyboard.type("che tu sia felice.");
  await expect(lettera).toHaveValue("Cosa spero per te: che tu sia felice.");

  // Un secondo spunto va in un nuovo paragrafo.
  await spunti.getByRole("button", { name: "Una cosa che non ti ho mai detto" }).click();
  await expect(lettera).toHaveValue("Cosa spero per te: che tu sia felice.\n\nUna cosa che non ti ho mai detto: ");

  // La capsula si crea come sempre, con il testo scritto.
  await page.getByRole("button", { name: "Crea capsula" }).click();
  await expect(page).toHaveURL(/\/capsules$/, { timeout: 15_000 });
  await expect(page.locator("li", { hasText: "Per Marco" })).toBeVisible({ timeout: 15_000 });
});
