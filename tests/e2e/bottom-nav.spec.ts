import { expect, test } from "./fixtures";
import { createConfirmedTestUser, uniqueTestUser } from "./test-users";

// Requires a configured Supabase project (.env.local) --- see README.md.

test.use({ viewport: { width: 375, height: 800 } });

test("la barra fissa in basso mostra le voci di default, si personalizza da Impostazioni > Aspetto, ed esclude quelle voci dal menu con le 3 lineette", async ({
  page,
}) => {
  test.slow();

  const user = uniqueTestUser();
  await createConfirmedTestUser(user);

  await page.goto("/login");
  await page.getByLabel("Email").fill(user.email);
  await page.getByLabel("Password").fill(user.password);
  await page.getByRole("button", { name: "Accedi" }).click();
  await expect(page).toHaveURL(/\/dashboard$/, { timeout: 15_000 });

  // Default: Dashboard, Archivio, Scadenze, Capsule --- v. lib/bottom-nav.ts.
  const bottomBar = page.getByRole("navigation", { name: "Navigazione rapida" });
  await expect(bottomBar).toBeVisible();
  await expect(bottomBar.getByRole("link", { name: "Dashboard" })).toBeVisible();
  await expect(bottomBar.getByRole("link", { name: "Archivio" })).toBeVisible();
  await expect(bottomBar.getByRole("link", { name: "Scadenze" })).toBeVisible();
  await expect(bottomBar.getByRole("link", { name: "Capsule" })).toBeVisible();
  await expect(bottomBar.getByRole("link", { name: "Asset" })).toHaveCount(0);

  // Quelle voci non sono ripetute nel menu con le 3 lineette --- il
  // resto (es. "Asset") sì.
  const menuButton = page.getByRole("button", { name: "Apri il menu" });
  await menuButton.click();
  const drawer = page.getByRole("dialog", { name: "Menu di navigazione" });
  await expect(drawer).toBeVisible();
  await expect(drawer.getByRole("link", { name: "Archivio" })).toHaveCount(0);
  await expect(drawer.getByRole("link", { name: "Asset" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(drawer).not.toBeVisible();

  // In Impostazioni > Aspetto si toglie "Archivio" e si aggiunge "Asset".
  // Viewport da smartphone: Impostazioni è a elenco -> dettaglio (v.
  // mobile-settings-nav.spec.ts), non a schede come da desktop.
  await page.goto("/settings");
  await page.getByRole("button", { name: "Aspetto" }).click();
  await expect(
    page.getByRole("heading", { name: "Barra di navigazione in basso (smartphone)" }),
  ).toBeVisible();

  await Promise.all([
    page.waitForResponse((res) => res.url().includes("/profiles") && res.request().method() === "PATCH"),
    page.getByRole("checkbox", { name: "Archivio" }).uncheck(),
  ]);
  await Promise.all([
    page.waitForResponse((res) => res.url().includes("/profiles") && res.request().method() === "PATCH"),
    page.getByRole("checkbox", { name: "Asset" }).check(),
  ]);

  // Si applica subito alla barra, senza refresh...
  await expect(bottomBar.getByRole("link", { name: "Archivio" })).toHaveCount(0);
  await expect(bottomBar.getByRole("link", { name: "Asset" })).toBeVisible();

  // ...e resta impostata dopo un refresh vero (sincronizzata sul server,
  // letta prima ancora del primo render della shell, come nav_orientation).
  await page.goto("/dashboard");
  await page.reload();
  await expect(bottomBar.getByRole("link", { name: "Archivio" })).toHaveCount(0);
  await expect(bottomBar.getByRole("link", { name: "Asset" })).toBeVisible();

  // Il menu con le 3 lineette ora mostra di nuovo "Archivio" (non più
  // duplicato in basso) e non più "Asset" (ora in basso).
  await menuButton.click();
  await expect(drawer.getByRole("link", { name: "Archivio" })).toBeVisible();
  await expect(drawer.getByRole("link", { name: "Asset" })).toHaveCount(0);
});

test("oltre 4 voci scelte, le altre caselle si disabilitano", async ({ page }) => {
  const user = uniqueTestUser();
  await createConfirmedTestUser(user);

  await page.goto("/login");
  await page.getByLabel("Email").fill(user.email);
  await page.getByLabel("Password").fill(user.password);
  await page.getByRole("button", { name: "Accedi" }).click();
  await expect(page).toHaveURL(/\/dashboard$/, { timeout: 15_000 });

  // Viewport da smartphone: Impostazioni è a elenco -> dettaglio (v.
  // mobile-settings-nav.spec.ts), non a schede come da desktop.
  await page.goto("/settings");
  await page.getByRole("button", { name: "Aspetto" }).click();

  // Le 4 di default sono già selezionate --- una quinta è disabilitata.
  const fifthCheckbox = page.getByRole("checkbox", { name: "Contatti" });
  await expect(fifthCheckbox).toBeDisabled();
});
