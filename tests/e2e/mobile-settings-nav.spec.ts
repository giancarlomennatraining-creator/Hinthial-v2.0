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

    // Niente schede qui sotto md --- solo l'elenco delle pagine (sei, senza sottomenu).
    await expect(page.getByRole("tab")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Profilo" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Aspetto e preferenze" })).toBeVisible();

    // Un click su una pagina mostra solo il suo contenuto, con un tasto per tornare indietro.
    await page.getByRole("button", { name: "Aspetto e preferenze" }).click();
    await expect(page.getByRole("button", { name: "Profilo" })).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "Aspetto e preferenze", exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Come si aprono" })).toBeVisible();
    const backButton = page.getByRole("button", { name: "Torna alle impostazioni" });
    await expect(backButton).toBeVisible();

    // Il tasto indietro torna all'elenco completo.
    await backButton.click();
    await expect(page.getByRole("button", { name: "Profilo" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Come si aprono" })).toHaveCount(0);

    // Un'altra pagina mostra il proprio contenuto (non quello di prima).
    await page.getByRole("button", { name: "Profilo" }).click();
    await expect(page.getByLabel("Nome", { exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Come si aprono" })).toHaveCount(0);

    // La ricerca porta dritto al blocco, anche in un'altra pagina.
    await page.getByRole("button", { name: "Torna alle impostazioni" }).click();
    await page.getByRole("searchbox", { name: "Cerca nelle impostazioni" }).fill("cestino");
    await page.getByRole("button", { name: /Cestino/ }).click();
    await expect(page.getByRole("heading", { name: "I miei dati", exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Cestino" })).toBeVisible();
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
  await expect(page.getByRole("tab", { name: "Profilo" })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByLabel("Nome", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Torna alle impostazioni" })).toHaveCount(0);

  await page.getByRole("tab", { name: "Aspetto e preferenze" }).click();
  await expect(page.getByRole("heading", { name: "Tema" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Come si aprono" })).toBeVisible();
  // La scheda "Informazioni utente" è ancora lì, a fianco (non sparita
  // come nel dettaglio mobile).
  await expect(page.getByRole("tab", { name: "Profilo" })).toBeVisible();
});
