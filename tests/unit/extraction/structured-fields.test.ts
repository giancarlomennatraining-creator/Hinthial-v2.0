/**
 * FASE 18 --- i campi ricavati dal testo di un documento.
 *
 * È il file di questa fase in cui è più facile sbagliare senza
 * accorgersene: una regex troppo larga non lancia un'eccezione, mostra
 * semplicemente un dato falso con l'aria di saperlo. Quindi si testano
 * tanto i casi che devono essere riconosciuti quanto --- soprattutto ---
 * quelli che NON devono esserlo.
 */
import { describe, expect, it } from "vitest";
import {
  extractStructuredFields,
  findDateContext,
  type StructuredField,
  type StructuredFieldKind,
} from "@/domain/extraction/structured-fields";

function field(text: string, kind: StructuredFieldKind): StructuredField | undefined {
  return extractStructuredFields(text).find((f) => f.kind === kind);
}

describe("la data del documento", () => {
  it.each([
    ["Referto del 14 marzo 2026", "2026-03-14"],
    ["Referto del 14 mar 2026", "2026-03-14"],
    ["Data: 14/03/2026", "2026-03-14"],
    ["Data: 14-03-2026", "2026-03-14"],
    ["Data: 2026-03-14", "2026-03-14"],
  ])("riconosce %s", (text, expected) => {
    expect(field(text, "document-date")?.value).toBe(expected);
  });

  it("legge giorno/mese e non mese/giorno: è un prodotto italiano", () => {
    expect(field("Data: 03/04/2026", "document-date")?.value).toBe("2026-04-03");
  });

  it("espande l'anno a due cifre", () => {
    expect(field("Data: 14/03/98", "document-date")?.value).toBe("1998-03-14");
    expect(field("Data: 14/03/26", "document-date")?.value).toBe("2026-03-14");
  });

  it("preferisce la data etichettata alla prima che incontra", () => {
    const text = "Protocollo 11/01/2026\nAzienda X\nData del prelievo: 14 marzo 2026";
    expect(field(text, "document-date")?.value).toBe("2026-03-14");
  });

  it("mostra la data come è scritta nel documento, non normalizzata", () => {
    expect(field("Data: 14 marzo 2026", "document-date")?.raw).toBe("14 marzo 2026");
  });

  it("porta con sé il pezzo di testo da cui viene", () => {
    const found = field("Referto emesso il 14 marzo 2026 dal dott. Ferrari", "document-date");
    expect(found?.context).toContain("emesso il 14 marzo 2026");
  });

  describe("non si inventa date", () => {
    it("scarta il 31 febbraio", () => {
      expect(field("Data: 31/02/2026", "document-date")).toBeUndefined();
    });

    it("scarta un anno implausibile, che è quasi sempre un errore di lettura", () => {
      expect(field("Data: 14/03/9026", "document-date")).toBeUndefined();
    });

    it("non scambia la numerazione di un contratto per una data", () => {
      // Col punto come separatore, ogni "art. 2.1.3" sarebbe una data.
      expect(field("Vedi art. 2.1.2026 del contratto", "document-date")).toBeUndefined();
    });

    it("su un testo senza date non restituisce niente", () => {
      expect(extractStructuredFields("Nessun riferimento temporale qui")).toEqual([]);
    });
  });
});

