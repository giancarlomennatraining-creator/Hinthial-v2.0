import { expect, test } from "./fixtures";
import { setUpWithDocument } from "./hinthia";
import { openSettings } from "./settings-nav";

// Requires a configured Supabase project (.env.local) --- see README.md.
//
// Stile dell'elenco ed effetto di apertura delle capsule, da Impostazioni > Aspetto > Capsule. Le due preferenze stanno in
// colonne di `profiles` aggiunte dalla migrazione 20261014000000: qui le richieste verso quella tabella sono simulate
// (`page.route`), così il test verifica l'interfaccia (cosa si propone, cosa si salva, come si presenta) a prescindere dal
// fatto che la migrazione sia stata applicata sul database di prova.

test("lo stile e l'effetto delle capsule si scelgono in Impostazioni > Aspetto > Capsule, si provano, e cambiano elenco e modulo", async ({
  page,
}) => {
  test.slow();

  let stored: Record<string, string> = { capsule_style: "envelope", capsule_open_effect: "discreet" };
  const patches: Record<string, string>[] = [];
  await page.route("**/rest/v1/profiles?*", async (route) => {
    const request = route.request();
    if (request.method() === "GET" && request.url().includes("capsule_style")) {
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

  // Lo stile dell'elenco: tre scelte, "Buste" quella di partenza.
  await expect(page.getByRole("heading", { name: "Stile delle capsule" })).toBeVisible();
  const stile = page.getByRole("radiogroup", { name: "Stile delle capsule" });
  await expect(stile.getByRole("radio")).toHaveCount(3);
  await expect(stile.getByRole("radio", { name: /^Buste/ })).toHaveAttribute("aria-checked", "true");
  await stile.getByRole("radio", { name: /^Flat/ }).click();
  await expect(stile.getByRole("radio", { name: /^Flat/ })).toHaveAttribute("aria-checked", "true");
  await expect.poll(() => patches.some((p) => p.capsule_style === "flat")).toBe(true);

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

  // L'elenco è nello stile scelto (Flat), e cambia cambiando la preferenza.
  await expect(page.locator('[data-capsule-style="flat"]')).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole("listitem").filter({ hasText: "Con un effetto" })).toBeVisible();
  stored = { ...stored, capsule_style: "porthole" };
  await page.getByRole("link", { name: "Dashboard", exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard$/, { timeout: 15_000 });
  await page.getByRole("link", { name: "Capsule", exact: true }).click();
  await expect(page.locator('[data-capsule-style="porthole"]')).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole("listitem").filter({ hasText: "Con un effetto" })).toBeVisible();
  // L'anello dell'oblò dice a parole a che punto è (una bozza non è ancora partita).
  await expect(page.getByRole("img", { name: /Bozza: il tempo non è ancora partito/ })).toBeVisible();
});
