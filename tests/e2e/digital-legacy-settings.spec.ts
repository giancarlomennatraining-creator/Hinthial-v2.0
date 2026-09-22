import { expect, test } from "./fixtures";
import { createConfirmedTestUser, fullName, uniqueTestUser } from "./test-users";

// Requires a configured Supabase project (.env.local) --- see README.md.

test("Impostazioni > Eredità digitale mostra i preset, il riepilogo si aggiorna, e i valori personalizzati si salvano e sopravvivono a un refresh", async ({
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

  // Consultabile subito, prima ancora di configurare la cifratura ---
  // nessun dato cifrato coinvolto, come Sicurezza/Privacy.
  await page.getByRole("button", { name: fullName(user) }).click();
  await page.getByRole("link", { name: "Impostazioni" }).click();
  await page.getByRole("tab", { name: "Eredità digitale" }).click();

  await expect(page.getByRole("heading", { name: "Eredità digitale" })).toBeVisible();

  // Spento di default (v. richiesta utente: opt-in esplicito) --- il
  // riepilogo lo dice esplicitamente, non solo l'interruttore.
  const enableToggle = page.getByRole("checkbox", { name: "Attiva Eredità digitale" });
  await expect(enableToggle).not.toBeChecked();
  await expect(page.getByText("Il monitoraggio è spento")).toBeVisible();

  // Default: "Normale" già selezionato, nessuna etichetta "Personalizzato".
  const normale = page.getByRole("radio", { name: "Normale" });
  await expect(normale).toHaveAttribute("aria-checked", "true");
  await expect(page.getByText("Personalizzato --- almeno un valore")).not.toBeVisible();
  await expect(page.getByText(/In totale, nel caso peggiore, circa 7 mesi/)).toBeVisible();

  // Attivarlo chiede conferma (v. window.confirm) e fa sparire l'avviso "spento".
  page.once("dialog", (dialog) => dialog.accept());
  await enableToggle.click();
  await expect(enableToggle).toBeChecked();
  await expect(page.getByText("Il monitoraggio è spento")).not.toBeVisible();

  // Scegliere "Prudente" aggiorna subito il riepilogo, senza bisogno di salvare.
  await page.getByRole("radio", { name: "Prudente" }).click();
  await expect(page.getByText(/In totale, nel caso peggiore, circa un anno/)).toBeVisible();

  // Toccare un valore personalizzato fa passare la scelta a "Personalizzato".
  await page.getByRole("button", { name: "Personalizza i valori" }).click();
  const inactivityField = page.getByLabel("Soglia di inattività (giorni)");
  await expect(inactivityField).toHaveValue("180");
  await inactivityField.fill("200");
  await expect(page.getByRole("radio", { name: "Prudente" })).toHaveAttribute("aria-checked", "false");
  await expect(page.getByText("Personalizzato --- almeno un valore")).toBeVisible();

  // Salvare e ricaricare: i valori personalizzati sopravvivono.
  await Promise.all([
    page.waitForResponse((res) => res.url().includes("/profiles") && res.request().method() === "PATCH"),
    page.getByRole("button", { name: "Salva" }).click(),
  ]);
  await expect(page.getByText("Impostazioni di Eredità digitale salvate.")).toBeVisible();

  await page.reload();
  await page.getByRole("tab", { name: "Eredità digitale" }).click();
  await expect(page.getByText("Personalizzato --- almeno un valore")).toBeVisible();
  // Anche l'interruttore acceso sopravvive al refresh --- niente più conferma qui: solo l'ACCENSIONE la richiede.
  await expect(page.getByRole("checkbox", { name: "Attiva Eredità digitale" })).toBeChecked();
  await expect(page.getByText("Il monitoraggio è spento")).not.toBeVisible();
  // Il preset è "custom": i campi sono già aperti, niente da cliccare per vederli.
  await expect(page.getByRole("button", { name: "Nascondi i valori" })).toBeVisible();
  await expect(page.getByLabel("Soglia di inattività (giorni)")).toHaveValue("200");

  // Un valore fuori dai limiti viene riportato dentro al salvataggio.
  await page.getByLabel("Soglia di inattività (giorni)").fill("5");
  await Promise.all([
    page.waitForResponse((res) => res.url().includes("/profiles") && res.request().method() === "PATCH"),
    page.getByRole("button", { name: "Salva" }).click(),
  ]);
  await expect(page.getByLabel("Soglia di inattività (giorni)")).toHaveValue("30");
});

test("la prova generale mostra un calendario reale e si ferma onestamente senza guardiani", async ({
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

  // La prova generale richiede la master key (guardiani/capsule sono
  // cifrati) --- a differenza del resto della scheda: configurarla qui.
  await page.getByRole("link", { name: "Archivio", exact: true }).click();
  await page.getByLabel("Master password", { exact: true }).fill("una-master-password-solida");
  await page.getByLabel("Conferma master password").fill("una-master-password-solida");
  await page.getByRole("button", { name: "Crea" }).click();
  await expect(page.getByLabel("Ho salvato la recovery key in un posto sicuro.")).toBeVisible({
    timeout: 45_000,
  });
  await page.getByLabel("Ho salvato la recovery key in un posto sicuro.").check();
  await page.getByRole("button", { name: "Continua" }).click();
  await expect(page.getByRole("heading", { name: "Archivio" })).toBeVisible();

  await page.getByRole("button", { name: fullName(user) }).click();
  await page.getByRole("link", { name: "Impostazioni" }).click();
  await page.getByRole("tab", { name: "Eredità digitale" }).click();
  await expect(page.getByRole("heading", { name: "Eredità digitale" })).toBeVisible();

  await expect(page.getByRole("heading", { name: "La prova generale" })).toBeVisible();
  await page.getByRole("button", { name: "🎬 Prova generale" }).click();
  const dialog = page.getByRole("dialog", { name: "Prova generale di Eredità digitale" });
  await expect(dialog).toBeVisible();

  // Il riepilogo usa le impostazioni predefinite ("Normale") --- lo stesso
  // testo già mostrato altrove in questa scheda, non un doppione a mano.
  await expect(dialog.getByText(/In totale, nel caso peggiore, circa 7 mesi/)).toBeVisible();

  // Il calendario cita davvero le fasi reali, con le date calcolate.
  await expect(dialog.getByText("Ultimo accesso registrato")).toBeVisible();
  await expect(dialog.getByText("3 promemoria via email, ogni 10 giorni")).toBeVisible();
  await expect(dialog.getByText("Periodo di grazia")).toBeVisible();
  await expect(dialog.getByText("I tuoi guardiani vengono interpellati")).toBeVisible();

  // Senza guardiani collegati, si ferma onestamente lì --- nessuna
  // conferma d'esempio, nessuna fase successiva inventata.
  await expect(dialog.getByText("Esempio", { exact: true })).not.toBeVisible();
  await expect(dialog.getByText("Verifica formale")).not.toBeVisible();
  await expect(dialog.getByText("Le capsule già condivise si aprono")).not.toBeVisible();
  await expect(dialog.getByText("Non hai ancora nessun guardiano collegato")).toBeVisible();
  await expect(dialog.getByText("Nessuna capsula già condivisa oggi")).toBeVisible();

  // Il disclaimer non concede alcun accesso reale.
  await expect(dialog.getByText(/Solo un'anteprima su questo schermo/)).toBeVisible();

  await page.getByRole("button", { name: "Chiudi la prova generale" }).click();
  await expect(dialog).not.toBeVisible();
});
