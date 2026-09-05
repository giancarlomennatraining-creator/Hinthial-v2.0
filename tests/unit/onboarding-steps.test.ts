import { describe, expect, it } from "vitest";
import {
  computeOnboardingSteps,
  isOnboardingComplete,
  onboardingCompletionPercent,
  type OnboardingSourceData,
} from "@/domain/onboarding/steps";

function buildData(overrides: Partial<OnboardingSourceData> = {}): OnboardingSourceData {
  return {
    documents: [],
    reminders: [],
    assets: [],
    contacts: [],
    capsules: [],
    ...overrides,
  };
}

describe("computeOnboardingSteps", () => {
  it("marks account/security always done, document/category/friend as the mandatory ones", () => {
    const steps = computeOnboardingSteps(buildData());
    const mandatory = steps.filter((s) => !s.optional).map((s) => s.key);
    expect(mandatory).toEqual(["account", "security", "document", "category", "friend"]);
  });

  it("marks 'friend' done only when at least one contact has isFriend", () => {
    const withoutFriend = computeOnboardingSteps(
      buildData({
        contacts: [
          {
            id: "c1",
            name: "Maria",
            email: "maria@esempio.it",
            role: "Coniuge",
            status: "active",
            isFriend: false,
            createdAt: "2026-01-01",
          },
        ],
      }),
    );
    expect(withoutFriend.find((s) => s.key === "friend")?.done).toBe(false);

    const withFriend = computeOnboardingSteps(
      buildData({
        contacts: [
          {
            id: "c1",
            name: "Maria",
            email: "maria@esempio.it",
            role: "Coniuge",
            status: "active",
            isFriend: true,
            createdAt: "2026-01-01",
          },
        ],
      }),
    );
    expect(withFriend.find((s) => s.key === "friend")?.done).toBe(true);
  });
});

describe("isOnboardingComplete", () => {
  it("is false until every mandatory step is done, ignoring optional ones", () => {
    const steps = computeOnboardingSteps(buildData());
    expect(isOnboardingComplete(steps)).toBe(false);
  });

  it("is true once document/category/friend are all done, regardless of optional steps", () => {
    const steps = computeOnboardingSteps(
      buildData({
        documents: [
          {
            id: "d1",
            filename: "polizza.pdf",
            mimeType: "application/pdf",
            size: 100,
            categoryId: "cat-1",
            relatedAssetId: null,
            createdAt: "2026-01-01",
            storagePath: "",
            wrappedDocumentKey: "",
            expiresAt: null,
            notes: "",
            tags: [],
            transcript: "",
          },
        ],
        contacts: [
          {
            id: "c1",
            name: "Maria",
            email: "maria@esempio.it",
            role: "Coniuge",
            status: "active",
            isFriend: true,
            createdAt: "2026-01-01",
          },
        ],
      }),
    );
    expect(isOnboardingComplete(steps)).toBe(true);
  });
});

describe("onboardingCompletionPercent", () => {
  it("rounds the ratio of done mandatory steps", () => {
    // account + security già fatti su 5 obbligatori --- 2/5 = 40%.
    const steps = computeOnboardingSteps(buildData());
    expect(onboardingCompletionPercent(steps)).toBe(40);
  });

  it("is 100 once every mandatory step is done", () => {
    const steps = computeOnboardingSteps(
      buildData({
        documents: [
          {
            id: "d1",
            filename: "polizza.pdf",
            mimeType: "application/pdf",
            size: 100,
            categoryId: "cat-1",
            relatedAssetId: null,
            createdAt: "2026-01-01",
            storagePath: "",
            wrappedDocumentKey: "",
            expiresAt: null,
            notes: "",
            tags: [],
            transcript: "",
          },
        ],
        contacts: [
          {
            id: "c1",
            name: "Maria",
            email: "maria@esempio.it",
            role: "Coniuge",
            status: "active",
            isFriend: true,
            createdAt: "2026-01-01",
          },
        ],
      }),
    );
    expect(onboardingCompletionPercent(steps)).toBe(100);
  });
});
