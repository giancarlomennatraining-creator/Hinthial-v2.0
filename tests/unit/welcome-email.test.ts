import { describe, expect, it } from "vitest";
import { welcomeEmail } from "@/lib/email/templates";

describe("welcomeEmail", () => {
  it("greets by first name and points to the app", () => {
    const { subject, html } = welcomeEmail("Marta");
    expect(subject).toBe("Il tuo account Hinthial è pronto");
    expect(html).toContain("Ciao Marta,");
    expect(html).toContain("/dashboard");
  });

  it("says the master password cannot be recovered, and that the recovery key never goes in an email", () => {
    const { html } = welcomeEmail("Marta");
    expect(html).toContain("non possiamo recuperarla");
    expect(html).toContain("mai in un'email");
  });

  it("escapes the name, which the user typed", () => {
    const { html } = welcomeEmail('<img src=x onerror="alert(1)">');
    expect(html).not.toContain("<img");
    expect(html).toContain("&lt;img");
  });

  it("still greets without a name", () => {
    expect(welcomeEmail(null).html).toContain("Ciao, il tuo account è attivo.");
    expect(welcomeEmail("  ").html).toContain("Ciao, il tuo account è attivo.");
  });
});
