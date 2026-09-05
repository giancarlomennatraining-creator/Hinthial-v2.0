import { expect, test } from "@playwright/test";
import { createConfirmedTestUser, uniqueTestUser } from "./test-users";
import { openRowMenu } from "./row-actions";

// Requires a configured Supabase project (.env.local) --- see README.md.

test("la dashboard mostra i contatori per sezione, resta a due colonne anche a vault vuoto, e aggiorna i contatori e \"Da tenere d'occhio\" quando si aggiunge contenuto", async ({
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

  // Vault ancora vuoto: contatori tutti a zero, ma il layout a due
  // colonne resta comunque intero --- niente più collasso alla sola checklist.
  await page.getByRole("link", { name: "Dashboard" }).click();
  await expect(page.getByRole("link", { name: "Archivio: 0" })).toBeVisible({ timeout: 10_000 });
  await expect(page.getByRole("link", { name: "Asset: 0" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Contatti: 0" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Capsule: 0" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Categorie: 10" })).toBeVisible();
  // "Onboarding" compare due volte in pagina (la card e l'indicatore
  // nella barra laterale): si verifica la card dal rapporto "2/8".
  await expect(page.getByText("2/8")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Prossime scadenze" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Aggiunti di recente" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Elementi da completare" })).toBeVisible();

  // Un asset non collegato a nulla e un contenuto in archivio.
  await page.getByRole("link", { name: "Asset", exact: true }).click();
  await page.getByRole("link", { name: "+ Crea asset" }).click();
  await expect(page.getByRole("heading", { name: "Nuovo asset" })).toBeVisible();
  await page.getByLabel("Nome").fill("Barca");
  await page.getByRole("button", { name: "Aggiungi asset" }).click();
  await expect(page).toHaveURL(/\/assets$/, { timeout: 15_000 });
  await expect(page.getByText("Barca")).toBeVisible({ timeout: 10_000 });

  await page.getByRole("link", { name: "Archivio", exact: true }).click();
  await page.getByRole("link", { name: "+ Aggiungi contenuto" }).click();
  await expect(page.getByRole("heading", { name: "Nuovo contenuto" })).toBeVisible();
  await page.setInputFiles('input[type="file"]', {
    name: "polizza.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("polizza di prova"),
  });
  await page.getByRole("button", { name: "Aggiungi all'archivio" }).click();
  await expect(page).toHaveURL(/\/archive$/, { timeout: 15_000 });
  await expect(page.getByText("polizza.txt")).toBeVisible({ timeout: 15_000 });

  // I contatori si aggiornano, e "Da tenere d'occhio" segnala l'asset scollegato --- un'unica sezione.
  await page.getByRole("link", { name: "Dashboard" }).click();
  await expect(page.getByRole("link", { name: "Archivio: 1" })).toBeVisible({ timeout: 10_000 });
  await expect(page.getByRole("link", { name: "Asset: 1" })).toBeVisible();

  // mockAIProvider.suggest() segnala già da solo un asset senza documenti
  // collegati: "Da tenere d'occhio" non lo ripete anche come riga di
  // salute del vault a parte (stesso asset due volte nella stessa card).
  await expect(page.getByText("Da tenere d'occhio")).toBeVisible();
  await expect(page.getByText("Questo asset non ha ancora documenti collegati: Barca.")).toBeVisible();
  await expect(page.getByRole("link", { name: "Barca" })).toHaveCount(1);
  await expect(page.getByText(/asset non hanno ancora contenuti collegati/)).not.toBeVisible();

  // Un contatto attivo e amico: il sotto-contatore in "Contatti" lo riflette.
  await page.getByRole("link", { name: "Contatti", exact: true }).click();
  await page.getByRole("link", { name: "+ Aggiungi contatto" }).click();
  await page.getByLabel("Nome").fill("Maria Rossi");
  await page.getByLabel("Email").fill("maria.rossi@esempio.it");
  await page.getByLabel("Ruolo").fill("Coniuge");
  await page.getByRole("button", { name: "Aggiungi contatto" }).click();
  await expect(page).toHaveURL(/\/contacts$/, { timeout: 15_000 });
  const contactRow = page.locator("li", { hasText: "Maria Rossi" });
  await expect(contactRow).toBeVisible({ timeout: 10_000 });
  await openRowMenu(contactRow);
  await page.getByRole("menuitem", { name: "Segna come attivo" }).click();
  await expect(contactRow.getByText("Attivo")).toBeVisible({ timeout: 10_000 });
  await openRowMenu(contactRow);
  await page.getByRole("menuitem", { name: "Segna come amico" }).click();

  await page.getByRole("link", { name: "Dashboard" }).click();
  await expect(page.getByRole("link", { name: "Contatti: 1 (1 attivi e 1 amici)" })).toBeVisible({
    timeout: 10_000,
  });
});
