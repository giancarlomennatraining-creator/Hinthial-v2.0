import type { Locator } from "@playwright/test";

/**
 * Le azioni di ogni riga di lista (Modifica/Elimina/Apri/...) vivono in
 * un menu "⋮" (v. RowActionsMenu), non più come bottoni sempre visibili
 * sulla riga --- va aperto prima di poter scegliere una voce (ora un
 * `role="menuitem"`, non più `role="button"`). `row` va già scoped alla
 * riga giusta (es. `page.locator("li", { hasText: "..." })`) per il
 * bottone "⋮" stesso.
 *
 * Il pannello con le voci NON è più un discendente della riga una volta
 * aperto (va in un portal su document.body, per non farsi troncare da
 * una tabella con overflow --- v. RowActionsMenu): la voce va cercata
 * con `page.getByRole("menuitem", { name: "..." })`, non con
 * `row.getByRole(...)`. Sicuro perché un solo menu resta aperto alla
 * volta in questi test.
 */
export async function openRowMenu(row: Locator): Promise<void> {
  await row.getByRole("button", { name: /^Azioni per/ }).click();
}
