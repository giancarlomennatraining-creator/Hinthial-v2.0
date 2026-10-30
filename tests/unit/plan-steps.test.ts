import { describe, expect, it } from "vitest";
import { PLAN_PILLARS, computePlan, planProgress, type PlanInput } from "@/domain/plan/steps";
import type { DocumentSummary } from "@/domain/documents/types";
import type { FriendListItem } from "@/domain/friends/types";
import type { CapsuleListItem } from "@/domain/capsules/types";
import type { Category } from "@/domain/categories/types";
import { NOTE_MIME_TYPE } from "@/lib/content-kind";

function buildInput(overrides: Partial<PlanInput> = {}): PlanInput {
  return { documents: [], categories: [], friends: [], capsules: [], legacyEnabled: false, emergencyCardFilled: false, ...overrides };
}

const RACCONTI = { id: "cat-racconti", name: "Racconti", icon: "📖" } as Category;

function doc(overrides: Partial<DocumentSummary> = {}): DocumentSummary {
  return {
    id: "d1",
    filename: "Polizza auto.pdf",
    mimeType: "application/pdf",
    size: 100,
    categoryId: null,
    relatedAssetId: null,
    createdAt: "2026-01-01",
    storagePath: "",
    wrappedDocumentKey: "",
    expiresAt: null,
    notes: "",
    extractedAt: null,
    hasThumbnail: false,
    aiExtractionExcluded: false,
    structuredFields: {},
    aiSynthesisGeneratedAt: null,
    analysisStatus: null,
    analysisUpdatedAt: null,
    issuer: "",
    deletedAt: null,
    purgeAt: null,
    dossierIds: [],
    ...overrides,
  };
}

function story(overrides: Partial<DocumentSummary> = {}): DocumentSummary {
  return doc({ id: "s1", filename: "Dove sei nato?", mimeType: NOTE_MIME_TYPE, categoryId: RACCONTI.id, ...overrides });
}

function friend(overrides: Partial<FriendListItem> = {}): FriendListItem {
  return {
    id: "c1",
    name: "Maria",
    email: "maria@esempio.it",
    firstName: "",
    lastName: "",
    avatarPath: null,
    avatarUrl: null,
    role: "Coniuge",
    status: "active",
    isFriend: false,
    isGuardian: false,
    linkedUserId: null,
    createdAt: "2026-01-01",
    ...overrides,
  };
}

function capsule(overrides: Partial<CapsuleListItem> = {}): CapsuleListItem {
  return {
    id: "cap1",
    title: "Per Maria",
    content: "",
    contentStyle: "simple",
    openEffect: "discreet",
    attachments: [],
    linkedDocuments: [],
    relatedFriends: [friend()],
    status: "ready",
    accessCondition: "manual",
    openAt: "2027-01-01",
    openOnLegacy: false,
    createdAt: "2026-01-01",
    ...overrides,
  } as CapsuleListItem;
}

const done = (input: PlanInput, key: string) => computePlan(input).find((s) => s.key === key)?.done;

