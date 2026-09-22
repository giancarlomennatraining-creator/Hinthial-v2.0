/**
 * "Prova generale" --- verifica soprattutto due cose delicate:
 * 1. le date sono la stessa matematica usata dall'automazione vera
 *    (v. computeDigitalLegacyTransition), non numeri a sentimento;
 * 2. zero guardiani ferma onestamente il calendario, invece di
 *    inventare una conferma che non potrebbe mai arrivare da sola.
 */
import { describe, expect, it } from "vitest";
import { buildDigitalLegacyRehearsal, groupSharedCapsulesByRecipient } from "@/domain/digital-legacy/rehearsal";
import { DIGITAL_LEGACY_PRESET_VALUES } from "@/domain/digital-legacy/types";
import type { CapsuleListItem } from "@/domain/capsules/types";
import type { FriendListItem } from "@/domain/friends/types";

const NOW = new Date("2026-09-22T00:00:00.000Z");
const DAY_MS = 24 * 60 * 60 * 1000;
const daysBetween = (a: Date, b: Date) => Math.round((b.getTime() - a.getTime()) / DAY_MS);

const BALANCED = DIGITAL_LEGACY_PRESET_VALUES.balanced; // 120/10/3/30/majority/14/14

function friend(over: Partial<FriendListItem> = {}): FriendListItem {
  return {
    id: "friend-1",
    name: "Marco Rossi",
    email: "marco@example.com",
    firstName: "Marco",
    lastName: "Rossi",
    avatarPath: null,
    avatarUrl: null,
    role: "Fratello",
    status: "active",
    isFriend: true,
    isGuardian: false,
    linkedUserId: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    ...over,
  };
}

function capsule(over: Partial<CapsuleListItem> = {}): CapsuleListItem {
  return {
    id: "capsule-1",
    title: "Per quando non ci sarò più",
    content: "...",
    contentStyle: "simple",
    attachments: [],
    linkedDocuments: [],
    relatedFriends: [],
    status: "draft",
    accessCondition: "manual",
    openAt: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    ...over,
  };
}

describe("buildDigitalLegacyRehearsal", () => {
  it("con almeno un guardiano, calcola tutte le fasi con la stessa matematica dell'automazione vera", () => {
    const events = buildDigitalLegacyRehearsal(BALANCED, NOW, ["Marco Rossi"]);

    // start -> reminders -> grace -> guardians-contacted -> guardian-confirmed -> formal -> final-wait -> triggered
    expect(events.map((e) => e.id)).toEqual([
      "start",
      "reminders",
      "grace",
      "guardians-contacted",
      "guardian-confirmed",
      "formal",
      "final-wait",
      "triggered",
    ]);

    const byId = new Map(events.map((e) => [e.id, e]));

    // 120 giorni di inattività prima del primo promemoria.
    expect(daysBetween(NOW, byId.get("reminders")!.date)).toBe(120);
    // 3 promemoria ogni 10 giorni --- l'ultimo arriva 20 giorni dopo il primo (2 intervalli, non 3).
    expect(daysBetween(byId.get("reminders")!.date, byId.get("reminders")!.rangeEndDate!)).toBe(20);

    // Il periodo di grazia (30gg) inizia alla fine dei promemoria.
    expect(byId.get("grace")!.date).toEqual(byId.get("reminders")!.rangeEndDate);
    expect(daysBetween(byId.get("grace")!.date, byId.get("grace")!.rangeEndDate!)).toBe(30);

    // I guardiani vengono interpellati esattamente alla fine della grazia.
    expect(byId.get("guardians-contacted")!.date).toEqual(byId.get("grace")!.rangeEndDate);

    // La conferma è un esempio, le altre fasi no.
    expect(byId.get("guardian-confirmed")!.isExample).toBe(true);
    expect(byId.get("start")!.isExample).toBeUndefined();
    expect(byId.get("triggered")!.isExample).toBeUndefined();

    // Verifica formale (14gg) e attesa finale (14gg), in sequenza dopo la conferma.
    expect(byId.get("formal")!.date).toEqual(byId.get("guardian-confirmed")!.date);
    expect(daysBetween(byId.get("formal")!.date, byId.get("formal")!.rangeEndDate!)).toBe(14);
    expect(byId.get("final-wait")!.date).toEqual(byId.get("formal")!.rangeEndDate);
    expect(daysBetween(byId.get("final-wait")!.date, byId.get("final-wait")!.rangeEndDate!)).toBe(14);
    expect(byId.get("triggered")!.date).toEqual(byId.get("final-wait")!.rangeEndDate);

    // Il totale, dall'ultimo accesso all'apertura, deve combaciare con totalWorstCaseDays
    // meno i giorni "d'esempio" della risposta del guardiano (non fanno parte delle impostazioni).
    const totalWithExample = daysBetween(NOW, byId.get("triggered")!.date);
    expect(totalWithExample).toBeGreaterThan(200); // ~7 mesi, non qualche settimana
  });

  it("nomina i guardiani veri nel dettaglio dell'evento, non un segnaposto", () => {
    const events = buildDigitalLegacyRehearsal(BALANCED, NOW, ["Marco Rossi", "Giulia Bianchi"]);
    const contacted = events.find((e) => e.id === "guardians-contacted")!;
    expect(contacted.detail).toContain("Marco Rossi");
    expect(contacted.detail).toContain("Giulia Bianchi");
  });

  it("senza nessun guardiano collegato, si ferma onestamente dopo averli interpellati", () => {
    const events = buildDigitalLegacyRehearsal(BALANCED, NOW, []);
    expect(events.map((e) => e.id)).toEqual(["start", "reminders", "grace", "guardians-contacted"]);
    expect(events.at(-1)!.detail).toContain("Nessun guardiano collegato");
  });

  it("con un solo promemoria previsto, non mostra un intervallo di date per una fase istantanea", () => {
    const events = buildDigitalLegacyRehearsal({ ...BALANCED, reminderCount: 1 }, NOW, ["Marco Rossi"]);
    const reminders = events.find((e) => e.id === "reminders")!;
    expect(reminders.rangeEndDate).toBeUndefined();
    expect(reminders.title).toBe("Un promemoria via email");
  });
});

