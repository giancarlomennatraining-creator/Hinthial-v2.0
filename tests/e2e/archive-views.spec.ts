import { expect, test } from "./fixtures";
import { setUpWithDocument } from "./hinthia";

// Requires a configured Supabase project (.env.local) --- see README.md.
//
// Le tre viste dell'Archivio: Panoramica (quella di partenza), Schede ed Elenco. Gli altri test partono dall'Elenco
// (v. fixtures.ts); qui si parte da una visita nuova, senza una vista scelta.

test("l'Archivio parte dalla Panoramica e si sfoglia per Schede ed Elenco", async ({ page }) => {
  test.slow();

  await setUpWithDocument(page, { filename: "polizza.pdf" });

  // Come chi non ha mai scelto una vista: la fixture ne imposta una sola volta, qui la si toglie.
  await page.evaluate(() => window.localStorage.removeItem("hinthial-archive-view"));
  await page.getByRole("link", { name: "Archivio", exact: true }).click();
  await expect(page).toHaveURL(/\/archive$/, { timeout: 15_000 });

  const vista = page.getByRole("radiogroup", { name: "Vista dell'archivio" });
  await expect(vista.getByRole("radio", { name: "Panoramica" })).toHaveAttribute("aria-checked", "true");

  // La Panoramica dice cosa chiede attenzione, mostra l'ultimo arrivato e porta alle categorie.
  await expect(page.getByRole("heading", { name: "Da guardare" })).toBeVisible();
  await expect(page.getByRole("button", { name: /1 contenuto senza categoria/ })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Aggiunti di recente" })).toBeVisible();
  await expect(page.getByRole("link", { name: /polizza\.pdf/ })).toBeVisible();
  await expect(page.getByRole("checkbox")).toHaveCount(0);

  // Un riquadro di categoria porta alle Schede già filtrate.
  await page.getByRole("button", { name: /Senza categoria/ }).click();
  await expect(vista.getByRole("radio", { name: "Schede" })).toHaveAttribute("aria-checked", "true");
  await expect(page.getByLabel("Filtra per categoria")).toHaveValue("none");
  await expect(page.getByRole("link", { name: /polizza\.pdf/ })).toBeVisible();

  // La ricerca restringe, e dice quando non trova.
  await page.getByLabel("Cerca nell'archivio").fill("zzzz");
  await expect(page.getByText("Nessun contenuto corrisponde ai filtri.")).toBeVisible();
  await page.getByLabel("Cerca nell'archivio").fill("polizza");
  await expect(page.getByRole("link", { name: /polizza\.pdf/ })).toBeVisible();

  // L'Elenco è quello di sempre, con la selezione; e la scelta resta sul dispositivo.
  await vista.getByRole("radio", { name: "Elenco" }).click();
  await expect(page.getByLabel("Seleziona polizza.pdf")).toBeVisible();
  await expect(page.getByLabel("Cerca nell'archivio")).toHaveValue("polizza");
  expect(await page.evaluate(() => window.localStorage.getItem("hinthial-archive-view"))).toBe("elenco");
});
