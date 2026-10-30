import { expect, test } from "./fixtures";
import { setUpWithDocument } from "./hinthia";
import { openSettings } from "./settings-nav";

// Requires a configured Supabase project (.env.local) --- see README.md.
//
// "Raccontami": una domanda alla volta, ogni risposta diventa una nota cifrata nella categoria "Racconti" dell'Archivio.
// Con il consenso a Silva arriva anche una domanda di approfondimento: la chiamata ad Anthropic è sempre simulata
// (`page.route`), nessun test spedisce testo a un servizio esterno, qualunque chiave ci sia in `.env.local`.

const FIRST_QUESTION = "Dove sei nato e com'era il posto in cui sei cresciuto?";
const SECOND_QUESTION = "Qual è il tuo ricordo più bello da bambino?";

test("senza il consenso a Silva, Raccontami fa le domande scritte e salva ogni risposta come racconto", async ({ page }) => {
  test.slow();

  await setUpWithDocument(page);
  await page.getByRole("link", { name: "Raccontami", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Raccontami", level: 1 })).toBeVisible({ timeout: 15_000 });

  // La prima domanda, e un avviso onesto: senza consenso nessun testo lascia il dispositivo.
  const domanda = page.getByRole("region", { name: "Domanda" });
  await expect(domanda.getByRole("heading", { name: FIRST_QUESTION })).toBeVisible();
  await expect(domanda.getByText(/attiva Silva in Impostazioni/)).toBeVisible();

  // Una chiamata al servizio, in questo caso, sarebbe un errore: la tengo d'occhio.
  let followUpCalls = 0;
  await page.route("**/api/ai/follow-up", (route) => {
    followUpCalls++;
    return route.fulfill({ status: 403, contentType: "application/json", body: JSON.stringify({ error: "no" }) });
  });

  await domanda.getByLabel("La tua risposta").fill("A Sassoferrato, in una casa con il pozzo in cortile.");
  await domanda.getByRole("button", { name: "Salva il racconto" }).click();
  await expect(domanda.getByText("Racconto salvato")).toBeVisible({ timeout: 20_000 });
  await expect(domanda.getByText("Lo trovi in Archivio, nella categoria Racconti.")).toBeVisible();
  await expect(domanda.getByText("Silva chiede")).toHaveCount(0);
  expect(followUpCalls).toBe(0);

  // Il racconto si può far arrivare a qualcuno: "Fallo arrivare a…" apre la capsula già avviata.
  await expect(domanda.getByRole("link", { name: "Fallo arrivare a…" })).toHaveAttribute("href", /\/capsules\/new\?da=documento:/);

  // Compare tra i racconti, e la prossima domanda è la seconda.
  const racconti = page.getByRole("region", { name: "I tuoi racconti" });
  await expect(racconti.getByRole("link", { name: FIRST_QUESTION })).toBeVisible();
  await expect(racconti.getByText("1 domanda raccontata su 16.")).toBeVisible();
  await domanda.getByRole("button", { name: "Prossima domanda" }).click();
  await expect(domanda.getByRole("heading", { name: SECOND_QUESTION })).toBeVisible();

  // Si salta senza scrivere, e il tema si cambia dai pulsanti.
  await domanda.getByRole("button", { name: "Un'altra domanda" }).click();
  await expect(domanda.getByRole("heading", { name: "Chi ha contato di più nella tua vita, e perché?" })).toBeVisible();
  await page.getByRole("group", { name: "Temi" }).getByRole("button", { name: /Per chi amo/ }).click();
  await expect(domanda.getByText("Per chi amo", { exact: true })).toBeVisible();
});

test("con il consenso a Silva arriva una domanda di approfondimento, e se non riesce il racconto resta salvato", async ({ page }) => {
  test.slow();

  const user = await setUpWithDocument(page);

  // Il consenso a Silva si dà in Impostazioni: prima il cancello generale, poi la funzione.
  await openSettings(page, user);
  await page.getByRole("tab", { name: "Privacy e Silva" }).click();
  const master = page.getByRole("switch", { name: "Consenti l'uso di Silva" });
  const rispondi = page.getByRole("checkbox", { name: /^Silva che risponde/ });
  await expect(rispondi).toBeDisabled();
  await Promise.all([
    page.waitForResponse((res) => res.url().includes("/profiles") && res.request().method() === "PATCH"),
    master.click(),
  ]);
  await expect(rispondi).toBeEnabled();
  await Promise.all([
    page.waitForResponse((res) => res.url().includes("/profiles") && res.request().method() === "PATCH"),
    rispondi.check(),
  ]);

  let lastBody: { question?: string; answer?: string } | null = null;
  await page.route("**/api/ai/follow-up", (route) => {
    lastBody = route.request().postDataJSON() as { question?: string; answer?: string };
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ text: "Com'era la casa dei tuoi nonni?" }),
    });
  });

  await page.getByRole("link", { name: "Raccontami", exact: true }).click();
  const domanda = page.getByRole("region", { name: "Domanda" });
  await expect(domanda.getByRole("heading", { name: FIRST_QUESTION })).toBeVisible({ timeout: 15_000 });
  await expect(domanda.getByText(/Salvandola, Silva la legge per farti una domanda in più/)).toBeVisible();

  await domanda.getByLabel("La tua risposta").fill("A Sassoferrato.");
  await domanda.getByRole("button", { name: "Salva il racconto" }).click();

  // La domanda di Silva compare dopo il salvataggio; la richiesta ha portato domanda e risposta.
  await expect(domanda.getByText("Com'era la casa dei tuoi nonni?")).toBeVisible({ timeout: 20_000 });
  expect(lastBody).toEqual({ question: FIRST_QUESTION, answer: "A Sassoferrato." });

  await domanda.getByLabel("La tua risposta alla domanda di Silva").fill("Aveva un pozzo e un noce enorme.");
  await domanda.getByRole("button", { name: "Aggiungi al racconto" }).click();
  await expect(domanda.getByText(/La risposta in più è stata aggiunta/)).toBeVisible({ timeout: 20_000 });

  // Il racconto in Archivio contiene la risposta e l'approfondimento.
  await page.getByRole("region", { name: "I tuoi racconti" }).getByRole("link", { name: FIRST_QUESTION }).click();
  await expect(page).toHaveURL(/\/archive\/[0-9a-f-]+$/, { timeout: 15_000 });
  const anteprima = page.getByRole("region", { name: "Anteprima" });
  await expect(anteprima).toContainText("A Sassoferrato.", { timeout: 15_000 });
  await expect(anteprima).toContainText("Com'era la casa dei tuoi nonni?");
  await expect(anteprima).toContainText("Aveva un pozzo e un noce enorme.");

  // Se la domanda di Silva non arriva, il racconto è comunque salvato e si prosegue senza errori.
  await page.route("**/api/ai/follow-up", (route) =>
    route.fulfill({ status: 502, contentType: "application/json", body: JSON.stringify({ error: "giù" }) }),
  );
  await page.getByRole("link", { name: "Raccontami", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Raccontami", level: 1 })).toBeVisible({ timeout: 15_000 });
  const seconda = page.getByRole("region", { name: "Domanda" });
  await expect(seconda.getByRole("heading", { name: SECOND_QUESTION })).toBeVisible({ timeout: 15_000 });
  await seconda.getByLabel("La tua risposta").fill("Le estati dai nonni.");
  await seconda.getByRole("button", { name: "Salva il racconto" }).click();
  await expect(seconda.getByText("Lo trovi in Archivio, nella categoria Racconti.")).toBeVisible({ timeout: 20_000 });
  await expect(seconda.getByText("Silva chiede")).toHaveCount(0);
});

