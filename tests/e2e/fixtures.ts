import { test as base, expect, type Page } from "@playwright/test";

/**
 * Estende il `test` base per chiudere automaticamente il popup "Crea la
 * tua master key" (v. MasterKeyIntroModal) ogni volta che compare ---
 * mostrato una sola volta, subito dopo il login, a chi non ha ancora
 * configurato la cifratura. Senza questo, essendo un overlay a tutto
 * schermo, bloccherebbe il primo click di praticamente ogni test di
 * questa suite (quasi tutti fanno login e poi cliccano subito altrove).
 *
 * `addLocatorHandler` lo gestisce da sé: Playwright lo controlla prima
 * di ogni azione e, se il pulsante è visibile, lo chiude prima di
 * proseguire --- nessun test deve saperne o gestirlo a mano.
 *
 * Chiude allo stesso modo la finestra di sblocco della Dashboard (v. UnlockDialog, "Più tardi"), che compare a ogni
 * visita con la cassaforte bloccata: chi ricarica la dashboard e poi clicca altrove non deve saperne. Quella delle
 * pagine che servono la chiave non ha "Più tardi" e resta, come per un utente vero; quella aperta di proposito da un
 * riquadro delle Impostazioni resta anch'essa.
 *
 * I test dedicati al popup stesso (v. master-key-intro.spec.ts)
 * importano `test`/`expect` direttamente da "@playwright/test", non da
 * qui: altrimenti si chiuderebbe da sé prima di poter verificare
 * alcunché.
 */
export const test = base.extend({
  page: async ({ page }, use) => {
    // Con un limite di tempo: se il pulsante sparisce da solo mentre lo si clicca (succede quando una finestra cambia
    // al volo), il gestore non resta ad aspettarlo fino alla fine del test; l'azione che l'ha chiamato riprova.
    const dismissMasterKeyIntro = page
      .getByRole("dialog", { name: "Crea la tua master key" })
      .getByRole("button", { name: "Più tardi" });
    await page.addLocatorHandler(dismissMasterKeyIntro, async () => {
      await dismissMasterKeyIntro.click({ timeout: 3_000 }).catch(() => {});
    });
    // La finestra di sblocco si chiude da sola solo sulla Dashboard, dove compare da sé: altrove (un riquadro delle
    // Impostazioni) l'ha aperta il test di proposito e deve restare.
    const dismissDashboardUnlock = page
      .getByRole("dialog", { name: "Sblocca la cassaforte" })
      .getByRole("button", { name: "Più tardi" });
    await page.addLocatorHandler(dismissDashboardUnlock, async () => {
      if (/\/dashboard(\?|$)/.test(page.url())) await dismissDashboardUnlock.click({ timeout: 3_000 }).catch(() => {});
    }, { noWaitAfter: true }); // altrove il gestore non fa nulla e il pulsante resta: non va atteso che sparisca
    // eslint-disable-next-line react-hooks/rules-of-hooks -- Playwright's fixture callback param, not React's use() hook.
    await use(page);
  },
});

export { expect };
export type { Page };
