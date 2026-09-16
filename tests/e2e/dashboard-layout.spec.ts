import { expect, test } from "./fixtures";
import { createConfirmedTestUser, uniqueTestUser } from "./test-users";
import { openRowMenu } from "./row-actions";

// Requires a configured Supabase project (.env.local) --- see README.md.

test("la dashboard mostra i contatori per sezione e i tre riquadri anche a vault vuoto, e aggiorna i contatori e \"Da tenere d'occhio\" quando si aggiunge contenuto", async ({
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

  // Vault ancora vuoto: contatori tutti a zero, ma i tre riquadri
  // (scadenze/recenti/da completare) restano comunque interi.
  await page.getByRole("link", { name: "Dashboard" }).click();
  await expect(page.getByRole("link", { name: "Archivio: 0" })).toBeVisible({ timeout: 10_000 });
  await expect(page.getByRole("link", { name: "Beni: 0" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Amici: 0" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Capsule: 0" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Categorie: 10" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Prossime scadenze" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Aggiunti di recente" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Elementi da completare" })).toBeVisible();

  // Un bene non collegato a nulla e un contenuto in archivio.
  await page.getByRole("link", { name: "Beni", exact: true }).click();
  await page.getByRole("link", { name: "+ Crea bene" }).click();
  await expect(page.getByRole("heading", { name: "Nuovo bene" })).toBeVisible();
  await page.getByLabel("Nome").fill("Barca");
  await page.getByRole("button", { name: "Aggiungi bene" }).click();
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

  // I contatori si aggiornano, e "Da tenere d'occhio" segnala il bene scollegato --- un'unica sezione.
  await page.getByRole("link", { name: "Dashboard" }).click();
  await expect(page.getByRole("link", { name: "Archivio: 1" })).toBeVisible({ timeout: 10_000 });
  await expect(page.getByRole("link", { name: "Beni: 1" })).toBeVisible();

  // mockAIProvider.suggest() segnala già da solo un bene senza documenti
  // collegati: "Da tenere d'occhio" non lo ripete anche come riga di
  // salute del vault a parte (stesso bene due volte nella stessa card).
  await expect(page.getByText("Da tenere d'occhio")).toBeVisible();
  await expect(page.getByText("Questo bene non ha ancora documenti collegati: Barca.")).toBeVisible();
  await expect(page.getByRole("link", { name: "Barca" })).toHaveCount(1);
  await expect(page.getByText(/beni non hanno ancora contenuti collegati/)).not.toBeVisible();

  // Un amico attivo e guardiano: il sotto-contatore in "Amici" lo riflette.
  await page.getByRole("link", { name: "Amici", exact: true }).click();
  await page.getByRole("link", { name: "+ Aggiungi amico" }).click();
  await page.getByLabel("Nome visualizzato").fill("Maria Rossi");
  await page.getByLabel("Email").fill("maria.rossi@esempio.it");
  await page.getByLabel("Ruolo").fill("Coniuge");
  await page.getByRole("button", { name: "Aggiungi amico" }).click();
  await expect(page).toHaveURL(/\/friends$/, { timeout: 15_000 });
  const friendRow = page.locator("li", { hasText: "Maria Rossi" });
  await expect(friendRow).toBeVisible({ timeout: 10_000 });
  await openRowMenu(friendRow);
  await page.getByRole("menuitem", { name: "Segna come attivo" }).click();
  await expect(friendRow.getByText("Attivo")).toBeVisible({ timeout: 10_000 });
  await openRowMenu(friendRow);
  await page.getByRole("menuitem", { name: "Segna come guardiano" }).click();

  await page.getByRole("link", { name: "Dashboard" }).click();
  await expect(page.getByRole("link", { name: "Amici: 1 (1 attivi e 1 guardiani)" })).toBeVisible({
    timeout: 10_000,
  });
});
