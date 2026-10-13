import { expect, test } from "./fixtures";
import { setUpWithDocument } from "./hinthia";
import { openSettings } from "./settings-nav";

// Requires a configured Supabase project (.env.local) --- see README.md.
//
// Effetto di apertura delle capsule, da Impostazioni > Aspetto > Capsule. La preferenza sta in una
// colonna di `profiles` aggiunta dalla migrazione 20261014000000: qui le richieste verso quella tabella sono simulate
// (`page.route`), così il test verifica l'interfaccia (cosa si propone, cosa si salva, come si presenta) a prescindere dal
// fatto che la migrazione sia stata applicata sul database di prova.

test("l'effetto delle capsule si sceglie in Impostazioni > Aspetto > Capsule, si prova, e cambia il modulo", async ({
  page,
}) => {
  test.slow();

  let stored: Record<string, string> = { capsule_open_effect: "discreet" };
  const patches: Record<string, string>[] = [];
  await page.route("**/rest/v1/profiles?*", async (route) => {
    const request = route.request();
    if (request.method() === "GET" && request.url().includes("capsule_open_effect")) {
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(stored) });
    }
    if (request.method() === "PATCH" && (request.postData() ?? "").includes("capsule_")) {
      const body = JSON.parse(request.postData() ?? "{}") as Record<string, string>;
      patches.push(body);
      stored = { ...stored, ...body };
      return route.fulfill({ status: 204, body: "" });
    }
    return route.fallback();
  });

  const user = await setUpWithDocument(page);

  await openSettings(page, user);
  await page.getByRole("tab", { name: "Aspetto" }).click();
  await page.getByRole("tab", { name: "Capsule" }).click();

  // L'effetto predefinito: cinque scelte, ognuna con "Provalo".
  const effetti = page.getByRole("radiogroup", { name: "Effetto di apertura predefinito" });
  await expect(effetti.getByRole("radio")).toHaveCount(5);
  await expect(effetti.getByRole("radio", { name: /^Sblocco discreto/ })).toHaveAttribute("aria-checked", "true");
  await effetti.getByRole("radio", { name: /^Zoom nell'oblò/ }).click();
  await expect.poll(() => patches.some((p) => p.capsule_open_effect === "zoom")).toBe(true);

  // "Provalo" mostra l'effetto con una capsula di esempio, e Esc lo chiude.
  await page.getByRole("button", { name: "Provalo: Luce e lettera" }).click();
  const anteprima = page.getByRole("dialog", { name: "Capsula condivisa" });
  await expect(anteprima).toHaveAttribute("data-effect", "light");
  await anteprima.getByRole("button", { name: "Salta" }).click();
  await expect(anteprima.getByText("Caro Marco, quando leggerai queste righe sarai grande.")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(anteprima).toHaveCount(0);

  await page.getByRole("button", { name: "Provalo: Ricordi uno a uno" }).click();
  await expect(anteprima).toHaveAttribute("data-effect", "deck");
  await expect(anteprima.getByText("Ricordo 1 di 4")).toBeVisible();
  await anteprima.getByRole("button", { name: "Avanti" }).click();
  await expect(anteprima.getByText("Ricordo 2 di 4")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(anteprima).toHaveCount(0);

  // Il modulo di nuova capsula propone l'effetto scelto qui, e permette di sceglierne un altro per questa capsula.
  await page.getByRole("link", { name: "Capsule", exact: true }).click();
  await page.getByRole("link", { name: "+ Crea capsula" }).click();
  await page.getByLabel("Titolo").fill("Con un effetto");
  await page.getByLabel("Data e ora di apertura", { exact: true }).fill("2038-03-12T10:00");
  await page.getByRole("button", { name: "Avanti" }).click();
  await page.getByRole("button", { name: "Avanti" }).click();
  await page.getByLabel("Il tuo messaggio").fill("Un pensiero per te");
  const zoom = page.getByRole("radio", { name: /^Zoom nell'oblò/ });
  await expect(zoom).toHaveAttribute("aria-checked", "true");
  await page.getByRole("radio", { name: /^Ricordi uno a uno/ }).click();
  await expect(page.getByRole("radio", { name: /^Ricordi uno a uno/ })).toHaveAttribute("aria-checked", "true");
  await page.getByRole("button", { name: "Prova l'effetto" }).click();
  const prova = page.getByRole("dialog", { name: "Capsula condivisa" });
  await expect(prova).toHaveAttribute("data-effect", "deck");
  await expect(prova.getByText("Un pensiero per te")).toBeVisible();
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Crea capsula" }).click();
  await expect(page).toHaveURL(/\/capsules$/, { timeout: 15_000 });

  // L'elenco è fatto di oblò.
  await expect(page.getByRole("listitem").filter({ hasText: "Con un effetto" })).toBeVisible({ timeout: 15_000 });
  // L'anello dell'oblò dice a parole a che punto è (una bozza non è ancora partita).
  await expect(page.getByRole("img", { name: /Bozza: il tempo non è ancora partito/ })).toBeVisible();
});
