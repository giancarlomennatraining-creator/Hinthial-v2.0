import { expect, test } from "./fixtures";
import { createConfirmedTestUser, setTodayAiUsage, uniqueTestUser } from "./test-users";

// Requires a configured Supabase project (.env.local) and the migration 20261017000000_ai_daily_usage.sql.
//
// Il tetto giornaliero a Claude: l'utente è portato al tetto direttamente nel database, così nessuna chiamata arriva
// davvero ad Anthropic. Il server deve rifiutare prima di chiamarla, e le Impostazioni devono dirlo.

const LIMIT = 300; // il valore predefinito (v. src/lib/ai/daily-quota.ts): il server degli e2e non imposta AI_DAILY_CALL_LIMIT.

test("a tetto raggiunto Hinthia si ferma con un messaggio chiaro, e le Impostazioni lo dicono", async ({ page }) => {
  test.slow();
  const user = uniqueTestUser();
  await createConfirmedTestUser(user);
  await setTodayAiUsage(user.email, LIMIT);

  await page.goto("/login");
  await page.getByLabel("Email").fill(user.email);
  await page.getByLabel("Password").fill(user.password);
  await page.getByRole("button", { name: "Accedi" }).click();
  await expect(page).toHaveURL(/\/dashboard$/, { timeout: 15_000 });

  // La richiesta parte con la sessione dell'utente, come dal browser: consenso attivo, ma tetto raggiunto.
  const response = await page.request.post("/api/ai/follow-up", {
    data: { question: "Dove sei cresciuto?", answer: "In una casa vicino al mare." },
  });
  expect(response.status()).toBe(429);
  const body = await response.json();
  expect(body.error).toBe(`Hai usato tutte le ${LIMIT} richieste a Hinthia di oggi. Riprende domani: quello che hai già salvato resta com'è.`);

  const usage = await (await page.request.get("/api/ai/usage")).json();
  expect(usage).toEqual({ used: LIMIT, limit: LIMIT });

  await page.goto("/settings");
  await page.getByRole("tab", { name: "Hinthia" }).click();
  const status = page.getByRole("status", { name: "Richieste a Hinthia di oggi" });
  await expect(status).toContainText(`${LIMIT} richieste a Hinthia su ${LIMIT} al giorno`, { timeout: 15_000 });
  await expect(status).toContainText("Hai raggiunto il tetto: Hinthia riprende domani.");
});
