import { expect, test } from "./fixtures";
import { createConfirmedTestUser, uniqueTestUser } from "./test-users";

// Requires a configured Supabase project (.env.local) --- see README.md.

test("l'assistente AI risponde su beni/documenti collegati per categoria e segnala le scadenze scadute", async ({
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

  // Un bene in categoria Assicurazioni.
  await page.getByRole("link", { name: "Beni" }).click();
  await page.getByRole("link", { name: "+ Crea bene" }).click();
  await expect(page.getByRole("heading", { name: "Nuovo bene" })).toBeVisible();
  await page.getByLabel("Nome").fill("Auto Panda");
  await page.locator("#categoryId").selectOption({ label: "🛡️ Assicurazioni" });
  await page.getByRole("button", { name: "Aggiungi bene" }).click();
  await expect(page).toHaveURL(/\/assets$/, { timeout: 15_000 });

  // Un documento nella stessa categoria, collegato al bene.
  await page.getByRole("link", { name: "Archivio", exact: true }).click();
  await page.getByRole("link", { name: "+ Aggiungi contenuto" }).click();
  await expect(page.getByRole("heading", { name: "Nuovo contenuto" })).toBeVisible();
  await page.locator("#upload-category").selectOption({ label: "🛡️ Assicurazioni" });
  await page.locator("#upload-asset").selectOption({ label: "Auto Panda" });
  await page.setInputFiles('input[type="file"]', {
    name: "polizza-auto.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("polizza di prova"),
  });
  await page.getByRole("button", { name: "Aggiungi all'archivio" }).click();
  await expect(page).toHaveURL(/\/archive$/, { timeout: 15_000 });
  await expect(page.getByText("polizza-auto.txt")).toBeVisible({ timeout: 15_000 });

  // Una scadenza già scaduta, collegata allo stesso bene.
  await page.getByRole("link", { name: "Scadenze" }).click();
  await page.getByRole("link", { name: "+ Crea scadenza" }).click();
  await expect(page.getByRole("heading", { name: "Nuova scadenza" })).toBeVisible();
  const past = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  await page.getByLabel("Titolo").fill("Rinnovo assicurazione auto");
  await page.getByLabel("Data").fill(past);
  await page.getByLabel("Bene collegato").selectOption({ label: "Auto Panda" });
  await page.getByRole("button", { name: "Aggiungi scadenza" }).click();
  await expect(page).toHaveURL(/\/reminders$/, { timeout: 15_000 });

  // Il suggerimento proattivo vive in Dashboard, non più anche in AI
  // (v. richiesta utente: niente "Cose da tenere d'occhio" sulla pagina AI).
  await page.getByRole("link", { name: "Dashboard" }).click();
  await expect(page.getByText(/scaduta/).first()).toBeVisible();
  await expect(page.getByText("Rinnovo assicurazione auto").first()).toBeVisible();

  // L'assistente AI.
  await page.getByRole("link", { name: "AI", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Parla con Hinthia" })).toBeVisible();

  // Domanda diretta: "assicurazioni" è il nome della categoria, non
  // compare nel nome del bene né in quello del documento --- la
  // risposta deve comunque trovarli seguendo la relazione categoria.
  await page.getByLabel("Fai una domanda").fill("Quali assicurazioni ho?");
  await page.getByRole("button", { name: "Invia" }).click();

  await expect(page.getByText("polizza-auto.txt").first()).toBeVisible();
  await expect(page.getByText("Rinnovo assicurazione auto").first()).toBeVisible();

  // Domanda generica senza corrispondenze specifiche: ripiega
  // sull'elenco completo del tipo nominato ("quanti beni ho?").
  await page.getByLabel("Fai una domanda").fill("Quanti beni ho?");
  await page.getByRole("button", { name: "Invia" }).click();
  await expect(page.getByText("Auto Panda").last()).toBeVisible();

  // Le fonti citate sono link cliccabili verso la pagina giusta.
  await page.getByRole("link", { name: "Auto Panda" }).last().click();
  await expect(page).toHaveURL(/\/assets$/);

  // La conversazione sopravvive alla navigazione interna (non vive più
  // nel ciclo di vita di AIPanel, che si smonta e rimonta ad ogni
  // cambio pagina --- v. AIChatProvider, montato in AppShell): si perde
  // solo a un refresh vero, non lasciando e tornando sulla pagina.
  await page.getByRole("link", { name: "AI", exact: true }).click();
  await expect(page.getByText("Quali assicurazioni ho?").first()).toBeVisible();
  await expect(page.getByText("Quanti beni ho?").first()).toBeVisible();

  // "Nuova conversazione" la svuota di proposito.
  await page.getByRole("button", { name: "Nuova conversazione" }).click();
  await expect(
    page.getByText('Prova a chiedere, ad esempio, "quali assicurazioni ho?"'),
  ).toBeVisible();
  await expect(page.getByText("Quali assicurazioni ho?", { exact: true })).not.toBeVisible();
});
