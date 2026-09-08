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
 * I test dedicati al popup stesso (v. master-key-intro.spec.ts)
 * importano `test`/`expect` direttamente da "@playwright/test", non da
 * qui: altrimenti si chiuderebbe da sé prima di poter verificare
 * alcunché.
 */
export const test = base.extend({
  page: async ({ page }, use) => {
    const dismissMasterKeyIntro = page.getByRole("button", { name: "Più tardi" });
    await page.addLocatorHandler(dismissMasterKeyIntro, async () => {
      await dismissMasterKeyIntro.click();
    });
    // eslint-disable-next-line react-hooks/rules-of-hooks -- Playwright's fixture callback param, not React's use() hook.
    await use(page);
  },
});

export { expect };
export type { Page };
