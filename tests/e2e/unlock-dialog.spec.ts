import { expect, test as base, type Page } from "@playwright/test";
import { createConfirmedTestUser, fullName, uniqueTestUser, type TestUser } from "./test-users";
import { openSettings } from "./settings-nav";

// Requires a configured Supabase project (.env.local) --- see README.md.

/**
 * Come `test` di fixtures.ts, ma chiude solo il popup "Crea la tua master key": quello di fixtures.ts clicca ogni
 * pulsante "Più tardi", compreso quello della finestra di sblocco che qui si vuole vedere (e provare) davvero.
 */
const test = base.extend({
  page: async ({ page }, use) => {
    const intro = page.getByRole("dialog", { name: "Crea la tua master key" }).getByRole("button", { name: "Più tardi" });
    await page.addLocatorHandler(intro, async () => {
      await intro.click();
    });
    // eslint-disable-next-line react-hooks/rules-of-hooks -- Playwright's fixture callback param, not React's use() hook.
    await use(page);
  },
});

/** Sceglie una pelle e aspetta che il salvataggio sul profilo sia finito: ricaricare subito dopo lo interromperebbe a metà. */
async function chooseSkin(page: Page, name: RegExp) {
  const saved = page.waitForResponse((r) => r.url().includes("/rest/v1/profiles") && r.request().method() === "PATCH");
  await page.getByRole("radio", { name }).click();
  await saved;
  await expect(page.getByRole("radio", { name })).toHaveAttribute("aria-checked", "true");
}

const MASTER_PASSWORD = "una-master-password-solida";

async function loginAndCreateVault(page: Page): Promise<TestUser> {
  const user = uniqueTestUser();
  await createConfirmedTestUser(user);

  await page.goto("/login");
  await page.getByLabel("Email").fill(user.email);
  await page.getByLabel("Password").fill(user.password);
  await page.getByRole("button", { name: "Accedi" }).click();
  await expect(page).toHaveURL(/\/dashboard$/, { timeout: 15_000 });

  await page.getByRole("link", { name: "Archivio", exact: true }).click();
  await page.getByLabel("Master password", { exact: true }).fill(MASTER_PASSWORD);
  await page.getByLabel("Conferma master password").fill(MASTER_PASSWORD);
  await page.getByRole("button", { name: "Crea" }).click();
  await expect(page.getByLabel("Ho salvato la recovery key in un posto sicuro.")).toBeVisible({ timeout: 45_000 });
  await page.getByLabel("Ho salvato la recovery key in un posto sicuro.").check();
  await page.getByRole("button", { name: "Continua" }).click();
  await expect(page.getByRole("heading", { name: "Archivio" })).toBeVisible();
  return user;
}

