import { describe, expect, it } from "vitest";
import {
  computeBasicOnboardingSteps,
  computeOnboardingSteps,
  isOnboardingComplete,
  onboardingCompletionPercent,
  type OnboardingSourceData,
} from "@/domain/onboarding/steps";

function buildData(overrides: Partial<OnboardingSourceData> = {}): OnboardingSourceData {
  return {
    documents: [],
    assets: [],
    friends: [],
    capsules: [],
    ...overrides,
  };
}

describe("computeOnboardingSteps", () => {
  it("lists 8 steps, none of them optional --- concrete steps before the ones that introduce a new concept (guardian/Dead Man's Switch)", () => {
    const steps = computeOnboardingSteps(buildData());
    expect(steps.map((s) => s.key)).toEqual([
      "account",
      "security",
      "document",
      "category",
      "asset",
      "capsule",
      "guardian",
      "capsule-friend",
    ]);
    expect(steps.every((s) => !("optional" in s))).toBe(true);
  });

  it("marks 'guardian' done only when at least one friend has isGuardian", () => {
    const withoutGuardian = computeOnboardingSteps(
      buildData({
        friends: [
          {
            id: "c1",
            name: "Maria",
            email: "maria@esempio.it", firstName: "", lastName: "", avatarPath: null, avatarUrl: null,
            role: "Coniuge",
            status: "active",
            isFriend: false,
            isGuardian: false,
            linkedUserId: null,
            createdAt: "2026-01-01",
          },
        ],
      }),
    );
    expect(withoutGuardian.find((s) => s.key === "guardian")?.done).toBe(false);

    const withGuardian = computeOnboardingSteps(
      buildData({
        friends: [
          {
            id: "c1",
            name: "Maria",
            email: "maria@esempio.it", firstName: "", lastName: "", avatarPath: null, avatarUrl: null,
            role: "Coniuge",
            status: "active",
            isFriend: false,
            isGuardian: true,
            linkedUserId: null,
            createdAt: "2026-01-01",
          },
        ],
      }),
    );
    expect(withGuardian.find((s) => s.key === "guardian")?.done).toBe(true);
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
            extractedText: "",
            extractedAt: null,
          },
        ],
        friends: [
          {
            id: "c1",
            name: "Maria",
            email: "maria@esempio.it", firstName: "", lastName: "", avatarPath: null, avatarUrl: null,
            role: "Coniuge",
            status: "active",
            isFriend: false,
            isGuardian: true,
            linkedUserId: null,
            createdAt: "2026-01-01",
          },
        ],
        assets: [{ id: "a1", name: "Barca", categoryId: null, createdAt: "2026-01-01" }],
        capsules: [
          {
            id: "cap1",
            title: "Per Maria",
            content: "",
            contentStyle: "simple",
            attachments: [],
            linkedDocuments: [],
            relatedFriends: [
              {
                id: "c1",
                name: "Maria",
                email: "maria@esempio.it", firstName: "", lastName: "", avatarPath: null, avatarUrl: null,
                role: "Coniuge",
                status: "active",
                isFriend: false,
                isGuardian: true,
                linkedUserId: null,
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

describe("computeBasicOnboardingSteps", () => {
  it("lists just account + security, showable before the Master Key is unlocked", () => {
    const steps = computeBasicOnboardingSteps(false);
    expect(steps.map((s) => s.key)).toEqual(["account", "security"]);
    expect(steps.find((s) => s.key === "account")?.done).toBe(true);
    expect(steps.find((s) => s.key === "security")?.done).toBe(false);
    expect(onboardingCompletionPercent(steps)).toBe(50);
  });

  it("marks 'security' done once encryption is configured (even if currently locked)", () => {
    const steps = computeBasicOnboardingSteps(true);
    expect(steps.find((s) => s.key === "security")?.done).toBe(true);
    expect(onboardingCompletionPercent(steps)).toBe(100);
  });

  it("matches the label/description/href of the same two steps in the full checklist", () => {
    const full = computeOnboardingSteps(buildData());
    const basic = computeBasicOnboardingSteps(true);
    expect(basic[0]).toEqual(full[0]);
    expect(basic[1]).toEqual(full[1]);
  });
});
