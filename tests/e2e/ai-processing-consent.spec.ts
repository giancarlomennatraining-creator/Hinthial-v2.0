import { expect, test } from "./fixtures";
import { createConfirmedTestUser, fullName, uniqueTestUser } from "./test-users";

// Requires a configured Supabase project (.env.local) --- see README.md.

/**
 * FASE 11 --- "Explicit AI processing" (v. HINTHIAL_MVP.md sezione 8),
 * con due livelli di consenso (v. discussione con l'utente): un
 * "cancello" generale in Impostazioni > Privacy (ai_master_enabled) e un
 * consenso specifico per la Chat (ai_chat_consent), gestibile sia lì
 * sia direttamente nella pagina AI --- sincronizzati, come
 * ListViewToggle/ListViewSettings. Non serve una vera ANTHROPIC_API_KEY
 * per verificare questo percorso end-to-end: con entrambi i consensi
 * attivi ma la chiave non configurata (il caso di questo ambiente di
 * sviluppo), la route risponde con un errore chiaro invece di un crash
 * silenzioso.
 */
test("il consenso all'AI reale ha un cancello generale (Impostazioni > Privacy) e un consenso specifico per la Chat, entrambi necessari", async ({
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

  // Nella pagina AI, senza il cancello generale, l'interruttore specifico
  // resta visibile ma disabilitato, con un rimando a dove accenderlo.
  await page.getByRole("link", { name: "AI", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Assistente AI" })).toBeVisible();
  const chatToggle = page.getByRole("switch", { name: "Risposte reali dell'assistente AI" });
  await expect(chatToggle).toHaveAttribute("aria-checked", "false");
  await expect(chatToggle).toBeDisabled();
  await expect(page.getByText(/consenso generale.*non è attivo/)).toBeVisible();

  // Il rimando porta davvero a Impostazioni --- da lì, la scheda Privacy.
  await page.getByRole("link", { name: "Impostazioni" }).click();
  await expect(page).toHaveURL(/\/settings$/);
  await page.getByRole("tab", { name: "Privacy" }).click();
  await expect(page.getByRole("heading", { name: "Intelligenza artificiale" })).toBeVisible();

  const masterSwitch = page.getByRole("switch", { name: "Consenti l'uso di IA esterna" });
  const chatCheckbox = page.getByRole("checkbox", { name: /^Chat/ });
  await expect(masterSwitch).toHaveAttribute("aria-checked", "false");
  await expect(chatCheckbox).toBeDisabled();

  // Accendere il cancello sblocca la funzione specifica, ma non la
  // accende da solo --- resta una scelta esplicita a sé.
  await Promise.all([
    page.waitForResponse((res) => res.url().includes("/profiles") && res.request().method() === "PATCH"),
    masterSwitch.click(),
  ]);
  await expect(masterSwitch).toHaveAttribute("aria-checked", "true");
  await expect(chatCheckbox).toBeEnabled();
  await expect(chatCheckbox).not.toBeChecked();

  await Promise.all([
    page.waitForResponse((res) => res.url().includes("/profiles") && res.request().method() === "PATCH"),
    chatCheckbox.check(),
  ]);
  await expect(chatCheckbox).toBeChecked();

  // Tornando sulla pagina AI, ora è tutto attivo --- stesso stato,
  // sincronizzato.
  await page.getByRole("link", { name: "AI", exact: true }).click();
  await expect(chatToggle).toHaveAttribute("aria-checked", "true");
  await expect(chatToggle).toBeEnabled();

  // Con entrambi i consensi attivi ma senza una vera chiave configurata
  // in questo ambiente, la domanda arriva comunque alla route
  // server-side, che risponde con un errore chiaro (non un crash, non
  // una risposta finta).
  await page.getByLabel("Fai una domanda").fill("Quali assicurazioni ho?");
  await page.getByRole("button", { name: "Chiedi" }).click();
  await expect(
    page.getByText("L'assistente AI reale non è ancora configurato su questo server."),
  ).toBeVisible({ timeout: 15_000 });

  // Spegnere il cancello generale spegne anche la funzione specifica.
  await page.getByRole("button", { name: fullName(user) }).click();
  await page.getByRole("link", { name: "Impostazioni" }).click();
  await page.getByRole("tab", { name: "Privacy" }).click();
  await Promise.all([
    page.waitForResponse((res) => res.url().includes("/profiles") && res.request().method() === "PATCH"),
    masterSwitch.click(),
  ]);
  await expect(masterSwitch).toHaveAttribute("aria-checked", "false");
  await expect(chatCheckbox).not.toBeChecked();
  await expect(chatCheckbox).toBeDisabled();

  // Resta impostato dopo un refresh vero --- Privacy non richiede la
  // Master Key sbloccata (v. PrivacyPanel), quindi qui basta ripescare
  // la scheda giusta dopo il ricaricamento.
  await page.reload();
  await page.getByRole("tab", { name: "Privacy" }).click();
  await expect(page.getByRole("heading", { name: "Intelligenza artificiale" })).toBeVisible();
  await expect(masterSwitch).toHaveAttribute("aria-checked", "false");
});
