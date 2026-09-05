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
    assets: [],
    contacts: [],
    capsules: [],
    ...overrides,
  };
}

describe("computeOnboardingSteps", () => {
  it("lists 8 steps, none of them optional", () => {
    const steps = computeOnboardingSteps(buildData());
    expect(steps.map((s) => s.key)).toEqual([
      "account",
      "security",
      "document",
      "category",
      "friend",
      "asset",
      "capsule",
      "capsule-contact",
    ]);
    expect(steps.every((s) => !("optional" in s))).toBe(true);
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
  it("is false until every single step is done", () => {
    const steps = computeOnboardingSteps(buildData());
    expect(isOnboardingComplete(steps)).toBe(false);
  });

  it("is true once every step is done", () => {
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
        assets: [{ id: "a1", name: "Barca", categoryId: null, createdAt: "2026-01-01" }],
        capsules: [
          {
            id: "cap1",
            title: "Per Maria",
            content: "",
            attachments: [],
            linkedDocuments: [],
            relatedContacts: [
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
            status: "draft",
            accessCondition: "manual",
            openAt: "2027-01-01",
            createdAt: "2026-01-01",
          },
        ],
      }),
    );
    expect(isOnboardingComplete(steps)).toBe(true);
  });
});

describe("onboardingCompletionPercent", () => {
  it("rounds the ratio of done steps over every step (account + security done out of 8 -> 25%)", () => {
    const steps = computeOnboardingSteps(buildData());
    expect(onboardingCompletionPercent(steps)).toBe(25);
  });
});
