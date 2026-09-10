import { expect, test } from "./fixtures";
import { createConfirmedTestUser, uniqueTestUser } from "./test-users";

// Requires a configured Supabase project (.env.local) --- see README.md.

test.describe("smartphone", () => {
  test.use({ viewport: { width: 375, height: 800 } });

  test("sotto md Impostazioni è un elenco -> dettaglio con un tasto per tornare indietro, indipendente dalle schede della versione desktop", async ({
    page,
  }) => {
    const user = uniqueTestUser();
    await createConfirmedTestUser(user);

    await page.goto("/login");
    await page.getByLabel("Email").fill(user.email);
    await page.getByLabel("Password").fill(user.password);
    await page.getByRole("button", { name: "Accedi" }).click();
    await expect(page).toHaveURL(/\/dashboard$/, { timeout: 15_000 });

    await page.goto("/settings");

    // Niente schede qui sotto md --- solo l'elenco delle voci.
    await expect(page.getByRole("tab")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Informazioni utente" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Aspetto" })).toBeVisible();

    // Un click su una voce mostra solo il suo contenuto, con un tasto per tornare indietro.
    await page.getByRole("button", { name: "Aspetto" }).click();
    await expect(page.getByRole("button", { name: "Informazioni utente" })).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "Aspetto", exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Disposizione del menu" })).toBeVisible();
    const backButton = page.getByRole("button", { name: "Torna alle impostazioni" });
    await expect(backButton).toBeVisible();

    // Il tasto indietro torna all'elenco completo.
    await backButton.click();
    await expect(page.getByRole("button", { name: "Informazioni utente" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Disposizione del menu" })).toHaveCount(0);

    // Un'altra voce mostra il proprio contenuto (non quello di prima).
    await page.getByRole("button", { name: "Informazioni utente" }).click();
    await expect(page.getByLabel("Nome", { exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Disposizione del menu" })).toHaveCount(0);
  });
});

test("da desktop Impostazioni resta a schede, con contenuto sempre visibile a fianco", async ({ page }) => {
  const user = uniqueTestUser();
  await createConfirmedTestUser(user);

  await page.goto("/login");
  await page.getByLabel("Email").fill(user.email);
  await page.getByLabel("Password").fill(user.password);
  await page.getByRole("button", { name: "Accedi" }).click();
  await expect(page).toHaveURL(/\/dashboard$/, { timeout: 15_000 });

  await page.goto("/settings");

  // Comportamento invariato: le schede ci sono già tutte, il contenuto
  // della prima è già visibile senza bisogno di scegliere nulla.
  await expect(page.getByRole("tab", { name: "Informazioni utente" })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await expect(page.getByLabel("Nome", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Torna alle impostazioni" })).toHaveCount(0);

  await page.getByRole("tab", { name: "Aspetto" }).click();
  await expect(page.getByRole("heading", { name: "Disposizione del menu" })).toBeVisible();
  // La scheda "Informazioni utente" è ancora lì, a fianco (non sparita
  // come nel dettaglio mobile).
  await expect(page.getByRole("tab", { name: "Informazioni utente" })).toBeVisible();
});
