import { describe, expect, it } from "vitest";
import { buildTimeline, groupTimelineByMonth } from "@/lib/timeline";
import type { AIContext } from "@/domain/ai/types";

function buildContext(overrides: Partial<AIContext> = {}): AIContext {
  return {
    categories: [],
    assets: [],
    documents: [],
    reminders: [],
    contacts: [],
    capsules: [],
    ...overrides,
  };
}

describe("buildTimeline", () => {
  it("includes one entry per document/asset/reminder/contact/capsule", () => {
    const context = buildContext({
      assets: [{ id: "asset-1", name: "Auto", categoryId: null, createdAt: "2026-01-10" }],
      documents: [
        {
          id: "doc-1",
          filename: "polizza.pdf",
          mimeType: "application/pdf",
          size: 100,
          categoryId: null,
          relatedAssetId: null,
          createdAt: "2026-02-01",
          storagePath: "",
          wrappedDocumentKey: "",
          expiresAt: null,
          notes: "",
          tags: [],
          transcript: "",
        },
      ],
      reminders: [
        {
          id: "rem-1",
          title: "Rinnovo",
          dueAt: "2026-05-01",
          completed: false,
          relatedDocumentId: null,
          relatedDocumentFilename: null,
          relatedAssetId: null,
          relatedAssetName: null,
          createdAt: "2026-03-01",
        },
      ],
      contacts: [
        { id: "contact-1", name: "Maria", email: "m@x.it", role: "Coniuge", status: "active", isFriend: false, createdAt: "2026-04-01" },
      ],
      capsules: [
        {
          id: "capsule-1",
          title: "Per Maria",
          content: "",
          attachments: [],
          linkedDocuments: [],
          relatedContacts: [],
          status: "draft",
          accessCondition: "manual",
          openAt: null,
          createdAt: "2026-05-15",
        },
      ],
    });

    const timeline = buildTimeline(context);
    expect(timeline).toHaveLength(5);
    expect(timeline.map((e) => e.kind).sort()).toEqual(
      ["asset", "capsule", "contact", "document", "reminder"].sort(),
    );
  });

  it("sorts entries most recent first", () => {
    const context = buildContext({
      assets: [
        { id: "asset-old", name: "Vecchio", categoryId: null, createdAt: "2026-01-01" },
        { id: "asset-new", name: "Nuovo", categoryId: null, createdAt: "2026-06-01" },
      ],
    });

    const timeline = buildTimeline(context);
    expect(timeline.map((e) => e.id)).toEqual(["asset-new", "asset-old"]);
  });
});

describe("groupTimelineByMonth", () => {
  it("groups entries that fall in the same calendar month", () => {
    const context = buildContext({
      assets: [
        { id: "a1", name: "Uno", categoryId: null, createdAt: "2026-06-05" },
        { id: "a2", name: "Due", categoryId: null, createdAt: "2026-06-20" },
        { id: "a3", name: "Tre", categoryId: null, createdAt: "2026-05-15" },
      ],
    });

    const groups = groupTimelineByMonth(buildTimeline(context));
    expect(groups).toHaveLength(2);
    expect(groups[0].entries.map((e) => e.id)).toEqual(["a2", "a1"]);
    expect(groups[1].entries.map((e) => e.id)).toEqual(["a3"]);
  });

  it("capitalizes the localized month label", () => {
    const context = buildContext({
      assets: [{ id: "a1", name: "Uno", categoryId: null, createdAt: "2026-06-05" }],
    });
    const groups = groupTimelineByMonth(buildTimeline(context));
    expect(groups[0].label).toBe("Giugno 2026");
  });

  it("returns no groups for an empty timeline", () => {
    expect(groupTimelineByMonth([])).toEqual([]);
  });
});
