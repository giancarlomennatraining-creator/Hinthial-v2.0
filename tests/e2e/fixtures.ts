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
    // L'Archivio si apre di default sulla Panoramica (v. archive-overview.ts); la maggior parte dei test, che cerca un contenuto
    // nell'elenco e lo seleziona o lo apre, parte invece dall'Elenco: la vista sta sul dispositivo, e si imposta una volta
    // sola, se non c'è già una scelta. I test della Panoramica e delle Schede (archive-views.spec.ts) le scelgono da sé.
    await page.addInitScript(() => {
      try {
        if (!window.localStorage.getItem("hinthial-archive-view")) window.localStorage.setItem("hinthial-archive-view", "elenco");
      } catch {
        // Senza memoria del browser si parte dalla Panoramica, come un utente qualunque.
      }
    });

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

    // Ogni test è anche un controllo della Content-Security-Policy (v. src/lib/security/csp.ts): se il browser blocca uno
    // script, un worker, un'immagine o una connessione, il test fallisce anche se la pagina sembrava funzionare.
    const cspViolations: string[] = [];
    page.on("console", (message) => {
      const text = message.text();
      if (/Content Security Policy|Refused to (load|execute|connect|create|frame|apply|evaluate|compile)/i.test(text)) {
        cspViolations.push(text);
      }
    });

    // eslint-disable-next-line react-hooks/rules-of-hooks -- Playwright's fixture callback param, not React's use() hook.
    await use(page);

    expect(cspViolations, "Il browser ha bloccato qualcosa per la Content-Security-Policy").toEqual([]);
  },
});

export { expect };
export type { Page };
