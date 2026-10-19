import { expect, test } from "./fixtures";
import { createConfirmedTestUser, uniqueTestUser } from "./test-users";

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

test("dalle Impostazioni si sceglie quando mostrarla, si spegne il suono e si rivede subito", async ({ page }) => {
  test.slow();
  const user = uniqueTestUser();
  await createConfirmedTestUser(user);
  await page.goto("/login");
  await page.getByLabel("Email").fill(user.email);
  await page.getByLabel("Password").fill(user.password);
  await page.getByRole("button", { name: "Accedi" }).click();
  await expect(page).toHaveURL(/\/dashboard$/, { timeout: 15_000 });

  await page.goto("/settings");
  await page.getByRole("tab", { name: "Aspetto e preferenze" }).click();
  const gruppo = page.getByRole("radiogroup", { name: "Quando mostrare l'entrata" });
  await expect(gruppo.getByRole("radio", { name: "A ogni apertura" })).toHaveAttribute("aria-checked", "true");

  await gruppo.getByRole("radio", { name: "Mai" }).click();
  expect(await page.evaluate(() => window.localStorage.getItem("hinthial-intro-mode"))).toBe("never");
  await gruppo.getByRole("radio", { name: "Solo la prima volta" }).click();
  expect(await page.evaluate(() => window.localStorage.getItem("hinthial-intro-mode"))).toBe("first");

  await page.getByLabel("Con il suono").uncheck();
  expect(await page.evaluate(() => window.localStorage.getItem("hinthial-intro-sound"))).toBe("off");

  // «Rivedila ora»: il velo compare, e dopo circa tre secondi e mezzo se ne va.
  await page.getByRole("button", { name: "Rivedila ora" }).click();
  const velo = page.locator("#app-intro");
  await expect(velo).toBeVisible();
  await expect(velo).toBeHidden({ timeout: 8_000 });
});
