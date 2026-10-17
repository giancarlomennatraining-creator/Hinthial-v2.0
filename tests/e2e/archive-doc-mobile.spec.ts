import { expect, test } from "./fixtures";
import { setUpWithDocument } from "./hinthia";

// Requires a configured Supabase project (.env.local) --- see README.md.
//
// La scheda di un contenuto su telefono: i campi vengono prima dell'anteprima (prima si compila, poi eventualmente si
// guarda il file) e le schede interne stanno su una riga che scorre, invece di andare su due righe. Su schermo largo
// resta l'anteprima a sinistra e i campi a destra.

test("su telefono i campi della scheda stanno sopra l'anteprima e le schede su una riga", async ({ page }) => {
  test.slow();
  // Si prepara da computer (i passi di accesso e di caricamento usano la barra laterale), poi si stringe lo schermo: il
  // layout segue la larghezza, senza ricaricare.
  await setUpWithDocument(page);
  await page.setViewportSize({ width: 390, height: 844 });

  const titolo = page.getByLabel("Titolo");
  const anteprima = page.getByRole("heading", { name: "Anteprima" });
  await expect(titolo).toBeVisible();
  await expect(anteprima).toBeVisible();
  const [campo, sezione] = [await titolo.boundingBox(), await anteprima.boundingBox()];
  expect(campo!.y).toBeLessThan(sezione!.y);

  // Le tre schede hanno la stessa altezza di riga: nessuna è andata a capo.
  const schede = page.getByRole("tab");
  await expect(schede).toHaveCount(3);
  const ys = await schede.evaluateAll((els) => els.map((el) => Math.round(el.getBoundingClientRect().top)));
  expect(new Set(ys).size).toBe(1);

  // Su schermo largo l'anteprima torna a sinistra dei campi.
  await page.setViewportSize({ width: 1440, height: 900 });
  const [campoLargo, sezioneLarga] = [await titolo.boundingBox(), await anteprima.boundingBox()];
  expect(sezioneLarga!.x).toBeLessThan(campoLargo!.x);
});
