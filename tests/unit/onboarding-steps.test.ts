import { describe, expect, it } from "vitest";
import {
  computeBasicOnboardingSteps,
  computeOnboardingSteps,
  onboardingCompletionPercent,
  type OnboardingSourceData,
} from "@/domain/onboarding/steps";
import type { DocumentSummary } from "@/domain/documents/types";
import type { FriendListItem } from "@/domain/friends/types";
import type { CapsuleListItem } from "@/domain/capsules/types";
import type { Category } from "@/domain/categories/types";
import { NOTE_MIME_TYPE } from "@/lib/content-kind";

function buildData(overrides: Partial<OnboardingSourceData> = {}): OnboardingSourceData {
  return { documents: [], categories: [], friends: [], capsules: [], legacyEnabled: false, ...overrides };
}

const RACCONTI = { id: "cat-racconti", name: "Racconti", icon: "📖" } as Category;

function doc(overrides: Partial<DocumentSummary> = {}): DocumentSummary {
  return {
    id: "d1",
    filename: "Dove sei nato?",
    mimeType: NOTE_MIME_TYPE,
    size: 100,
    categoryId: RACCONTI.id,
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

function capsule(relatedFriends: FriendListItem[]): CapsuleListItem {
  return {
    id: "cap1",
    title: "Per Maria",
    content: "",
    contentStyle: "simple",
    openEffect: "discreet",
    attachments: [],
    linkedDocuments: [],
    relatedFriends,
    status: "draft",
    accessCondition: "manual",
    openAt: "2027-01-01",
    openOnLegacy: false,
    createdAt: "2026-01-01",
  };
}

const done = (data: OnboardingSourceData, key: string) => computeOnboardingSteps(data).find((s) => s.key === key)?.done;

describe("computeOnboardingSteps", () => {
  it("un passo per pilastro, nell'ordine della pagina pubblica, nessuno opzionale", () => {
    const steps = computeOnboardingSteps(buildData());
    expect(steps.map((s) => s.key)).toEqual(["account", "security", "story", "friend", "capsule", "guardian", "legacy"]);
    expect(steps.map((s) => s.href)).toEqual(["/dashboard", "/archive", "/raccontami", "/friends", "/capsules/new", "/friends", "/legacy"]);
    expect(steps.every((s) => !("optional" in s))).toBe(true);
  });

  it("il primo racconto conta solo se è una nota nella categoria Racconti", () => {
    expect(done(buildData({ documents: [doc()] }), "story")).toBe(false); // categoria mai creata
    expect(done(buildData({ documents: [doc()], categories: [RACCONTI] }), "story")).toBe(true);
    expect(done(buildData({ documents: [doc({ mimeType: "application/pdf" })], categories: [RACCONTI] }), "story")).toBe(false);
    expect(done(buildData({ documents: [doc({ categoryId: "altra" })], categories: [RACCONTI] }), "story")).toBe(false);
  });

  it("la capsula conta solo se è per qualcuno", () => {
    expect(done(buildData({ capsules: [capsule([])] }), "capsule")).toBe(false);
    expect(done(buildData({ capsules: [capsule([friend()])] }), "capsule")).toBe(true);
  });

  it("amico, guardiano ed Eredità digitale", () => {
    expect(done(buildData({ friends: [friend()] }), "friend")).toBe(true);
    expect(done(buildData({ friends: [friend()] }), "guardian")).toBe(false);
    expect(done(buildData({ friends: [friend({ isGuardian: true })] }), "guardian")).toBe(true);
    expect(done(buildData(), "legacy")).toBe(false);
    expect(done(buildData({ legacyEnabled: true }), "legacy")).toBe(true);
  });

  it("tutti fatti solo quando lo è ciascun passo", () => {
    expect(computeOnboardingSteps(buildData()).every((s) => s.done)).toBe(false);
    const guardian = friend({ isGuardian: true });
    const all = computeOnboardingSteps(
      buildData({ documents: [doc()], categories: [RACCONTI], friends: [guardian], capsules: [capsule([guardian])], legacyEnabled: true }),
    );
    expect(all.every((s) => s.done)).toBe(true);
  });
});

describe("onboardingCompletionPercent", () => {
  it("account e chiave fatti su 7 passi -> 29%", () => {
    expect(onboardingCompletionPercent(computeOnboardingSteps(buildData()))).toBe(29);
  });
});

describe("computeBasicOnboardingSteps", () => {
  it("solo account e chiave, mostrabili prima dello sblocco", () => {
    const steps = computeBasicOnboardingSteps(false);
    expect(steps.map((s) => s.key)).toEqual(["account", "security"]);
    expect(steps.find((s) => s.key === "security")?.done).toBe(false);
    expect(onboardingCompletionPercent(steps)).toBe(50);
  });

  it("la chiave risulta fatta appena la cifratura è configurata, anche a schermo bloccato", () => {
    const steps = computeBasicOnboardingSteps(true);
    expect(steps.find((s) => s.key === "security")?.done).toBe(true);
    expect(onboardingCompletionPercent(steps)).toBe(100);
  });

  it("gli stessi due passi della checklist completa", () => {
    const full = computeOnboardingSteps(buildData());
    const basic = computeBasicOnboardingSteps(true);
    expect(basic[0]).toEqual(full[0]);
    expect(basic[1]).toEqual(full[1]);
  });
});
