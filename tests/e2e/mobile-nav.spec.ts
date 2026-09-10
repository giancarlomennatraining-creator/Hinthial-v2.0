import { expect, test } from "./fixtures";
import { createConfirmedTestUser, uniqueTestUser } from "./test-users";

// Requires a configured Supabase project (.env.local) --- see README.md.

test.use({ viewport: { width: 375, height: 800 } });

test("sotto md la barra laterale è sostituita da un tasto menu che apre la navigazione in sovraimpressione", async ({
  page,
}) => {
  const user = uniqueTestUser();
  await createConfirmedTestUser(user);

  await page.goto("/login");
  await page.getByLabel("Email").fill(user.email);
  await page.getByLabel("Password").fill(user.password);
  await page.getByRole("button", { name: "Accedi" }).click();
  await expect(page).toHaveURL(/\/dashboard$/, { timeout: 15_000 });

  // La barra laterale vera e propria è nascosta, sostituita dal tasto menu.
  await expect(page.locator("aside")).toBeHidden();
  const menuButton = page.getByRole("button", { name: "Apri il menu" });
  await expect(menuButton).toBeVisible();

  // Il click apre il menu in sovraimpressione, con la navigazione dentro.
  await menuButton.click();
  const menu = page.getByRole("dialog", { name: "Menu di navigazione" });
  await expect(menu).toBeVisible();
  // "Beni" (non tra le voci di default della barra fissa in basso, v.
  // bottom-nav.spec.ts) --- resta quindi nel menu, a differenza di
  // "Archivio", ora mostrato in basso di default.
  await expect(menu.getByRole("link", { name: "Beni" })).toBeVisible();

  // Esc lo richiude.
  await page.keyboard.press("Escape");
  await expect(menu).not.toBeVisible();

  // Un click su una voce naviga e richiude il menu.
  await menuButton.click();
  await menu.getByRole("link", { name: "Beni" }).click();
  await expect(page).toHaveURL(/\/assets$/);
  await expect(menu).not.toBeVisible();
});
