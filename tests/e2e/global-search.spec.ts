import { expect, test } from "./fixtures";
import { createConfirmedTestUser, uniqueTestUser } from "./test-users";
import { searchGlobally } from "./search-helpers";

// Requires a configured Supabase project (.env.local) --- see README.md.

test("la ricerca globale trova un bene per nome e ci porta alla sua pagina", async ({ page }) => {
  test.slow();

  const user = uniqueTestUser();
  await createConfirmedTestUser(user);

  await page.goto("/login");
  await page.getByLabel("Email").fill(user.email);
  await page.getByLabel("Password").fill(user.password);
  await page.getByRole("button", { name: "Accedi" }).click();
  await expect(page).toHaveURL(/\/dashboard$/, { timeout: 15_000 });

  await page.getByRole("link", { name: "Archivio", exact: true }).click();
  await page.getByLabel("Master password", { exact: true }).fill("una-master-password-solida");
  await page.getByLabel("Conferma master password").fill("una-master-password-solida");
  await page.getByRole("button", { name: "Crea" }).click();
  await expect(
    page.getByLabel("Ho salvato la recovery key in un posto sicuro."),
  ).toBeVisible({ timeout: 45_000 });
  await page.getByLabel("Ho salvato la recovery key in un posto sicuro.").check();
  await page.getByRole("button", { name: "Continua" }).click();
  await expect(page.getByRole("heading", { name: "Archivio" })).toBeVisible();

  await page.getByRole("link", { name: "Beni" }).click();
  await page.getByRole("link", { name: "+ Crea bene" }).click();
  await page.getByLabel("Nome").fill("Auto Panda");
  await page.getByRole("button", { name: "Aggiungi bene" }).click();
  await expect(page).toHaveURL(/\/assets$/, { timeout: 15_000 });

  // Prima dell'apertura, il dialog non esiste.
  await expect(page.getByRole("dialog", { name: "Ricerca globale" })).not.toBeVisible();

  await page.getByRole("button", { name: /Cerca/ }).click();
  const dialog = page.getByRole("dialog", { name: "Ricerca globale" });
  await expect(dialog).toBeVisible();

  const input = dialog.getByLabel("Cerca", { exact: true });
  await expect(input).toBeFocused();
  await input.fill("panda");

  // I chip mostrano i conteggi per area: il bene trovato è uno.
  await expect(dialog.getByRole("button", { name: /^Beni\s*1$/ })).toBeVisible();
  await dialog.getByRole("button", { name: /Auto Panda/ }).click();

  await expect(page).toHaveURL(/\/assets$/);
  await expect(dialog).not.toBeVisible();

  // La scorciatoia da tastiera apre/chiude da qualunque pagina.
  await page.keyboard.press("Control+k");
  await expect(dialog).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();

  // Nessuna corrispondenza: messaggio esplicito, non una lista vuota muta.
  await searchGlobally(page, "xyzxyz");
  await expect(dialog.getByText('Nessun risultato per "xyzxyz".')).toBeVisible();

  // Tutte le parole devono comparire: una parola che non c'è esclude il bene.
  await searchGlobally(page, "panda zzzzzz");
  await expect(dialog.getByText(/Nessun risultato per/)).toBeVisible();

  // Filtro per area: in un'area senza risultati il messaggio rimanda a "Tutto".
  await searchGlobally(page, "panda");
  await dialog.getByRole("button", { name: /^Amici/ }).click();
  await expect(dialog.getByText(/ma ce ne sono 1 altrove/)).toBeVisible();
});