test("lo sblocco è una finestra sopra la dashboard: compare subito, si chiude con 'Più tardi', si riapre da un pulsante, e uno sbaglio mostra l'errore", async ({
  page,
}) => {
  test.slow();
  await loginAndCreateVault(page);

  // Ricaricando la cassaforte torna bloccata: la finestra compare da sola sopra la dashboard.
  await page.goto("/dashboard");
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible({ timeout: 15_000 });
  await expect(dialog.getByRole("heading", { name: "Sblocca" })).toBeVisible();

  // "Più tardi" la chiude; ricaricando nella stessa sessione non si riapre da sola, ma c'è il pulsante.
  await dialog.getByRole("button", { name: "Più tardi" }).click();
  await expect(dialog).not.toBeVisible();
  await page.reload();
  await expect(page.getByRole("button", { name: "Sblocca ora" })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await page.getByRole("button", { name: "Sblocca ora" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();

  // Esc la chiude (qui si può), poi la si riapre e si sbaglia password.
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await page.getByRole("button", { name: "Sblocca ora" }).click();
  await page.getByLabel("Master password", { exact: true }).fill("sbagliata");
  await page.getByRole("button", { name: "Sblocca", exact: true }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Non corretta" })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole("dialog")).toBeVisible();

  // Quella giusta sblocca: la finestra sfuma, compare "Cassaforte sbloccata." e la dashboard si vede.
  await page.getByLabel("Master password", { exact: true }).fill(MASTER_PASSWORD);
  await page.getByRole("button", { name: "Sblocca", exact: true }).click();
  // Mentre la finestra si dissolve la dashboard non è ancora popolata: lo fa solo a fine animazione.
  await expect(page.locator('.unlock-glass[data-phase="success"]')).toBeVisible({ timeout: 20_000 });
  await expect(page.getByRole("heading", { name: "Prossime scadenze" })).not.toBeVisible();
  await expect(page.getByText("Cassaforte sbloccata.")).toBeVisible({ timeout: 20_000 });
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await expect(page.getByRole("heading", { name: "Prossime scadenze" })).toBeVisible({ timeout: 15_000 });
});

test("in Impostazioni > Aspetto > Sblocco si sceglie la pelle e la si prova; le pagine che servono la chiave la usano e non si possono chiudere", async ({
  page,
}) => {
  test.slow();
  const user = await loginAndCreateVault(page);

  await openSettings(page, user);
  await page.getByRole("tab", { name: "Aspetto" }).click();
  await page.getByRole("tab", { name: "Sblocco" }).click();
  await expect(page.getByRole("heading", { name: "Finestra di sblocco" })).toBeVisible();
  await expect(page.getByRole("radio", { name: /Vetro/ })).toHaveAttribute("aria-checked", "true");
  const vault = page.getByRole("radio", { name: /Cassaforte/ });
  await expect(vault).toContainText("porta di una cassaforte");

  // L'anteprima non sblocca nulla e si chiude da sola con qualunque testo.
  await page.getByRole("button", { name: "Prova lo stile Cassaforte" }).click();
  const preview = page.getByRole("dialog");
  await expect(preview).toBeVisible();
  await expect(preview.getByText(/Anteprima/)).toBeVisible();
  await preview.getByLabel("Master password", { exact: true }).fill("qualunque cosa");
  await preview.getByRole("button", { name: "Sblocca", exact: true }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible({ timeout: 15_000 });
  await expect(page.getByText("Cassaforte sbloccata.")).not.toBeVisible();

  // Si sceglie la Cassaforte.
  await chooseSkin(page, /Cassaforte/);

  // Un contenuto che serve la chiave (l'Archivio) la apre da solo, non si può chiudere, e sblocca nella pelle scelta.
  await page.goto("/archive");
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible({ timeout: 15_000 });
  await expect(dialog.locator(".unlock-vault-wrap")).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Più tardi" })).toHaveCount(0);
  await page.keyboard.press("Escape");
  await expect(dialog).toBeVisible();

  await dialog.getByLabel("Master password", { exact: true }).fill(MASTER_PASSWORD);
  await dialog.getByRole("button", { name: "Sblocca", exact: true }).click();
  // La Cassaforte si apre piano: per tutto il tempo che la porta si apre la pagina resta uno scheletro, poi si popola.
  await expect(dialog.locator('.unlock-vault-wrap[data-phase="success"]')).toBeVisible({ timeout: 20_000 });
  await expect(page.getByRole("heading", { name: "Archivio" })).not.toBeVisible();
  await expect(page.getByRole("dialog")).not.toBeVisible({ timeout: 20_000 });
  await expect(page.getByRole("heading", { name: "Archivio" })).toBeVisible({ timeout: 20_000 });
});

test("la pelle Impronta, senza impronta su questo dispositivo, mostra la password già a vista", async ({ page }) => {
  test.slow();
  const user = await loginAndCreateVault(page);

  await openSettings(page, user);
  await page.getByRole("tab", { name: "Aspetto" }).click();
  await page.getByRole("tab", { name: "Sblocco" }).click();
  await chooseSkin(page, /Impronta/);

  await page.goto("/archive");
  const dialog = page.getByRole("dialog");
  await expect(dialog.locator(".unlock-fp-wrap")).toBeVisible({ timeout: 15_000 });
  // Nessuna impronta registrata nel browser dei test: l'anello non è un pulsante e il campo è già lì.
  await expect(dialog.getByRole("button", { name: "Sblocca con impronta/Face ID" })).toHaveCount(0);
  await dialog.getByLabel("Master password", { exact: true }).fill(MASTER_PASSWORD);
  await dialog.getByRole("button", { name: "Sblocca", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Archivio" })).toBeVisible({ timeout: 20_000 });
});

test("la creazione della master password è una finestra nella pelle scelta; poi la cassaforte si può bloccare dal menu e si riapre lo sblocco", async ({
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

  // La pelle si sceglie già prima di creare la cassaforte (le Impostazioni non ne hanno bisogno).
  await openSettings(page, user);
  await page.getByRole("tab", { name: "Aspetto" }).click();
  await page.getByRole("tab", { name: "Sblocco" }).click();
  await chooseSkin(page, /Cassaforte/);

  // Una pagina che serve la chiave apre la creazione, nella cornice scelta, e non si può chiudere.
  await page.goto("/archive");
  const dialog = page.getByRole("dialog", { name: "Crea la master password" });
  await expect(dialog).toBeVisible({ timeout: 15_000 });
  await expect(dialog.locator(".unlock-vault-wrap")).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Più tardi" })).toHaveCount(0);
  await page.keyboard.press("Escape");
  await expect(dialog).toBeVisible();

  // Password diverse: un errore chiaro, la finestra resta.
  await dialog.getByLabel("Master password", { exact: true }).fill(MASTER_PASSWORD);
  await dialog.getByLabel("Conferma master password").fill("un-altra-password");
  await dialog.getByRole("button", { name: "Crea" }).click();
  await expect(dialog.getByRole("alert")).toContainText("non coincidono");

  await dialog.getByLabel("Conferma master password").fill(MASTER_PASSWORD);
  await dialog.getByRole("button", { name: "Crea" }).click();
  await expect(dialog.getByRole("heading", { name: "Salva la tua recovery key" })).toBeVisible({ timeout: 45_000 });
  await dialog.getByLabel("Ho salvato la recovery key in un posto sicuro.").check();
  await dialog.getByRole("button", { name: "Continua" }).click();

  // L'uscita è quella della cassaforte; la pagina si popola solo a fine animazione.
  await expect(dialog.locator('.unlock-vault-wrap[data-phase="success"]')).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText("Ancora nulla in archivio")).not.toBeVisible();
  await expect(page.getByRole("dialog")).not.toBeVisible({ timeout: 20_000 });
  await expect(page.getByText("Ancora nulla in archivio")).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText("Master password creata.")).toBeVisible();

  // Dal menu utente si blocca la cassaforte a mano: la pagina torna da sbloccare, nella stessa pelle.
  await page.getByRole("button", { name: fullName(user) }).click();
  await page.getByRole("button", { name: "Blocca la cassaforte" }).click();
  const unlock = page.getByRole("dialog", { name: "Sblocca la cassaforte" });
  await expect(unlock).toBeVisible({ timeout: 15_000 });
  await expect(unlock.locator(".unlock-vault-wrap")).toBeVisible();
  await expect(page.getByText("Ancora nulla in archivio")).not.toBeVisible();

  await unlock.getByLabel("Master password", { exact: true }).fill(MASTER_PASSWORD);
  await unlock.getByRole("button", { name: "Sblocca", exact: true }).click();
  await expect(page.getByText("Ancora nulla in archivio")).toBeVisible({ timeout: 25_000 });

  // Da sbloccata, nel menu c'è "Blocca la cassaforte"; bloccata (o dopo un ricaricamento) non c'è.
  await page.getByRole("button", { name: fullName(user) }).click();
  await expect(page.getByRole("button", { name: "Blocca la cassaforte" })).toBeVisible();
});
