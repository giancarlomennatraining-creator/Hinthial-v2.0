import { expect, test } from "./fixtures";
import { createConfirmedTestUser, uniqueTestUser } from "./test-users";

// Requires a configured Supabase project (.env.local) --- see README.md.

/**
 * FASE 11 --- "Explicit AI processing" (v. HINTHIAL_MVP.md sezione 8):
 * il consenso è spento di default, si attiva/disattiva esplicitamente
 * dalla pagina AI, e resta impostato dopo un refresh (sincronizzato sul
 * server, come nav_orientation). Non serve una vera ANTHROPIC_API_KEY
 * per verificare questo percorso end-to-end: con il consenso attivo ma
 * la chiave non configurata (il caso di questo ambiente di sviluppo),
 * la route risponde con un errore chiaro invece di un crash silenzioso
 * --- esercita comunque autenticazione, verifica del consenso lato
 * server e gestione dell'errore, senza spendere una vera chiamata a Claude.
 */
test("il consenso all'AI reale è spento di default, si attiva/disattiva dalla pagina AI e resta impostato dopo un refresh", async ({
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

  // Un bene in categoria Assicurazioni --- perché il retrieval locale
  // (che decide anche in questa modalità QUALI elementi inviare, v.
  // domain/ai/claude-provider.ts) trovi qualcosa di pertinente e la
  // domanda arrivi davvero alla route server-side, invece di fermarsi
  // in locale per mancanza di corrispondenze.
  await page.getByRole("link", { name: "Beni" }).click();
  await page.getByRole("link", { name: "+ Crea bene" }).click();
  await page.getByLabel("Nome").fill("Auto Panda");
  await page.locator("#categoryId").selectOption({ label: "🛡️ Assicurazioni" });
  await page.getByRole("button", { name: "Aggiungi bene" }).click();
  await expect(page).toHaveURL(/\/assets$/, { timeout: 15_000 });

  await page.getByRole("link", { name: "AI", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Assistente AI" })).toBeVisible();

  // Spento di default.
  const toggle = page.getByRole("switch", { name: "Risposte reali dell'assistente AI" });
  await expect(toggle).toHaveAttribute("aria-checked", "false");
  await expect(page.getByText("Risposte reali disattivate")).toBeVisible();

  // Attivarlo aggiorna subito la UI (testo del pulsante e dell'intestazione).
  await Promise.all([
    page.waitForResponse((res) => res.url().includes("/profiles") && res.request().method() === "PATCH"),
    toggle.click(),
  ]);
  await expect(toggle).toHaveAttribute("aria-checked", "true");
  await expect(page.getByText("Risposte reali attive")).toBeVisible();

  // Con il consenso attivo ma senza una vera chiave configurata in questo
  // ambiente, la domanda arriva comunque alla route server-side, che
  // risponde con un errore chiaro (non un crash, non una risposta finta).
  await page.getByLabel("Fai una domanda").fill("Quali assicurazioni ho?");
  await page.getByRole("button", { name: "Chiedi" }).click();
  await expect(
    page.getByText("L'assistente AI reale non è ancora configurato su questo server."),
  ).toBeVisible({ timeout: 15_000 });

  // Resta impostato dopo un refresh vero --- che, come sempre, richiede
  // di sbloccare di nuovo la Master Key (mai persistita, v.
  // MasterKeyProvider) prima di rivedere il contenuto della pagina.
  await page.reload();
  await page.getByLabel("Master password").fill("una-master-password-solida");
  await page.getByRole("button", { name: "Sblocca" }).click();
  await expect(page.getByRole("heading", { name: "Assistente AI" })).toBeVisible();
  await expect(page.getByRole("switch", { name: "Risposte reali dell'assistente AI" })).toHaveAttribute(
    "aria-checked",
    "true",
  );

  // Si può disattivare di nuovo.
  await Promise.all([
    page.waitForResponse((res) => res.url().includes("/profiles") && res.request().method() === "PATCH"),
    page.getByRole("switch", { name: "Risposte reali dell'assistente AI" }).click(),
  ]);
  await expect(page.getByRole("switch", { name: "Risposte reali dell'assistente AI" })).toHaveAttribute(
    "aria-checked",
    "false",
  );
});
