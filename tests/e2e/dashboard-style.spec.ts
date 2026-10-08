import { expect, test } from "./fixtures";
import { createConfirmedTestUser, uniqueTestUser } from "./test-users";
import { openSettings } from "./settings-nav";

// Requires a configured Supabase project (.env.local) --- see README.md.

test("lo stile della Dashboard si sceglie in Impostazioni > Aspetto: Oggi mostra le scadenze vicine con i pulsanti, e resta scelto dopo un refresh", async ({
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

  await page.getByRole("link", { name: "Scadenze" }).click();
  await page.getByLabel("Master password", { exact: true }).fill("una-master-password-solida");
  await page.getByLabel("Conferma master password").fill("una-master-password-solida");
  await page.getByRole("button", { name: "Crea" }).click();
  await expect(page.getByLabel("Ho salvato la recovery key in un posto sicuro.")).toBeVisible({ timeout: 45_000 });
  await page.getByLabel("Ho salvato la recovery key in un posto sicuro.").check();
  await page.getByRole("button", { name: "Continua" }).click();
  await expect(page.getByRole("heading", { name: "Scadenze" })).toBeVisible();

  // Una scadenza tra due giorni: rientra nelle cose "da fare ora".
  await page.getByRole("link", { name: "+ Crea scadenza" }).click();
  const soon = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  await page.getByLabel("Titolo").fill("Bollo auto");
  await page.getByLabel("Data").fill(soon);
  await page.getByRole("button", { name: "Aggiungi scadenza" }).click();
  await expect(page).toHaveURL(/\/reminders$/, { timeout: 15_000 });

  // Di default la Dashboard è la Classica.
  await page.getByRole("link", { name: "Dashboard", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Prossime scadenze" })).toBeVisible({ timeout: 10_000 });
  await expect(page.getByRole("heading", { name: "Da fare ora" })).not.toBeVisible();

  // Si sceglie "Oggi" da Impostazioni > Aspetto > Dashboard, con la sua spiegazione.
  await openSettings(page, user);
  await page.getByRole("tab", { name: "Aspetto" }).click();
  await page.getByRole("tab", { name: "Dashboard" }).click();
  await expect(page.getByRole("heading", { name: "Stile della Dashboard" })).toBeVisible();
  await expect(page.getByRole("radio", { name: /Classica/ })).toHaveAttribute("aria-checked", "true");
  const today = page.getByRole("radio", { name: /Oggi/ });
  await expect(today).toContainText("Parte da cosa fare");
  await today.click();
  await expect(today).toHaveAttribute("aria-checked", "true");

  // Subito la Dashboard è nel nuovo stile, con la scadenza e i suoi pulsanti.
  await page.getByRole("link", { name: "Dashboard", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Da fare ora" })).toBeVisible({ timeout: 10_000 });
  await expect(page.getByRole("heading", { level: 2 })).toContainText("Oggi 1 cosa merita attenzione.");
  const card = page.getByRole("listitem").filter({ hasText: "Bollo auto" });
  await expect(card).toContainText("tra 2 giorni");

  // "Rimanda di 7 giorni" la porta oltre la settimana: non è più da fare ora.
  await card.getByRole("button", { name: "Rimanda di 7 giorni" }).click();
  await expect(page.getByText("Hai finito per oggi")).toBeVisible({ timeout: 10_000 });
  await expect(page.getByRole("heading", { level: 2 })).toContainText("Tutto in ordine.");

  // Lo stile resta quello scelto anche dopo un ricaricamento (la cassaforte torna da sbloccare: lo stile no).
  // La cassaforte è di nuovo bloccata. Si sblocca da una pagina che serve la chiave, dove la finestra non si può chiudere
  // (quella della dashboard la chiude da sola la fixture, come ogni "Più tardi": qui non serve).
  await page.goto("/archive");
  await page.getByLabel("Master password", { exact: true }).fill("una-master-password-solida");
  await page.getByRole("button", { name: "Sblocca", exact: true }).click();
  await page.getByRole("link", { name: "Dashboard", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Da fare ora" })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText("Hai finito per oggi")).toBeVisible();

  // Anche Bento si sceglie da lì: la prossima scadenza è quella rimandata, e la domanda scritta arriva a Hinthia già nel campo.
  await openSettings(page, user);
  await page.getByRole("tab", { name: "Aspetto" }).click();
  await page.getByRole("tab", { name: "Dashboard" }).click();
  const bento = page.getByRole("radio", { name: /Bento/ });
  await expect(bento).toContainText("colpo d'occhio");
  await bento.click();
  await expect(bento).toHaveAttribute("aria-checked", "true");

  await page.getByRole("link", { name: "Dashboard", exact: true }).click();
  const hero = page.getByRole("link", { name: /Prossima scadenza/ });
  await expect(hero).toBeVisible({ timeout: 10_000 });
  await expect(hero).toContainText("Bollo auto");
  await expect(hero).toContainText("tra 9 giorni");

  await page.getByLabel("Domanda per Hinthia").fill("Quando scade il bollo?");
  await page.getByRole("button", { name: "Chiedi", exact: true }).click();
  await expect(page).toHaveURL(/\/ai\?q=/, { timeout: 15_000 });
  await expect(page.getByLabel("Fai una domanda")).toHaveValue("Quando scade il bollo?");

  // E Storie: la giornata a schermate. Le barre avanzano da sole (6 secondi l'una) e si può andare avanti a tocchi.
  await openSettings(page, user);
  await page.getByRole("tab", { name: "Aspetto" }).click();
  await page.getByRole("tab", { name: "Dashboard" }).click();
  const stories = page.getByRole("radio", { name: /Storie/ });
  await expect(stories).toContainText("scorrono da sole");
  await stories.click();
  await expect(stories).toHaveAttribute("aria-checked", "true");

  await page.getByRole("link", { name: "Dashboard", exact: true }).click();
  const story = page.getByRole("group", { name: /^Storia \d di 5/ });
  await expect(story).toHaveAttribute("aria-label", "Storia 1 di 5: Oggi", { timeout: 10_000 });
  await expect(story.getByRole("heading", { level: 3 })).toHaveText("Tutto in ordine oggi"); // il bollo è stato rimandato
  await page.getByRole("button", { name: "Storia successiva" }).click();
  await expect(story).toHaveAttribute("aria-label", "Storia 2 di 5: Scadenze");
  await expect(story).toContainText("Bollo auto");
  // Da sola, dopo qualche secondo, passa alla successiva.
  await expect(story).toHaveAttribute("aria-label", "Storia 3 di 5: Archivio", { timeout: 12_000 });
});