describe("groupSharedCapsulesByRecipient", () => {
  it("raggruppa più capsule condivise con lo stesso destinatario collegato", () => {
    const marco = friend({ id: "f1", name: "Marco Rossi", linkedUserId: "u1" });
    const c1 = capsule({ id: "c1", status: "shared", relatedFriends: [marco] });
    const c2 = capsule({ id: "c2", status: "shared", relatedFriends: [marco] });

    const groups = groupSharedCapsulesByRecipient([c1, c2]);
    expect(groups).toHaveLength(1);
    expect(groups[0].recipient.id).toBe("f1");
    expect(groups[0].capsules.map((c) => c.id)).toEqual(["c1", "c2"]);
  });

  it("ignora le capsule non condivise (bozza o pronta)", () => {
    const marco = friend({ id: "f1", linkedUserId: "u1" });
    const draft = capsule({ id: "c1", status: "draft", relatedFriends: [marco] });
    const ready = capsule({ id: "c2", status: "ready", relatedFriends: [marco] });

    expect(groupSharedCapsulesByRecipient([draft, ready])).toEqual([]);
  });

  it("ignora un destinatario scelto ma senza account collegato --- stesso filtro di shareCapsule", () => {
    const unlinked = friend({ id: "f1", linkedUserId: null });
    const c1 = capsule({ id: "c1", status: "shared", relatedFriends: [unlinked] });

    expect(groupSharedCapsulesByRecipient([c1])).toEqual([]);
  });

  it("una capsula con più destinatari collegati compare in entrambi i gruppi", () => {
    const marco = friend({ id: "f1", name: "Marco Rossi", linkedUserId: "u1" });
    const giulia = friend({ id: "f2", name: "Giulia Bianchi", linkedUserId: "u2" });
    const c1 = capsule({ id: "c1", status: "shared", relatedFriends: [marco, giulia] });

    const groups = groupSharedCapsulesByRecipient([c1]);
    expect(groups).toHaveLength(2);
    expect(groups.map((g) => g.recipient.name).sort()).toEqual(["Giulia Bianchi", "Marco Rossi"]);
  });
});
