import { expect, test } from "./fixtures";
import { MASTER_PASSWORD, openAnalysedDocument } from "./hinthia";

// Requires a configured Supabase project (.env.local) --- see README.md.
//
// Il meccanismo delle proposte, quelle che arrivano dalla lettura di Hinthia (simulata: v. hinthia.ts): le due
// promesse che nessun test unitario può verificare sono che accettare scrive davvero (l'effetto si vede altrove) e che
// rifiutare viene ricordato (il rifiuto passa per il database, cifrato, e va riletto e decifrato perché la proposta
// resti sparita).

// "exact": senza, "Accetta tutto" sarebbe contato come una proposta.
const accettaDi = (page: import("@playwright/test").Page) =>
  page.getByRole("tabpanel", { name: /^Chiedi a Hinthia/ }).getByRole("button", { name: "Accetta", exact: true });

test("accettare una proposta scrive davvero, e si può annullare", async ({ page }) => {
  test.slow();

  await openAnalysedDocument(page, { expectedProposals: 3 });

  const proposte = page.getByRole("tabpanel", { name: /^Chiedi a Hinthia/ });
  await expect(proposte).toContainText("3 giu 2027");

  // La scadenza si vede sulla tab "Scheda": va aperta per guardarla.
  const schedaTab = page.getByRole("tab", { name: "Scheda" });
  const hinthiaTab = page.getByRole("tab", { name: /^Chiedi a Hinthia/ });
  const scadenza = page.getByLabel("Scadenza");
  await schedaTab.click();
  await expect(scadenza).toHaveValue("");
  await hinthiaTab.click();

  await accettaDi(page).first().click();

  // La scheda si aggiorna, e la proposta sparisce: ciò che è impostato non si ripropone.
  // L'annullamento è condiviso sopra le tab, non dentro il pannello: non deve sparire cambiando tab.
  const lastAction = page.getByRole("status", { name: "Ultima proposta" });
  await expect(lastAction).toContainText("Scadenza impostata");
  await schedaTab.click();
  await expect(scadenza).toHaveValue("2027-06-03", { timeout: 20_000 });
  await hinthiaTab.click();

  // Annullamento, subito e senza lasciare la pagina: rimette il campo com'era, e la proposta torna a comparire.
  await lastAction.getByRole("button", { name: "Annulla" }).click();
  await expect(proposte).toContainText("3 giu 2027");
  await schedaTab.click();
  await expect(scadenza).toHaveValue("", { timeout: 20_000 });
  await hinthiaTab.click();

  // Si riaccetta, e stavolta si va a vedere l'effetto fuori dall'Archivio.
  await accettaDi(page).first().click();
  await schedaTab.click();
  await expect(scadenza).toHaveValue("2027-06-03", { timeout: 20_000 });

  await page.getByRole("link", { name: "Scadenze", exact: true }).click();
  await expect(page.getByText("polizza.pdf").first()).toBeVisible({ timeout: 20_000 });
});

test("un rifiuto viene ricordato e sopravvive al ricaricamento", async ({ page }) => {
  test.slow();

  await openAnalysedDocument(page, { expectedProposals: 3 });

  const proposte = page.getByRole("tabpanel", { name: /^Chiedi a Hinthia/ });
  await expect(proposte).toContainText("Scadenza");
  // 3 proposte (scadenza, categoria, emittente): il conteggio dei bottoni "Accetta" distingue una proposta accettabile.
  await expect(accettaDi(page)).toHaveCount(3);

  await proposte.getByRole("button", { name: "No, grazie" }).first().click();
  await expect(page.getByRole("status", { name: "Ultima proposta" })).toContainText("Non te lo richiederò più");
  await expect(accettaDi(page)).toHaveCount(2);

  // La prova vera: il rifiuto è cifrato nel database, e per restare valido dev'essere riletto e decifrato al caricamento successivo.
  // Anche la lettura di Hinthia è salvata: dopo il ricaricamento le proposte si ricalcolano senza chiamare di nuovo il modello.
  await page.reload();
  await page.getByLabel("Master password", { exact: true }).fill(MASTER_PASSWORD);
  await page.getByRole("button", { name: "Sblocca", exact: true }).click();
  await page.getByRole("tab", { name: /^Chiedi a Hinthia/ }).click();

  // Rifiutarne una non è rifiutarle tutte, ma la proposta rifiutata non deve tornare.
  await expect(proposte).toBeVisible({ timeout: 30_000 });
  await expect(accettaDi(page)).toHaveCount(2);
});

test("modificare una proposta prima di accettarla", async ({ page }) => {
  test.slow();

  await openAnalysedDocument(page, { expectedProposals: 3 });

  await page
    .getByRole("tabpanel", { name: /^Chiedi a Hinthia/ })
    .getByRole("button", { name: "Modifica" })
    .first()
    .click();

  // Il caso più frequente: la data c'è ma è quella sbagliata.
  await page.getByLabel("Scadenza da impostare").fill("2028-01-15");
  // exact: senza, ambiguo con "Salva modifiche" della Scheda sempre modificabile.
  await page.getByRole("button", { name: "Salva", exact: true }).click();

  await page.getByRole("tab", { name: "Scheda" }).click();
  await expect(page.getByLabel("Scadenza")).toHaveValue("2028-01-15", { timeout: 20_000 });
});

test("le scelte sulle proposte restano in Impostazioni > Attività, filtrabili per contenuto", async ({ page }) => {
  test.slow();

  await openAnalysedDocument(page, { expectedProposals: 3 });

  await accettaDi(page).first().click();
  await page.getByRole("tab", { name: "Scheda" }).click();
  await expect(page.getByLabel("Scadenza")).toHaveValue("2027-06-03", { timeout: 20_000 });

  // Ogni scrittura automatica deve lasciare traccia in Attività, raggiungibile dal contenuto con il filtro già impostato.
  await page.getByRole("link", { name: /Vedi attività di questo contenuto/ }).click();
  await expect(page).toHaveURL(/\/settings\?tab=activity&entity=document(:|%3A)/, { timeout: 15_000 });
  await expect(page.getByRole("table").filter({ visible: true }).getByText("Proposta accettata").first()).toBeVisible({
    timeout: 30_000,
  });
});