test("si può rispondere a voce: la registrazione diventa un racconto audio cifrato, che si riascolta e si fa arrivare a qualcuno", async ({
  page,
}) => {
  test.slow();

  // Microfono finto con permesso già dato (v. launchOptions in playwright.config.ts): niente dispositivo vero.
  await setUpWithDocument(page);
  await page.getByRole("link", { name: "Raccontami", exact: true }).click();
  const domanda = page.getByRole("region", { name: "Domanda" });
  await expect(domanda.getByRole("heading", { name: FIRST_QUESTION })).toBeVisible({ timeout: 15_000 });

  // Si sceglie la voce: c'è solo la registrazione audio, niente video.
  const modi = domanda.getByRole("group", { name: "Come vuoi rispondere" });
  await expect(modi.getByRole("button", { name: "✍️ Scrivi" })).toHaveAttribute("aria-pressed", "true");
  await modi.getByRole("button", { name: "🎙️ Racconta a voce" }).click();
  await expect(modi.getByRole("button", { name: "🎙️ Racconta a voce" })).toHaveAttribute("aria-pressed", "true");
  await expect(domanda.getByRole("button", { name: "🎥 Registra video" })).toHaveCount(0);

  await domanda.getByRole("button", { name: "🎤 Registra audio" }).click();
  await expect(domanda.getByText(/Registrazione · /)).toBeVisible();
  await page.waitForTimeout(1500);
  await domanda.getByRole("button", { name: "Ferma registrazione" }).click();
  await domanda.getByRole("button", { name: "Salva il racconto" }).click();

  await expect(domanda.getByText("Racconto a voce salvato")).toBeVisible({ timeout: 20_000 });
  await expect(domanda.getByText("Lo trovi in Archivio, nella categoria Racconti.")).toBeVisible();
  await expect(domanda.getByRole("link", { name: "Fallo arrivare a…" })).toHaveAttribute("href", /\/capsules\/new\?da=documento:/);

  // Nell'elenco è segnato "a voce" e conta come domanda raccontata; "Ascolta" lo decifra e lo fa suonare.
  const racconti = page.getByRole("region", { name: "I tuoi racconti" });
  const riga = racconti.getByRole("listitem").filter({ hasText: FIRST_QUESTION });
  await expect(riga.getByText(/a voce · raccontato il/)).toBeVisible();
  await expect(racconti.getByText("1 domanda raccontata su 16.")).toBeVisible();
  await riga.getByRole("button", { name: "▶ Ascolta" }).click();
  await expect(riga.getByLabel(`Racconto a voce: ${FIRST_QUESTION}`)).toBeVisible({ timeout: 15_000 });

  // La scelta della voce resta per la domanda dopo.
  await domanda.getByRole("button", { name: "Prossima domanda" }).click();
  await expect(domanda.getByRole("heading", { name: SECOND_QUESTION })).toBeVisible();
  await expect(domanda.getByRole("button", { name: "🎤 Registra audio" })).toBeVisible();
});