describe("computePlan", () => {
  it("nove passi in quattro pilastri, nell'ordine in cui si percorrono, ognuno con il suo posto dove farlo", () => {
    const steps = computePlan(buildInput());
    expect(steps.map((s) => s.key)).toEqual([
      "security",
      "first-document",
      "friend",
      "guardian",
      "story",
      "capsule",
      "emergency-card",
      "delivery",
      "legacy",
    ]);
    expect(steps.map((s) => s.pillar)).toEqual([
      "security",
      "security",
      "people",
      "people",
      "memories",
      "memories",
      "legacy",
      "legacy",
      "legacy",
    ]);
    expect(steps.map((s) => s.href)).toEqual([
      "/archive",
      "/archive/new?mode=upload",
      "/friends",
      "/friends",
      "/raccontami",
      "/capsules/new",
      "/settings?tab=profile&section=card",
      "/capsules/new",
      "/legacy",
    ]);
  });

  it("non c'è un passo 'Crea un account': si parte dalla chiave, che è l'unica cosa già fatta", () => {
    const steps = computePlan(buildInput());
    expect(steps.filter((s) => s.done).map((s) => s.key)).toEqual(["security"]);
  });

  it("il primo documento è qualunque cosa che non sia un racconto, e non conta quello nel cestino", () => {
    const input = (documents: DocumentSummary[]) => buildInput({ documents, categories: [RACCONTI] });
    expect(done(input([]), "first-document")).toBe(false);
    expect(done(input([doc()]), "first-document")).toBe(true);
    // Un racconto ha il suo passo: non basta a "mettere dentro il primo documento".
    expect(done(input([story()]), "first-document")).toBe(false);
    expect(done(input([story({ mimeType: "audio/webm" })]), "first-document")).toBe(false);
    expect(done(input([doc({ deletedAt: "2026-02-01", purgeAt: "2026-03-01" })]), "first-document")).toBe(false);
    // Un PDF messo per sbaglio nella categoria Racconti è un documento.
    expect(done(input([doc({ categoryId: RACCONTI.id })]), "first-document")).toBe(true);
  });

  it("il primo racconto conta solo se è una nota (o un audio) nella categoria Racconti", () => {
    expect(done(buildInput({ documents: [story()] }), "story")).toBe(false); // categoria mai creata
    expect(done(buildInput({ documents: [story()], categories: [RACCONTI] }), "story")).toBe(true);
    expect(done(buildInput({ documents: [story({ mimeType: "audio/webm" })], categories: [RACCONTI] }), "story")).toBe(true);
    expect(done(buildInput({ documents: [story({ mimeType: "application/pdf" })], categories: [RACCONTI] }), "story")).toBe(false);
    expect(done(buildInput({ documents: [story({ categoryId: "altra" })], categories: [RACCONTI] }), "story")).toBe(false);
    expect(done(buildInput({ documents: [story({ deletedAt: "2026-02-01" })], categories: [RACCONTI] }), "story")).toBe(false);
  });

  it("amico e guardiano: il guardiano deve essere attivo", () => {
    expect(done(buildInput({ friends: [friend()] }), "friend")).toBe(true);
    expect(done(buildInput({ friends: [friend()] }), "guardian")).toBe(false);
    expect(done(buildInput({ friends: [friend({ isGuardian: true })] }), "guardian")).toBe(true);
    expect(done(buildInput({ friends: [friend({ isGuardian: true, status: "revoked" })] }), "guardian")).toBe(false);
  });

  it("la capsula 'preparata' conta anche da bozza se è per qualcuno; quella 'consegnata' solo se chiusa e aperta dall'eredità", () => {
    expect(done(buildInput({ capsules: [capsule({ relatedFriends: [] })] }), "capsule")).toBe(false);
    expect(done(buildInput({ capsules: [capsule({ status: "draft" })] }), "capsule")).toBe(true);

    expect(done(buildInput({ capsules: [capsule()] }), "delivery")).toBe(false);
    expect(done(buildInput({ capsules: [capsule({ openOnLegacy: true })] }), "delivery")).toBe(true);
    // Una bozza non arriva a nessuno, nemmeno se segnata per la consegna.
    expect(done(buildInput({ capsules: [capsule({ status: "draft", openOnLegacy: true })] }), "delivery")).toBe(false);
  });

  it("senza capsule il passo della consegna rimanda a scriverne una; con capsule chiuse, a sceglierle in Eredità", () => {
    const none = computePlan(buildInput()).find((s) => s.key === "delivery")!;
    expect(none.href).toBe("/capsules/new");
    expect(none.action).toBe("Scrivi");

    const some = computePlan(buildInput({ capsules: [capsule()] })).find((s) => s.key === "delivery")!;
    expect(some.href).toBe("/legacy");
    expect(some.action).toBe("Scegli");
  });

  it("scheda d'emergenza ed Eredità digitale", () => {
    expect(done(buildInput(), "emergency-card")).toBe(false);
    expect(done(buildInput({ emergencyCardFilled: true }), "emergency-card")).toBe(true);
    expect(done(buildInput(), "legacy")).toBe(false);
    expect(done(buildInput({ legacyEnabled: true }), "legacy")).toBe(true);
  });
});

describe("planProgress", () => {
  const everything = (): PlanInput => {
    const guardian = friend({ isGuardian: true });
    return buildInput({
      documents: [doc(), story()],
      categories: [RACCONTI],
      friends: [guardian],
      capsules: [capsule({ relatedFriends: [guardian], openOnLegacy: true })],
      legacyEnabled: true,
      emergencyCardFilled: true,
    });
  };

  it("all'inizio: 1 su 9 (la chiave), il prossimo passo è il primo documento", () => {
    const progress = planProgress(computePlan(buildInput()));
    expect(progress.done).toBe(1);
    expect(progress.total).toBe(9);
    expect(progress.percent).toBe(11);
    expect(progress.next?.key).toBe("first-document");
  });

  it("il prossimo passo è il primo non fatto nell'ordine del piano, non l'ultimo arrivato", () => {
    const progress = planProgress(computePlan(buildInput({ documents: [doc()], legacyEnabled: true })));
    expect(progress.next?.key).toBe("friend");
  });

  it("un pilastro si completa quando lo sono tutti i suoi passi", () => {
    const progress = planProgress(computePlan(buildInput({ documents: [doc()] })));
    expect(progress.pillars.map((p) => [p.id, p.complete])).toEqual([
      ["security", true],
      ["people", false],
      ["memories", false],
      ["legacy", false],
    ]);
    expect(progress.pillars.map((p) => `${p.done}/${p.total}`)).toEqual(["2/2", "0/2", "0/2", "0/3"]);
  });

  it("i pilastri sono quattro, nell'ordine del disegno di Oggi", () => {
    expect(PLAN_PILLARS.map((p) => p.id)).toEqual(["security", "people", "memories", "legacy"]);
    expect(planProgress(computePlan(buildInput())).pillars.map((p) => p.id)).toEqual(PLAN_PILLARS.map((p) => p.id));
  });

  it("a piano finito non c'è un prossimo passo e tutti i pilastri sono completi", () => {
    const progress = planProgress(computePlan(everything()));
    expect(progress.done).toBe(9);
    expect(progress.percent).toBe(100);
    expect(progress.next).toBeNull();
    expect(progress.pillars.every((p) => p.complete)).toBe(true);
  });
});
