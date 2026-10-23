import { expect, test } from "./fixtures";
import { createConfirmedTestUser, uniqueTestUser } from "./test-users";
import { acceptConfirm } from "./confirm-dialog";

// Requires a configured Supabase project (.env.local) --- see README.md.

test("Eredità digitale ha una sola scelta, quanto aspettare: le quattro fasi si aggiornano e la scelta sopravvive a un refresh", async ({
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

  // Consultabile subito, prima di configurare la cifratura: nessun dato cifrato coinvolto.
  await page.getByRole("link", { name: "Eredità digitale", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Eredità digitale", level: 1 })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Quanto aspettare" })).toBeVisible();

  // I blocchi che mostrano nomi e titoli cifrati chiedono la master key: un solo riquadro, non uno per blocco.
  await expect(page.getByText("Per usare questa sezione serve prima la master password.")).toHaveCount(1);
  await expect(page.getByRole("heading", { name: "Chi conferma la tua assenza" })).toHaveCount(0);

  // Spento di default (opt-in esplicito): il riepilogo lo dice, non solo l'interruttore.
  const enableToggle = page.getByRole("checkbox", { name: "Attiva Eredità digitale" });
  await expect(enableToggle).not.toBeChecked();
  await expect(page.getByText("Il monitoraggio è spento")).toBeVisible();

  // Una sola scelta, tre livelli: "Normale" già selezionato. Niente più valori da personalizzare.
  const normale = page.getByRole("radio", { name: /^Normale/ });
  await expect(normale).toHaveAttribute("aria-checked", "true");
  await expect(page.getByRole("radiogroup", { name: "Livello di prudenza" }).getByRole("radio")).toHaveCount(3);
  await expect(page.getByRole("button", { name: "Personalizza i valori" })).toHaveCount(0);
  await expect(page.getByText(/In totale, nel caso peggiore, circa 7 mesi/)).toBeVisible();

  // Le quattro fasi, con i giorni del livello scelto.
  const fasi = page.getByRole("list", { name: "Le quattro fasi" }).getByRole("listitem");
  await expect(fasi).toHaveCount(4);
  await expect(fasi.nth(0)).toContainText("1. Silenzio");
  await expect(fasi.nth(0)).toContainText("Se non accedi per 4 mesi ti scrivo 3 volte, una ogni 10 giorni");
  await expect(fasi.nth(1)).toContainText("basta la maggioranza");
  await expect(fasi.nth(3)).toContainText("4. Consegna");

  // Attivarlo chiede conferma (v. window.confirm) e fa sparire l'avviso "spento".
  await enableToggle.click();
  await acceptConfirm(page);
  await expect(enableToggle).toBeChecked();
  await expect(page.getByText("Il monitoraggio è spento")).not.toBeVisible();

  // Scegliere "Prudente" aggiorna subito riepilogo e fasi, senza bisogno di salvare.
  await page.getByRole("radio", { name: /^Prudente/ }).click();
  await expect(page.getByText(/In totale, nel caso peggiore, circa un anno/)).toBeVisible();
  await expect(fasi.nth(0)).toContainText("Se non accedi per 6 mesi");
  await expect(fasi.nth(1)).toContainText("devono essere tutti d'accordo");

  // Salvare e ricaricare: la scelta e l'interruttore sopravvivono.
  await Promise.all([
    page.waitForResponse((res) => res.url().includes("/profiles") && res.request().method() === "PATCH"),
    page.getByRole("button", { name: "Salva" }).click(),
  ]);
  await expect(page.getByText("Impostazioni di Eredità digitale salvate.")).toBeVisible();

  await page.reload();
  await expect(page.getByRole("radio", { name: /^Prudente/ })).toHaveAttribute("aria-checked", "true");
  await expect(page.getByRole("checkbox", { name: "Attiva Eredità digitale" })).toBeChecked();
  await expect(page.getByText("Il monitoraggio è spento")).not.toBeVisible();
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

  // La prova generale richiede la master key (guardiani/capsule sono cifrati), a differenza del resto della scheda.
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

  await page.getByRole("link", { name: "Eredità digitale", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Eredità digitale", level: 1 })).toBeVisible();

  // Con la cassaforte sbloccata compaiono i quattro blocchi; qui, vuoti, dicono cosa fare.
  await expect(page.getByRole("heading", { name: "Chi conferma la tua assenza" })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText("Non hai ancora nessun guardiano.")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Cosa arriverà" })).toBeVisible();
  await expect(page.getByText("Non hai ancora scritto nessuna capsula.")).toBeVisible();
  // La scheda d'emergenza non sta più qui: sta in Impostazioni, nel Profilo.
  await expect(page.getByRole("heading", { name: "Scheda d'emergenza" })).toHaveCount(0);

  // La prova generale sta dietro un link, non occupa la pagina.
  await expect(page.getByRole("heading", { name: "La prova generale" })).toHaveCount(0);
  await page.getByRole("button", { name: "Vedi cosa succederebbe se cominciasse oggi" }).click();
  await expect(page.getByRole("heading", { name: "La prova generale" })).toBeVisible();
  await page.getByRole("button", { name: "🎬 Prova generale" }).click();
  const dialog = page.getByRole("dialog", { name: "Prova generale di Eredità digitale" });
  await expect(dialog).toBeVisible();

  // Il riepilogo usa le impostazioni predefinite ("Normale"): lo stesso testo già mostrato altrove, non un doppione a mano.
  await expect(dialog.getByText(/In totale, nel caso peggiore, circa 7 mesi/)).toBeVisible();

  // Il calendario cita davvero le fasi reali, con le date calcolate.
  await expect(dialog.getByText("Ultimo accesso registrato")).toBeVisible();
  await expect(dialog.getByText("3 promemoria via email, ogni 10 giorni")).toBeVisible();
  await expect(dialog.getByText("Periodo di grazia")).toBeVisible();
  await expect(dialog.getByText("I tuoi guardiani vengono interpellati")).toBeVisible();

  // Senza guardiani collegati, si ferma onestamente lì: nessuna conferma d'esempio, nessuna fase inventata.
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