describe("la scadenza", () => {
  it.each([
    "Polizza valida fino al 3 giugno 2027",
    "Scadenza: 3 giugno 2027",
    "La copertura scade il 3 giugno 2027",
    "Data di scadenza 03/06/2027",
  ])("la riconosce in «%s»", (text) => {
    expect(field(text, "expiry")?.value).toBe("2027-06-03");
  });

  it("una data qualunque non è una scadenza", () => {
    // In una polizza ce ne sono cinque: indovinare quale sia la scadenza
    // è esattamente la scommessa che non va fatta.
    expect(field("Emessa il 3 giugno 2027", "expiry")).toBeUndefined();
  });

  it("non confonde la scadenza con la data del documento", () => {
    const text = "Emessa il 14 marzo 2026. Valida fino al 3 giugno 2027.";
    expect(field(text, "document-date")?.value).toBe("2026-03-14");
    expect(field(text, "expiry")?.value).toBe("2027-06-03");
  });

  describe("scadenze dichiarate a intervallo", () => {
    it("calcola «controllo tra dodici mesi» dalla data del documento", () => {
      const text = "Data del prelievo: 14 marzo 2026\nSi consiglia controllo tra dodici mesi.";
      const expiry = field(text, "expiry");
      expect(expiry?.value).toBe("2027-03-14");
      // Va detto che è un conto fatto da Hinthial, non una data scritta.
      expect(expiry?.derived).toBe(true);
    });

    it("funziona anche con le cifre e con le altre unità", () => {
      expect(
        field("Data: 14/03/2026. Da ripetere fra 6 mesi.", "expiry")?.value,
      ).toBe("2026-09-14");
      expect(
        field("Data: 14/03/2026. Rinnovo tra 2 anni.", "expiry")?.value,
      ).toBe("2028-03-14");
    });

    it("senza una data del documento non calcola niente", () => {
      // Contare da oggi sarebbe sbagliato per qualunque documento
      // archiviato in ritardo --- cioè per la maggioranza.
      expect(field("Si consiglia controllo tra dodici mesi.", "expiry")).toBeUndefined();
    });

    it("serve una parola che apra: non ogni «fra due settimane» è una scadenza", () => {
      const text = "Data: 14/03/2026. Il paziente riferisce dolore da tre settimane.";
      expect(field(text, "expiry")).toBeUndefined();
    });

    it("una scadenza scritta batte una da calcolare", () => {
      const text = "Data: 14/03/2026. Valida fino al 3 giugno 2027. Controllo tra sei mesi.";
      const expiries = extractStructuredFields(text).filter((f) => f.kind === "expiry");
      expect(expiries).toHaveLength(1);
      expect(expiries[0].value).toBe("2027-06-03");
    });
  });
});

describe("più di una scadenza possibile", () => {
  it("mostra entrambe invece di scommettere su quale sia quella giusta", () => {
    const text = "Valida fino al 3 giugno 2027. Rinnovo entro il 10 luglio 2027.";
    const expiries = extractStructuredFields(text).filter((f) => f.kind === "expiry");
    expect(expiries.map((f) => f.value)).toEqual(["2027-06-03", "2027-07-10"]);
  });

  it("con una sola scadenza scritta, resta un solo candidato", () => {
    const expiries = extractStructuredFields("Scadenza: 3 giugno 2027").filter(
      (f) => f.kind === "expiry",
    );
    expect(expiries).toHaveLength(1);
  });
});

describe("l'emittente", () => {
  it("riconosce un'intestazione in maiuscolo in cima al foglio", () => {
    const text = "AZIENDA OSPEDALIERA DI GUBBIO\nReferto di esame istologico";
    expect(field(text, "issuer")?.value).toBe("AZIENDA OSPEDALIERA DI GUBBIO");
  });

  it("riconosce una forma societaria anche non in maiuscolo", () => {
    expect(field("Generali Italia S.p.A.\nPolizza n. 123", "issuer")?.value).toBe(
      "Generali Italia S.p.A.",
    );
  });

  it.each(["Enel Energia", "TIM Business", "Vodafone Italia", "INPS Comunicazione", "Poste Italiane"])(
    "riconosce il marchio/ente %s, senza bisogno di una forma societaria attaccata",
    (line) => {
      expect(field(`${line}\nAltra riga di intestazione`, "issuer")?.value).toBe(line);
    },
  );

  it("non scatta su una parola simile ma diversa (confine di parola sui marchi corti)", () => {
    expect(field("È stato molto conveniente\nSeconda riga qualunque", "issuer")).toBeUndefined();
  });

  describe("non scambia il titolo del documento per chi l'ha emesso", () => {
    it("scarta un titolo in maiuscolo", () => {
      // È maiuscolo esattamente come lo sarebbe una carta intestata vera.
      expect(field("CERTIFICATO DI RESIDENZA\nRilasciato oggi", "issuer")).toBeUndefined();
    });

    it("scarta una riga fatta di codici", () => {
      expect(field("PROT. 2026/114/A\nnumero 5512", "issuer")).toBeUndefined();
    });

    it("non cerca l'emittente a metà documento", () => {
      // Il maiuscolo in cima è una convenzione; più in basso vuol dire altro.
      const text = Array(8).fill("riga qualunque di testo").join("\n") + "\nAZIENDA OSPEDALIERA";
      expect(field(text, "issuer")).toBeUndefined();
    });

    it("una parola sola non basta", () => {
      expect(field("OSPEDALE\nreferto", "issuer")).toBeUndefined();
    });
  });

  describe("più di un candidato possibile", () => {
    it("mostra ogni riga che sembra un emittente, non solo la prima", () => {
      const text = "AZIENDA OSPEDALIERA DI GUBBIO\nStudio medico associato Dott. Ferrari\nReferto";
      const issuers = extractStructuredFields(text).filter((f) => f.kind === "issuer");
      expect(issuers.map((f) => f.value)).toEqual([
        "AZIENDA OSPEDALIERA DI GUBBIO",
        "Studio medico associato Dott. Ferrari",
      ]);
    });
  });
});

