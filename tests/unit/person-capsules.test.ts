import { describe, expect, it } from "vitest";
import {
  describeCapsulesForPerson,
  groupCapsulesForPerson,
  isReadyToOpen,
  sharedFromPerson,
} from "@/domain/friends/person-capsules";
import type { CapsuleListItem, SharedCapsuleListItem } from "@/domain/capsules/types";

const capsule = (id: string, status: CapsuleListItem["status"], openOnLegacy: boolean) =>
  ({ id, status, openOnLegacy }) as CapsuleListItem;
const shared = (id: string, ownerId: string, over: Partial<SharedCapsuleListItem> = {}) =>
  ({ id, ownerId, openAt: null, released: false, ...over }) as SharedCapsuleListItem;

describe("groupCapsulesForPerson", () => {
  it("divide le capsule tra quelle che arrivano alla consegna, quelle a data e le bozze", () => {
    const groups = groupCapsulesForPerson([
      capsule("a", "shared", true),
      capsule("b", "ready", true),
      capsule("c", "shared", false),
      capsule("d", "draft", false),
      capsule("e", "draft", true), // una bozza con la regola accesa non parte ancora: resta bozza
    ]);
    expect(groups.onDelivery.map((c) => c.id)).toEqual(["a", "b"]);
    expect(groups.onDate.map((c) => c.id)).toEqual(["c"]);
    expect(groups.drafts.map((c) => c.id)).toEqual(["d", "e"]);
  });
});

describe("describeCapsulesForPerson", () => {
  it("non dice nulla senza capsule", () => {
    expect(describeCapsulesForPerson(groupCapsulesForPerson([]))).toBe("");
  });

  it("riassume in una frase, al singolare e al plurale", () => {
    expect(describeCapsulesForPerson(groupCapsulesForPerson([capsule("a", "shared", true)]))).toBe(
      "1 capsula: 1 arriverà anche se non ci sei.",
    );
    expect(
      describeCapsulesForPerson(
        groupCapsulesForPerson([
          capsule("a", "shared", true),
          capsule("b", "ready", true),
          capsule("c", "shared", false),
          capsule("d", "draft", false),
          capsule("e", "draft", false),
        ]),
      ),
    ).toBe("5 capsule: 2 arriveranno anche se non ci sei, 1 si apre alla propria data, 2 sono ancora bozze.");
  });
});

describe("sharedFromPerson / isReadyToOpen", () => {
  const list = [shared("1", "luca"), shared("2", "marta"), shared("3", "luca")];

  it("tiene solo le capsule di quella persona, riconosciuta dal suo account", () => {
    expect(sharedFromPerson(list, "luca").map((s) => s.id)).toEqual(["1", "3"]);
    expect(sharedFromPerson(list, null)).toEqual([]);
    expect(sharedFromPerson(list, "nessuno")).toEqual([]);
  });

  it("si apre alla data, o prima se l'eredità del mittente ha consegnato", () => {
    const now = new Date("2026-10-14T12:00:00Z");
    expect(isReadyToOpen({ openAt: "2026-10-01T00:00:00Z", released: false }, now)).toBe(true);
    expect(isReadyToOpen({ openAt: "2038-01-01T00:00:00Z", released: false }, now)).toBe(false);
    expect(isReadyToOpen({ openAt: "2038-01-01T00:00:00Z", released: true }, now)).toBe(true);
    expect(isReadyToOpen({ openAt: null, released: false }, now)).toBe(false);
  });
});
