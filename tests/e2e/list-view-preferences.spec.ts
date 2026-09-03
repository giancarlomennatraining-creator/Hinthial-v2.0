import { expect, test, type Page } from "@playwright/test";
import { createConfirmedTestUser, uniqueTestUser } from "./test-users";

/**
 * Impostazioni non richiede la master key (nessun dato del vault lì),
 * ma è fuori dal layout condiviso ad ogni page.goto/reload verso di essa:
 * la sessione della master key (solo in memoria, mai persistita) va
 * quindi risbloccata prima di rientrare in una sezione che la richiede.
 */
async function unlockMasterKey(page: Page) {
  await expect(page.getByRole("heading", { name: "Sblocca" })).toBeVisible();
  await page.getByLabel("Master password", { exact: true }).fill("una-master-password-solida");
  await page.getByRole("button", { name: "Sblocca" }).click();
}

// Requires a configured Supabase project (.env.local) --- see README.md.
//
// Copre solo Contatti fiduciari (creazione economica, niente cifratura di
// file) --- ListViewToggle/Pagination sono gli stessi componenti condivisi
// da tutte e sei le sezioni (v. lib/list-view.ts), quindi un solo giro qui
// li esercita tutti.

test("la modalità di visualizzazione si imposta da Impostazioni > Aspetto, si applica alla sezione tramite l'interruttore sincronizzato lì, e resta impostata dopo un refresh", async ({
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

  await page.getByRole("link", { name: "Contatti" }).click();
  await page.getByLabel("Master password", { exact: true }).fill("una-master-password-solida");
  await page.getByLabel("Conferma master password").fill("una-master-password-solida");
  await page.getByRole("button", { name: "Crea" }).click();
  await expect(
    page.getByLabel("Ho salvato la recovery key in un posto sicuro."),
  ).toBeVisible({ timeout: 45_000 });
  await page.getByLabel("Ho salvato la recovery key in un posto sicuro.").check();
  await page.getByRole("button", { name: "Continua" }).click();
  await expect(page.getByRole("heading", { name: "Contatti fiduciari" })).toBeVisible();

  await page.getByRole("link", { name: "+ Aggiungi contatto" }).click();
  await page.getByLabel("Nome").fill("Maria Rossi");
  await page.getByLabel("Email").fill("maria@esempio.it");
  await page.getByLabel("Ruolo").fill("Coniuge");
  await page.getByRole("button", { name: "Aggiungi contatto" }).click();
  await expect(page).toHaveURL(/\/contacts$/, { timeout: 15_000 });
  await expect(page.getByText("Maria Rossi")).toBeVisible({ timeout: 10_000 });

  // Di default è a elenco: nessuna tabella in vista.
  await expect(page.locator("table")).not.toBeVisible();

  // Si imposta la vista a tabella da Impostazioni > Aspetto.
  await page.goto("/settings");
  await page.getByRole("tab", { name: "Aspetto" }).click();
  await expect(page.getByRole("heading", { name: "Visualizzazione delle liste" })).toBeVisible();
  const contactsRow = page.getByRole("listitem").filter({ hasText: "Contatti fiduciari" });
  await contactsRow.getByRole("radio", { name: "Vista a tabella" }).click();
  await expect(contactsRow.getByRole("radio", { name: "Vista a tabella" })).toHaveAttribute(
    "aria-checked",
    "true",
  );

  // Si applica subito alla sezione, senza bisogno di ricaricare la pagina.
  // (page.goto è una navigazione vera: la master key, solo in memoria,
  // va risbloccata --- v. unlockMasterKey.)
  await page.getByRole("link", { name: "Contatti" }).click();
  await unlockMasterKey(page);
  await expect(page.getByRole("heading", { name: "Contatti fiduciari" })).toBeVisible();
  await expect(page.locator("table")).toBeVisible();
  await expect(page.getByRole("columnheader", { name: "Nome" })).toBeVisible();
  await expect(page.getByRole("cell", { name: "Maria Rossi", exact: true })).toBeVisible();

  // L'interruttore rapido nella sezione riflette la stessa preferenza ---
  // e cambiandolo da qui si sincronizza anche verso Impostazioni.
  await expect(page.getByRole("radio", { name: "Vista a tabella" })).toHaveAttribute(
    "aria-checked",
    "true",
  );
  await page.getByRole("radio", { name: "Vista a elenco" }).click();
  await expect(page.locator("table")).not.toBeVisible();
  await expect(page.getByRole("listitem").filter({ hasText: "Maria Rossi" })).toBeVisible();

  // Resta impostata dopo un refresh vero --- sincronizzata sul server, non solo in localStorage.
  await page.reload();
  await unlockMasterKey(page);
  await expect(page.getByRole("heading", { name: "Contatti fiduciari" })).toBeVisible();
  await expect(page.getByRole("radio", { name: "Vista a elenco" })).toHaveAttribute(
    "aria-checked",
    "true",
    { timeout: 10_000 },
  );

  await page.goto("/settings");
  await page.getByRole("tab", { name: "Aspetto" }).click();
  await expect(
    page.getByRole("listitem").filter({ hasText: "Contatti fiduciari" }).getByRole("radio", {
      name: "Vista a elenco",
    }),
  ).toHaveAttribute("aria-checked", "true", { timeout: 10_000 });
});

test("in modalità tabellare le liste lunghe sono impaginate", async ({ page }) => {
  test.slow();

  const user = uniqueTestUser();
  await createConfirmedTestUser(user);

  await page.goto("/login");
  await page.getByLabel("Email").fill(user.email);
  await page.getByLabel("Password").fill(user.password);
  await page.getByRole("button", { name: "Accedi" }).click();
  await expect(page).toHaveURL(/\/dashboard$/, { timeout: 15_000 });

  await page.getByRole("link", { name: "Contatti" }).click();
  await page.getByLabel("Master password", { exact: true }).fill("una-master-password-solida");
  await page.getByLabel("Conferma master password").fill("una-master-password-solida");
  await page.getByRole("button", { name: "Crea" }).click();
  await expect(
    page.getByLabel("Ho salvato la recovery key in un posto sicuro."),
  ).toBeVisible({ timeout: 45_000 });
  await page.getByLabel("Ho salvato la recovery key in un posto sicuro.").check();
  await page.getByRole("button", { name: "Continua" }).click();
  await expect(page.getByRole("heading", { name: "Contatti fiduciari" })).toBeVisible();

  // 11 contatti --- una pagina più di TABLE_PAGE_SIZE (10), v. lib/list-view.ts.
  for (let i = 1; i <= 11; i++) {
    await page.getByRole("link", { name: "+ Aggiungi contatto" }).click();
    await expect(page.getByRole("heading", { name: "Nuovo contatto fiduciario" })).toBeVisible();
    await page.getByLabel("Nome").fill(`Contatto ${String(i).padStart(2, "0")}`);
    await page.getByLabel("Email").fill(`contatto${i}@esempio.it`);
    await page.getByLabel("Ruolo").fill("Amico");
    await page.getByRole("button", { name: "Aggiungi contatto" }).click();
    await expect(page).toHaveURL(/\/contacts$/, { timeout: 15_000 });
  }
  await expect(page.getByText("Contatto 11")).toBeVisible({ timeout: 10_000 });

  await page.getByRole("radio", { name: "Vista a tabella" }).click();
  await expect(page.locator("table")).toBeVisible();

  await expect(page.getByText("Pagina 1 di 2")).toBeVisible();
  const rows = page.locator("tbody tr");
  await expect(rows).toHaveCount(10);
  await expect(page.getByRole("button", { name: "← Precedente" })).toBeDisabled();

  await page.getByRole("button", { name: "Successiva →" }).click();
  await expect(page.getByText("Pagina 2 di 2")).toBeVisible();
  await expect(rows).toHaveCount(1);
  await expect(page.getByRole("button", { name: "Successiva →" })).toBeDisabled();

  await page.getByRole("button", { name: "← Precedente" }).click();
  await expect(page.getByText("Pagina 1 di 2")).toBeVisible();
  await expect(rows).toHaveCount(10);
});
