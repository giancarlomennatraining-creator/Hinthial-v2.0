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
  await expect(bottomBar.getByRole("link", { name: "Beni" })).toHaveCount(0);

  // Quelle voci non sono ripetute nel menu con le 3 lineette --- il
  // resto (es. "Beni") sì.
  const menuButton = page.getByRole("button", { name: "Apri il menu" });
  await menuButton.click();
  const drawer = page.getByRole("dialog", { name: "Menu di navigazione" });
  await expect(drawer).toBeVisible();
  await expect(drawer.getByRole("link", { name: "Archivio" })).toHaveCount(0);
  await expect(drawer.getByRole("link", { name: "Beni" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(drawer).not.toBeVisible();

  // In Impostazioni > Aspetto si toglie "Archivio" (dall'elenco "Nella
  // barra") e si aggiunge "Beni" (dall'elenco "Altre voci"). Viewport
  // da smartphone: Impostazioni è a elenco -> dettaglio (v.
  // mobile-settings-nav.spec.ts), non a schede come da desktop.
  await page.goto("/settings");
  await page.getByRole("button", { name: "Aspetto" }).click();
  await expect(
    page.getByRole("heading", { name: "Barra di navigazione in basso (smartphone)" }),
  ).toBeVisible();

  await Promise.all([
    page.waitForResponse((res) => res.url().includes("/profiles") && res.request().method() === "PATCH"),
    page.getByRole("button", { name: "Togli Archivio dalla barra" }).click(),
  ]);
  // .click(), non .check(): appena spuntata, "Beni" lascia del tutto
  // l'elenco "Altre voci" (con la sua checkbox) per entrare in "Nella
  // barra" (dove diventa una riga con tasto ✕, non più una checkbox)
  // --- .check() invece atterrebbe la conferma sulla stessa checkbox,
  // ormai sparita.
  await Promise.all([
    page.waitForResponse((res) => res.url().includes("/profiles") && res.request().method() === "PATCH"),
    page.getByRole("checkbox", { name: "Beni" }).click(),
  ]);

  // Si applica subito alla barra, senza refresh...
  await expect(bottomBar.getByRole("link", { name: "Archivio" })).toHaveCount(0);
  await expect(bottomBar.getByRole("link", { name: "Beni" })).toBeVisible();

  // ...e resta impostata dopo un refresh vero (sincronizzata sul server,
  // letta prima ancora del primo render della shell, come nav_orientation).
  await page.goto("/dashboard");
  await page.reload();
  await expect(bottomBar.getByRole("link", { name: "Archivio" })).toHaveCount(0);
  await expect(bottomBar.getByRole("link", { name: "Beni" })).toBeVisible();

  // Il menu con le 3 lineette ora mostra di nuovo "Archivio" (non più
  // duplicato in basso) e non più "Beni" (ora in basso).
  await menuButton.click();
  await expect(drawer.getByRole("link", { name: "Archivio" })).toBeVisible();
  await expect(drawer.getByRole("link", { name: "Beni" })).toHaveCount(0);
});

test("oltre 5 voci scelte, le altre caselle si disabilitano", async ({ page }) => {
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

  // Le 4 di default sono già selezionate --- se ne aggiunge una quinta
  // (il massimo, v. MAX_BOTTOM_NAV_ITEMS) e una sesta resta disabilitata.
  await Promise.all([
    page.waitForResponse((res) => res.url().includes("/profiles") && res.request().method() === "PATCH"),
    page.getByRole("checkbox", { name: "Beni" }).click(),
  ]);
  const sixthCheckbox = page.getByRole("checkbox", { name: "Amici" });
  await expect(sixthCheckbox).toBeDisabled();
});

test("le frecce riordinano le voci nella barra, e l'ordine resta dopo un refresh", async ({ page }) => {
  const user = uniqueTestUser();
  await createConfirmedTestUser(user);

  await page.goto("/login");
  await page.getByLabel("Email").fill(user.email);
  await page.getByLabel("Password").fill(user.password);
  await page.getByRole("button", { name: "Accedi" }).click();
  await expect(page).toHaveURL(/\/dashboard$/, { timeout: 15_000 });

  await page.goto("/settings");
  await page.getByRole("button", { name: "Aspetto" }).click();

  // Ordine di partenza: Dashboard, Archivio, Scadenze, Capsule. Si
  // sposta "Archivio" in cima con la freccia ▲.
  await Promise.all([
    page.waitForResponse((res) => res.url().includes("/profiles") && res.request().method() === "PATCH"),
    page.getByRole("button", { name: "Sposta Archivio in alto nella barra" }).click(),
  ]);

  const bottomBar = page.getByRole("navigation", { name: "Navigazione rapida" });
  const links = bottomBar.getByRole("link");
  await expect(links.first()).toHaveText("Archivio");

  await page.reload();
  await page.getByRole("button", { name: "Aspetto" }).click();
  await expect(links.first()).toHaveText("Archivio");
});
