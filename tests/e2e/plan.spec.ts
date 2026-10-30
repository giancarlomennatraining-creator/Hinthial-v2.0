import { expect, test } from "./fixtures";
import { createConfirmedTestUser, forceOwnFriendToGuardian, uniqueTestUser } from "./test-users";
import { acceptConfirm } from "./confirm-dialog";

// Requires a configured Supabase project (.env.local) --- see README.md.

test("\"Il tuo piano\" porta dal primo avvio a Eredità digitale: un passo alla volta, nove in quattro pilastri", async ({ page }) => {
  test.slow();

  const user = uniqueTestUser();
  await createConfirmedTestUser(user);

  await page.goto("/login");
  await page.getByLabel("Email").fill(user.email);
  await page.getByLabel("Password").fill(user.password);
  await page.getByRole("button", { name: "Accedi" }).click();
  await expect(page).toHaveURL(/\/dashboard$/, { timeout: 15_000 });

  // Prima della master password l'indicatore nel menu invita a crearla: la chiave è il primo passo.
  const sidebarLink = page.getByRole("link", { name: "Il tuo piano: crea la tua chiave" });
  await expect(sidebarLink).toBeVisible({ timeout: 10_000 });
  await expect(sidebarLink).toHaveAttribute("href", "/archive");

  await page.getByRole("link", { name: "Archivio", exact: true }).click();
  await page.getByLabel("Master password", { exact: true }).fill("una-master-password-solida");
  await page.getByLabel("Conferma master password").fill("una-master-password-solida");
  await page.getByRole("button", { name: "Crea" }).click();
  await expect(page.getByLabel("Ho salvato la recovery key in un posto sicuro.")).toBeVisible({ timeout: 45_000 });
  await page.getByLabel("Ho salvato la recovery key in un posto sicuro.").check();
  await page.getByRole("button", { name: "Continua" }).click();
  await expect(page.getByRole("heading", { name: "Archivio" })).toBeVisible();

  const plan = page.getByRole("region", { name: "Il tuo piano" });
  async function openToday() {
    await page.getByRole("link", { name: "Oggi" }).click();
    await expect(plan).toBeVisible({ timeout: 15_000 });
  }

  // Si parte dalla chiave, l'unica cosa già fatta: 1 su 9. In evidenza c'è solo il prossimo passo, con il perché e il pulsante.
  await openToday();
  await expect(plan.getByText("1 su 9")).toBeVisible({ timeout: 15_000 });
  await expect(plan.getByText("Il prossimo passo")).toBeVisible();
  await expect(plan.getByText("Metti dentro il primo documento")).toBeVisible();
  const nextLink = plan.getByRole("link", { name: "Aggiungi →" });
  await expect(nextLink).toHaveAttribute("href", "/archive/new?mode=upload");
  // L'indicatore nel menu riprende l'avanzamento da qui e riporta a Oggi.
  await expect(page.getByRole("link", { name: "Il tuo piano: 1 su 9" })).toHaveAttribute("href", "/dashboard", { timeout: 10_000 });

  // Gli altri passi stanno ripiegati; "Vedi tutti i passi" li apre, per pilastro, e il prossimo non è ripetuto.
  await expect(plan.getByRole("group", { name: "Persone" })).toHaveCount(0);
  await plan.getByRole("button", { name: "Vedi tutti i passi" }).click();
  await expect(plan.getByRole("group")).toHaveCount(4);
  await expect(plan.getByRole("group", { name: "Sicurezza" }).getByText("1/2")).toBeVisible();
  await expect(plan.getByRole("group", { name: "Eredità" }).getByText("0/3")).toBeVisible();
  await expect(plan.getByRole("group", { name: "Sicurezza" }).getByRole("link")).toHaveCount(0);
  await expect(plan.getByRole("link", { name: "Racconta →" })).toHaveAttribute("href", "/raccontami");
  await plan.getByRole("button", { name: "Nascondi i passi" }).click();
  await expect(plan.getByRole("group")).toHaveCount(0);

  // Il pulsante del prossimo passo porta dove si fa: una nota è un documento. 2 su 9, e il prossimo passo cambia.
  await nextLink.click();
  await expect(page).toHaveURL(/\/archive\/new\?mode=upload$/, { timeout: 15_000 });
  await page.getByRole("button", { name: /Cosa vuoi aggiungere\?/ }).click();
  await page.getByRole("radio", { name: "Scrivi una nota" }).click();
  await page.getByLabel("Titolo").fill("Combinazione cassaforte");
  await page.getByLabel("Testo").fill("12-34-56");
  await page.getByRole("button", { name: "Aggiungi all'archivio" }).click();
  await expect(page.getByText("Documento salvato")).toBeVisible({ timeout: 30_000 });
  await openToday();
  await expect(plan.getByText("2 su 9")).toBeVisible({ timeout: 15_000 });
  await expect(plan.getByText("Aggiungi una persona a cui tieni").first()).toBeVisible();
  await expect(page.getByRole("link", { name: "Il tuo piano: 2 su 9" })).toBeVisible({ timeout: 10_000 });

  // Raccontami: una risposta diventa il primo racconto. Non è "il primo documento": ha il suo passo. 3 su 9.
  await page.getByRole("link", { name: "Raccontami", exact: true }).click();
  const domanda = page.getByRole("region", { name: "Domanda" });
  await expect(domanda.getByLabel("La tua risposta")).toBeVisible({ timeout: 15_000 });
  await domanda.getByLabel("La tua risposta").fill("A Sassoferrato, in una casa con il pozzo in cortile.");
  await domanda.getByRole("button", { name: "Salva il racconto" }).click();
  await expect(domanda.getByText("Racconto salvato")).toBeVisible({ timeout: 20_000 });
  await openToday();
  await expect(plan.getByText("3 su 9")).toBeVisible({ timeout: 15_000 });

  // Una persona in Amici (4 su 9). Come guardiano (forzato via admin, v. friends.spec.ts per il flusso vero): 5 su 9.
  await page.getByRole("link", { name: "Amici", exact: true }).click();
  await page.getByRole("link", { name: "+ Aggiungi amico" }).click();
  await page.getByLabel("Nome visualizzato").fill("Maria Rossi");
  await page.getByLabel("Email").fill("maria.rossi@esempio.it");
  await page.getByLabel("Ruolo").fill("Coniuge");
  await page.getByRole("button", { name: "Aggiungi amico" }).click();
  await expect(page).toHaveURL(/\/friends$/, { timeout: 15_000 });
  const friendRow = page.getByRole("region", { name: "Rubrica" }).getByRole("button", { name: /Maria Rossi/ });
  await expect(friendRow).toBeVisible({ timeout: 10_000 });
  await openToday();
  await expect(plan.getByText("4 su 9")).toBeVisible({ timeout: 15_000 });

  // Si ricarica dalla rubrica (lì lo sblocco è nella pagina), poi si torna a Oggi.
  await page.getByRole("link", { name: "Amici", exact: true }).click();
  await expect(friendRow).toBeVisible({ timeout: 10_000 });
  await forceOwnFriendToGuardian(user.email);
  await page.reload();
  await page.getByLabel("Master password", { exact: true }).fill("una-master-password-solida");
  await page.getByRole("button", { name: "Sblocca", exact: true }).click();
  await expect(friendRow.getByTitle("Guardiano")).toBeVisible({ timeout: 10_000 });
  await openToday();
  await expect(plan.getByText("5 su 9")).toBeVisible({ timeout: 30_000 });

  // Una capsula per Maria: 6 su 9.
  await page.getByRole("link", { name: "Capsule", exact: true }).click();
  await page.getByRole("link", { name: "+ Crea capsula" }).click();
  await expect(page.getByRole("heading", { name: "Nuova capsula" })).toBeVisible();
  await page.getByLabel("Titolo").fill("Per Maria");
  await page.getByLabel("Data e ora di apertura", { exact: true }).fill("2027-01-01T10:00");
  await page.locator("#create-friend").selectOption({ label: "Maria Rossi" });
  await page.getByRole("button", { name: "+ Aggiungi" }).click();
  await expect(page.getByText("Maria Rossi")).toBeVisible();
  await page.getByRole("button", { name: "Avanti" }).click();
  await expect(page.getByText("Passo 2 di 3")).toBeVisible();
  await page.getByRole("button", { name: "Avanti" }).click();
  await expect(page.getByText("Passo 3 di 3")).toBeVisible();
  await page.getByLabel("Il tuo messaggio").fill("Un pensiero per te.");
  await page.getByRole("button", { name: "Crea capsula" }).click();
  await expect(page).toHaveURL(/\/capsules$/, { timeout: 15_000 });
  await expect(page.getByText("Capsula creata.")).toBeVisible();
  await openToday();
  await expect(plan.getByText("6 su 9")).toBeVisible({ timeout: 15_000 });

  // L'Eredità digitale attivata e salvata: 7 su 9. Mancano la scheda d'emergenza e la scelta delle capsule da consegnare:
  // il prossimo passo è la prima, nell'ordine del piano.
  await page.getByRole("link", { name: "Eredità digitale", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Eredità digitale", level: 1 })).toBeVisible();
  const enableToggle = page.getByRole("checkbox", { name: "Attiva Eredità digitale" });
  await enableToggle.click();
  await acceptConfirm(page);
  await expect(enableToggle).toBeChecked();
  await Promise.all([
    page.waitForResponse((res) => res.url().includes("/profiles") && res.request().method() === "PATCH"),
    page.getByRole("button", { name: "Salva", exact: true }).click(),
  ]);
  await expect(page.getByText("Impostazioni di Eredità digitale salvate.")).toBeVisible();
  await openToday();
  await expect(plan.getByText("7 su 9")).toBeVisible({ timeout: 15_000 });
  await expect(plan.getByText("Compila la scheda d'emergenza").first()).toBeVisible();
  await expect(plan.getByRole("link", { name: "Compila →" })).toHaveAttribute("href", "/settings?tab=profile&section=card");
  await expect(page.getByRole("link", { name: "Il tuo piano: 7 su 9" })).toBeVisible({ timeout: 10_000 });
});
