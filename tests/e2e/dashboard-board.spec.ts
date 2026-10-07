import { expect, test, type Page } from "./fixtures";
import { createConfirmedTestUser, uniqueTestUser } from "./test-users";
import { openSettings } from "./settings-nav";

// Requires a configured Supabase project (.env.local) --- see README.md.

async function addReminder(page: Page, title: string, inDays: number) {
  await page.getByRole("link", { name: "+ Crea scadenza" }).click();
  const date = new Date(Date.now() + inDays * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  await page.getByLabel("Titolo").fill(title);
  await page.getByLabel("Data").fill(date);
  await page.getByRole("button", { name: "Aggiungi scadenza" }).click();
  await expect(page).toHaveURL(/\/reminders$/, { timeout: 15_000 });
  await expect(page.getByText(title)).toBeVisible({ timeout: 10_000 });
}

/** Un trascinamento vero col mouse: prende la carta, la porta sopra la colonna a piccoli passi e la rilascia. */
async function drag(page: Page, card: ReturnType<Page["locator"]>, column: ReturnType<Page["locator"]>) {
  const from = (await card.boundingBox())!;
  const to = (await column.boundingBox())!;
  await page.mouse.move(from.x + from.width / 2, from.y + 20);
  await page.mouse.down();
  await page.mouse.move(from.x + from.width / 2 + 12, from.y + 30, { steps: 3 });
  await page.mouse.move(to.x + to.width / 2, to.y + 60, { steps: 12 });
  await page.mouse.up();
}

test("la dashboard Lavagna: si trascina una carta in un'altra colonna e la scadenza si sposta davvero; si annulla; 'Da sistemare' la rifiuta", async ({
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

  await addReminder(page, "Bollo auto", 2);
  await addReminder(page, "Bolletta luce", 15);

  await openSettings(page, user);
  await page.getByRole("tab", { name: "Aspetto" }).click();
  await page.getByRole("tab", { name: "Dashboard" }).click();
  const board = page.getByRole("radio", { name: /Lavagna/ });
  await expect(board).toContainText("trascina una carta");
  await board.click();
  await expect(board).toHaveAttribute("aria-checked", "true");

  await page.getByRole("link", { name: "Dashboard" }).click();
  const week = page.getByRole("region", { name: "Questa settimana" });
  const month = page.getByRole("region", { name: "Questo mese" });
  const later = page.getByRole("region", { name: "Più avanti" });
  const done = page.getByRole("region", { name: "Fatte" });
  const over = page.getByRole("region", { name: "Da sistemare" });
  await expect(week.getByText("Bollo auto")).toBeVisible({ timeout: 10_000 });
  await expect(month.getByText("Bolletta luce")).toBeVisible();

  // Trascinata in "Più avanti": cambia colonna, e si può annullare.
  await drag(page, week.getByRole("listitem").filter({ hasText: "Bollo auto" }), later);
  await expect(later.getByText("Bollo auto")).toBeVisible({ timeout: 10_000 });
  await expect(page.getByRole("status").filter({ hasText: "spostata in" })).toBeVisible();
  await page.getByRole("button", { name: "Annulla" }).click();
  await expect(week.getByText("Bollo auto")).toBeVisible({ timeout: 10_000 });

  // In "Da sistemare" non si può: la carta resta dov'è.
  await drag(page, week.getByRole("listitem").filter({ hasText: "Bollo auto" }), over);
  await expect(page.getByText(/Non si può rimandare indietro nel tempo/)).toBeVisible();
  await expect(week.getByText("Bollo auto")).toBeVisible();

  // In "Fatte": completata davvero. Uscendo e rientrando dalla dashboard (che rilegge tutto) resta lì.
  await drag(page, week.getByRole("listitem").filter({ hasText: "Bollo auto" }), done);
  await expect(done.getByText("Bollo auto")).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText("1 fatta oggi")).toBeVisible();
  await page.getByRole("link", { name: "Scadenze" }).click();
  await expect(page.getByRole("heading", { name: "Scadenze" })).toBeVisible();
  await page.getByRole("link", { name: "Dashboard" }).click();
  await expect(page.getByRole("region", { name: "Fatte" }).getByText("Bollo auto")).toBeVisible({ timeout: 10_000 });

  // Una spostata di colonna conserva il nuovo giorno: "Bolletta luce" (tra 15 giorni) in "Più avanti" sta lì anche dopo.
  await drag(page, month.getByRole("listitem").filter({ hasText: "Bolletta luce" }), later);
  await expect(later.getByText("Bolletta luce")).toBeVisible({ timeout: 10_000 });
  await page.getByRole("link", { name: "Scadenze" }).click();
  await page.getByRole("link", { name: "Dashboard" }).click();
  await expect(page.getByRole("region", { name: "Più avanti" }).getByText("Bolletta luce")).toBeVisible({ timeout: 10_000 });
});
