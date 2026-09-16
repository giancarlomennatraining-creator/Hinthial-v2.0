import { expect, test } from "./fixtures";
import { createConfirmedTestUser, fullName, uniqueTestUser } from "./test-users";

// Requires a configured Supabase project (.env.local) --- see README.md.

test("Impostazioni > Eredità digitale mostra i preset, il riepilogo si aggiorna, e i valori personalizzati si salvano e sopravvivono a un refresh", async ({
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

  // Consultabile subito, prima ancora di configurare la cifratura ---
  // nessun dato cifrato coinvolto, come Sicurezza/Privacy.
  await page.getByRole("button", { name: fullName(user) }).click();
  await page.getByRole("link", { name: "Impostazioni" }).click();
  await page.getByRole("tab", { name: "Eredità digitale" }).click();

  await expect(page.getByRole("heading", { name: "Eredità digitale" })).toBeVisible();

  // Default: "Normale" già selezionato, nessuna etichetta "Personalizzato".
  const normale = page.getByRole("radio", { name: "Normale" });
  await expect(normale).toHaveAttribute("aria-checked", "true");
  await expect(page.getByText("Personalizzato --- almeno un valore")).not.toBeVisible();
  await expect(page.getByText(/In totale, nel caso peggiore, circa 7 mesi/)).toBeVisible();

  // Scegliere "Prudente" aggiorna subito il riepilogo, senza bisogno di salvare.
  await page.getByRole("radio", { name: "Prudente" }).click();
  await expect(page.getByText(/In totale, nel caso peggiore, circa un anno/)).toBeVisible();

  // Toccare un valore personalizzato fa passare la scelta a "Personalizzato".
  await page.getByRole("button", { name: "Personalizza i valori" }).click();
  const inactivityField = page.getByLabel("Soglia di inattività (giorni)");
  await expect(inactivityField).toHaveValue("180");
  await inactivityField.fill("200");
  await expect(page.getByRole("radio", { name: "Prudente" })).toHaveAttribute("aria-checked", "false");
  await expect(page.getByText("Personalizzato --- almeno un valore")).toBeVisible();

  // Salvare e ricaricare: i valori personalizzati sopravvivono.
  await Promise.all([
    page.waitForResponse((res) => res.url().includes("/profiles") && res.request().method() === "PATCH"),
    page.getByRole("button", { name: "Salva" }).click(),
  ]);
  await expect(page.getByText("Impostazioni di Eredità digitale salvate.")).toBeVisible();

  await page.reload();
  await page.getByRole("tab", { name: "Eredità digitale" }).click();
  await expect(page.getByText("Personalizzato --- almeno un valore")).toBeVisible();
  // Il preset è "custom": i campi sono già aperti, niente da cliccare per vederli.
  await expect(page.getByRole("button", { name: "Nascondi i valori" })).toBeVisible();
  await expect(page.getByLabel("Soglia di inattività (giorni)")).toHaveValue("200");

  // Un valore fuori dai limiti viene riportato dentro al salvataggio.
  await page.getByLabel("Soglia di inattività (giorni)").fill("5");
  await Promise.all([
    page.waitForResponse((res) => res.url().includes("/profiles") && res.request().method() === "PATCH"),
    page.getByRole("button", { name: "Salva" }).click(),
  ]);
  await expect(page.getByLabel("Soglia di inattività (giorni)")).toHaveValue("30");
});
