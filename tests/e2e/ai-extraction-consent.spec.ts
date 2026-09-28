import { expect, test } from "./fixtures";
import { createConfirmedTestUser, fullName, uniqueTestUser } from "./test-users";

// Requires a configured Supabase project (.env.local) --- see README.md.

/**
 * FASE 22/22b/24 --- il cancello generale e le funzioni specifiche che ne dipendono. L'estrazione avanzata (FASE
 * 22) ha oggi una funzione reale dietro (v. ai-content-analysis.spec.ts per il bottone "Chiedi a Claude"); questo
 * test resta sulla cascata di consenso in Impostazioni, comune a tutte le funzioni, incluso l'elenco per categoria
 * che ha sostituito l'eccezione a parte "Includi anche Salute" (Salute è ora una categoria come le altre).
 * Trascrizione e avvisi proattivi non hanno ancora una funzione dietro, ma la cascata deve comportarsi bene fin da
 * ora, prima che ci sia una vera funzione a verificarla altrove.
 */
test("cancello generale, estrazione avanzata per categoria, trascrizione e avvisi proattivi si spengono a cascata e sopravvivono a un refresh", async ({
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

  await page.getByRole("button", { name: fullName(user) }).click();
  await page.getByRole("link", { name: "Impostazioni" }).click();
  await page.getByRole("tab", { name: "Intelligenza artificiale" }).click();
  await expect(page.getByRole("heading", { name: "Intelligenza artificiale" })).toBeVisible();

  const masterSwitch = page.getByRole("switch", { name: "Consenti l'uso di IA esterna" });
  const extractionCheckbox = page.getByRole("checkbox", { name: /^🔒 Estrazione avanzata/ });
  // "Salute" è una categoria predefinita come le altre --- non più un'eccezione a parte con un consenso proprio.
  const saluteCheckbox = page.getByRole("checkbox", { name: "❤️ Salute" });
  const transcriptionCheckbox = page.getByRole("checkbox", { name: /^Trascrizione/ });
  const alertsCheckbox = page.getByRole("checkbox", { name: /^Generazione di avvisi proattivi/ });

  await expect(saluteCheckbox).toBeVisible();

  // Senza il cancello generale, tutto è disabilitato.
  await expect(extractionCheckbox).toBeDisabled();
  await expect(saluteCheckbox).toBeDisabled();
  await expect(transcriptionCheckbox).toBeDisabled();
  await expect(alertsCheckbox).toBeDisabled();

  await Promise.all([
    page.waitForResponse((res) => res.url().includes("/profiles") && res.request().method() === "PATCH"),
    masterSwitch.click(),
  ]);
  await expect(masterSwitch).toHaveAttribute("aria-checked", "true");

  // Accendere il cancello sblocca tutto tranne le categorie e gli avvisi
  // proattivi, che restano subordinati all'estrazione avanzata.
  await expect(extractionCheckbox).toBeEnabled();
  await expect(transcriptionCheckbox).toBeEnabled();
  await expect(saluteCheckbox).toBeDisabled();
  await expect(alertsCheckbox).toBeDisabled();

  await Promise.all([
    page.waitForResponse((res) => res.url().includes("/profiles") && res.request().method() === "PATCH"),
    extractionCheckbox.check(),
  ]);
  await expect(saluteCheckbox).toBeEnabled();
  await expect(alertsCheckbox).toBeEnabled();

  await Promise.all([
    page.waitForResponse((res) => res.url().includes("/categories") && res.request().method() === "PATCH"),
    saluteCheckbox.check(),
  ]);
  await Promise.all([
    page.waitForResponse((res) => res.url().includes("/profiles") && res.request().method() === "PATCH"),
    alertsCheckbox.check(),
  ]);
  await Promise.all([
    page.waitForResponse((res) => res.url().includes("/profiles") && res.request().method() === "PATCH"),
    transcriptionCheckbox.check(),
  ]);
  await expect(saluteCheckbox).toBeChecked();
  await expect(alertsCheckbox).toBeChecked();
  await expect(transcriptionCheckbox).toBeChecked();

  // Spegnere l'estrazione avanzata disabilita l'elenco per categoria e
  // spegne gli Avvisi proattivi --- ma non la Trascrizione, che è
  // indipendente, e non il consenso della categoria stessa (resta
  // acceso, semplicemente senza effetto finché l'estrazione è spenta).
  await Promise.all([
    page.waitForResponse((res) => res.url().includes("/profiles") && res.request().method() === "PATCH"),
    extractionCheckbox.uncheck(),
  ]);
  await expect(saluteCheckbox).toBeDisabled();
  await expect(alertsCheckbox).not.toBeChecked();
  await expect(alertsCheckbox).toBeDisabled();
  await expect(transcriptionCheckbox).toBeChecked();

  // Resta impostato dopo un refresh vero.
  await page.reload();
  await page.getByRole("tab", { name: "Intelligenza artificiale" }).click();
  await expect(page.getByRole("heading", { name: "Intelligenza artificiale" })).toBeVisible();
  await expect(extractionCheckbox).not.toBeChecked();
  await expect(transcriptionCheckbox).toBeChecked();
  await expect(saluteCheckbox).toBeDisabled();
  await expect(alertsCheckbox).toBeDisabled();

  // Riaccendere l'estrazione avanzata NON riaccende gli Avvisi da solo
  // --- resta una scelta esplicita a sé, come per il cancello generale.
  // Il consenso della categoria Salute, invece, era rimasto acceso
  // (non dipendeva da extractionConsent per essere salvato) e torna
  // subito visibile come tale.
  await Promise.all([
    page.waitForResponse((res) => res.url().includes("/profiles") && res.request().method() === "PATCH"),
    extractionCheckbox.check(),
  ]);
  await expect(saluteCheckbox).toBeEnabled();
  await expect(saluteCheckbox).toBeChecked();
  await expect(alertsCheckbox).toBeEnabled();
  await expect(alertsCheckbox).not.toBeChecked();

  // Spegnere il cancello generale spegne e disabilita tutto, trascrizione compresa.
  await Promise.all([
    page.waitForResponse((res) => res.url().includes("/profiles") && res.request().method() === "PATCH"),
    masterSwitch.click(),
  ]);
  await expect(masterSwitch).toHaveAttribute("aria-checked", "false");
  await expect(extractionCheckbox).not.toBeChecked();
  await expect(extractionCheckbox).toBeDisabled();
  await expect(transcriptionCheckbox).not.toBeChecked();
  await expect(transcriptionCheckbox).toBeDisabled();
});
