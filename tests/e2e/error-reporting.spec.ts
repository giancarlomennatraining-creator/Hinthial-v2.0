import { expect, test } from "./fixtures";

// Gli avvisi sugli errori (v. src/lib/errors/): un errore del browser che nessuno gestisce parte verso /api/errors con
// tipo, messaggio e pagina, e niente parametri dell'indirizzo. Qui il server non salva nulla (registra solo in
// produzione su Vercel): si guarda cosa parte dal browser, e che la rotta risponda sempre senza dire niente.

test("un errore non gestito nel browser viene segnalato, con la sola pagina e senza parametri", async ({ page }) => {
  const sent: Record<string, unknown>[] = [];
  await page.route("**/api/errors", async (route) => {
    sent.push(JSON.parse(route.request().postData() ?? "{}"));
    await route.fulfill({ status: 204 });
  });

  await page.goto("/login?da=prova");
  // L'ascoltatore si monta quando la pagina diventa interattiva: si lancia lo stesso errore finché arriva. I doppioni li
  // scarta l'ascoltatore stesso, quindi ne parte comunque uno solo.
  await expect
    .poll(
      async () => {
        await page.evaluate(() => {
          setTimeout(() => {
            throw new TypeError("Prova di errore dal browser");
          });
        });
        await page.waitForTimeout(300);
        return sent.length;
      },
      { timeout: 15_000 },
    )
    .toBeGreaterThan(0);
  await page.waitForTimeout(500);
  expect(sent).toHaveLength(1);
  expect(sent[0]).toMatchObject({ source: "client", kind: "TypeError", message: "Prova di errore dal browser", path: "/login" });
});

test("la rotta degli errori risponde sempre 204, anche a richieste sbagliate o troppo grandi", async ({ request }) => {
  for (const data of ["non è json", JSON.stringify({ source: "server", message: "x" }), "x".repeat(10_000)]) {
    const response = await request.post("/api/errors", { data, headers: { "Content-Type": "application/json" } });
    expect(response.status()).toBe(204);
    expect(await response.text()).toBe("");
  }
});