describe("il titolo (FASE 19b)", () => {
  it("unisce la riga che descrive il documento e chi l'ha emesso", () => {
    const text = "GENERALI ITALIA S.p.A.\nPolizza responsabilita civile\nEmessa il 14 marzo 2026";
    // L'emittente resta com'è scritto: è un nome proprio, e ridurlo a
    // minuscolo si legge peggio, non meglio.
    expect(field(text, "title")?.value).toBe(
      "Polizza responsabilita civile --- GENERALI ITALIA S.p.A.",
    );
  });

  it("riporta un titolo urlato in maiuscolo a una forma leggibile", () => {
    // In un elenco, "CERTIFICATO DI RESIDENZA" grida e si legge peggio
    // di tutti i nomi che gli stanno accanto.
    expect(field("CERTIFICATO DI RESIDENZA\nComune di Perugia", "title")?.value).toContain(
      "Certificato di residenza",
    );
  });

  it("sta senza emittente quando non ce n'è uno", () => {
    expect(field("Ricevuta di pagamento\nqualcosa d'altro", "title")?.value).toBe(
      "Ricevuta di pagamento",
    );
  });

  it("non inventa un titolo dove non c'è una riga che descriva il documento", () => {
    expect(field("Ada Lovelace\nvia Manzoni 4\nMilano", "title")).toBeUndefined();
  });
});

describe("ritrovare una data nel testo (FASE 19b)", () => {
  const POLIZZA = "Emessa il 14 marzo 2026. Valida fino al 3 giugno 2027.";

  it("ritrova una data scritta in lettere partendo dal formato del calendario", () => {
    // È il punto: chi corregge sceglie da un calendario e ottiene
    // "2027-06-03", mentre il documento dice "3 giugno 2027". Cercare il
    // testo non troverebbe mai niente.
    expect(findDateContext(POLIZZA, "2027-06-03")).toContain("Valida fino al 3 giugno 2027");
  });

  it("ritrova anche l'altra data del documento, se è quella corretta a mano", () => {
    expect(findDateContext(POLIZZA, "2026-03-14")).toContain("Emessa il 14 marzo 2026");
  });

  it("dice di no quando quella data nel documento non c'è", () => {
    // Succede spesso e per buoni motivi: l'OCR l'ha storpiata, oppure
    // la scadenza è calcolata, oppure la sa l'utente da fuori.
    expect(findDateContext(POLIZZA, "2030-01-01")).toBeNull();
  });
});

describe("il referto scansionato dei test e2e", () => {
  // Lo stesso testo che l'OCR ricava da tests/e2e/fixtures/ocr-scansione.pdf:
  // è il caso reale su cui è stata pensata tutta la fase.
  const REFERTO = [
    "AZIENDA OSPEDALIERA DI GUBBIO",
    "Referto di esame istologico",
    "",
    "Paziente: Ada Lovelace",
    "Data del prelievo: 14 marzo 2026",
    "Medico refertante: dott. Ferrari",
    "",
    "Conclusioni:",
    "Quadro compatibile con lesione benigna.",
    "Si consiglia controllo tra dodici mesi.",
  ].join("\n");

  it("ne ricava emittente, data e scadenza da ricontrollo", () => {
    expect(field(REFERTO, "issuer")?.value).toBe("AZIENDA OSPEDALIERA DI GUBBIO");
    expect(field(REFERTO, "document-date")?.value).toBe("2026-03-14");
    expect(field(REFERTO, "expiry")).toMatchObject({ value: "2027-03-14", derived: true });
  });
});
