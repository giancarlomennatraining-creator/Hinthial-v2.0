import { expect, test } from "./fixtures";

// L'entrata animata della prima apertura (v. lib/app-intro.ts). In una scheda del browser non compare da sola:
// `?intro=1` serve a provarla, e il primo passaggio dell'app installata si decide con le stesse regole (provate in
// tests/unit/app-intro.test.ts).

test("senza chiederla, in una scheda del browser, l'entrata non compare", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByRole("heading", { name: "Accedi" })).toBeVisible();
  await expect(page.locator("#app-intro")).toBeHidden();
  expect(await page.evaluate(() => document.documentElement.getAttribute("data-intro"))).toBeNull();
});

test("?intro=1 mostra l'entrata, dura circa tre secondi e mezzo e lascia la pagina di sempre", async ({ page }) => {
  await page.goto("/login?intro=1", { waitUntil: "commit" });
  const velo = page.locator("#app-intro");
  await expect(velo).toBeVisible();

  // Passati i 3,5 secondi il velo sparisce da solo e resta la pagina di accesso.
  await expect(velo).toBeHidden({ timeout: 8_000 });
  await expect(page.getByRole("heading", { name: "Accedi" })).toBeVisible();
  // Il velo è già invisibile per il solo CSS; un istante dopo lo script toglie anche il segno dalla pagina.
  await expect(page.locator("html")).not.toHaveAttribute("data-intro", "1", { timeout: 3_000 });

  // Ricordata: l'app installata non la mostrerebbe più.
  expect(await page.evaluate(() => window.localStorage.getItem("hinthial-intro-seen"))).toBe("1");
});

test("un tocco salta l'entrata", async ({ page }) => {
  await page.goto("/login?intro=1", { waitUntil: "commit" });
  const velo = page.locator("#app-intro");
  await expect(velo).toBeVisible();
  await page.waitForTimeout(800);
  await velo.click({ position: { x: 20, y: 20 } });
  await expect(velo).toBeHidden({ timeout: 1_500 });
});

test("chi ha chiesto meno movimento non la vede, nemmeno forzata", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/login?intro=1");
  await expect(page.getByRole("heading", { name: "Accedi" })).toBeVisible();
  await expect(page.locator("#app-intro")).toBeHidden();
});

test("?intro=0 la salta sempre", async ({ page }) => {
  await page.goto("/login?intro=0");
  await expect(page.getByRole("heading", { name: "Accedi" })).toBeVisible();
  await expect(page.locator("#app-intro")).toBeHidden();
});
