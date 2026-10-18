import { describe, it, vi } from "vitest";

// Nel browser queste cose leggono PDF e disegnano su canvas; qui la semina fornisce da sé il testo letto e le miniature
// (v. support/thumb-registry.ts), e importare i motori veri in Node fallirebbe.
vi.mock("@/lib/thumbnail", async () => {
  const registry = await import("./support/thumb-registry");
  return {
    canHaveThumbnail: (mime: string) => mime === "application/pdf" || mime.startsWith("image/"),
    createThumbnail: async () => registry.takeThumbnail(),
  };
});
vi.mock("@/domain/extraction/extract-text", () => ({ canExtractText: () => false, extractContent: async () => null }));
// La notifica via email è una server action di Next: fuori dal server non esiste, e comunque non va spedita.
vi.mock("@/lib/capsules/actions", () => ({ notifyCapsuleShared: async () => {} }));

import { createAsset } from "@/domain/assets/repository";
import { createCategory, listCategories } from "@/domain/categories/repository";
import { closeCapsule, createCapsule, listCapsules, shareCapsule } from "@/domain/capsules/repository";
import { DEFAULT_OPEN_EFFECT } from "@/domain/capsules/open-effects";
import { DIGITAL_LEGACY_PRESET_VALUES } from "@/domain/digital-legacy/types";
import { updateDigitalLegacySettings } from "@/domain/digital-legacy/repository";
import {
  addDossierPerson,
  addDossierStep,
  addExpectedItem,
  createDossier,
  setDossierPhases,
  setDossierStatus,
  setDossierStepDone,
  setDossierSummary,
  listDossierItems,
  listExpectedItems,
  setExpectedItemDone,
} from "@/domain/dossiers/repository";
import { saveEmergencyCard } from "@/domain/emergency-card/repository";
import {
  createFriend,
  setFriendLinkedUser,
  setFriendStatus,
} from "@/domain/friends/repository";
import {
  acceptGuardianRoleRequest,
  listIncomingGuardianRoleRequests,
  requestGuardianRole,
} from "@/domain/friends/guardian-requests";
import { createReminder, setReminderCompleted } from "@/domain/reminders/repository";
import {
  createTextNote,
  encryptStructuredFields,
  moveDocumentsToTrash,
  saveAISynthesis,
  updateDocumentAIExtractionExclusion,
  uploadDocument,
} from "@/domain/documents/repository";
import { saveStory, saveVoiceStory } from "@/domain/stories/repository";
import { STORY_THEMES } from "@/domain/stories/questions";
import {
  adminClient,
  createDemoSession,
  DEMO_A,
  DEMO_B,
  DEMO_MASTER_PASSWORD,
  DEMO_PASSWORD,
  type Session,
} from "./support/accounts";
import { DOCUMENTS, type DocSpec } from "./support/documents-data";
import { at, ago, day } from "./support/dates";
import {
  ASSETS,
  CAPSULES,
  CAPSULES_FROM_B,
  CUSTOM_CATEGORIES,
  DOSSIERS,
  FRIENDS,
  REMINDERS,
  STORY_ANSWERS,
} from "./support/life-data";
import { buildPdf, pageThumbnail, pictureJpeg, toneWav } from "./support/media";
import { setNextThumbnail } from "./support/thumb-registry";

const log = (message: string) => process.stdout.write(`${message}\n`);

function fileOf(buffer: Buffer, name: string, type: string): File {
  return new File([new Uint8Array(buffer)], name, { type });
}

async function step<T>(name: string, fn: () => Promise<T>): Promise<T> {
  const started = Date.now();
  try {
    const result = await fn();
    log(`  ok  ${name} (${((Date.now() - started) / 1000).toFixed(1)} s)`);
    return result;
  } catch (error) {
    log(`  ERRORE in "${name}": ${error instanceof Error ? error.message : String(error)}`);
    throw error;
  }
}

/** Cambia la data di creazione (Archivio, fascicoli, capsule…): un profilo "vissuto" non nasce tutto oggi. Solo il server può farlo. */
async function backdate(table: "documents" | "dossiers" | "capsules" | "friends" | "assets", id: string, daysAgo: number) {
  const { error } = await adminClient().from(table).update({ created_at: ago(daysAgo) }).eq("id", id);
  if (error) throw new Error(`created_at ${table}: ${error.message}`);
}

describe("profilo demo", () => {
  it("semina Marta Conti (demo A) e Paolo Conti (demo B)", async () => {
    log("\nAccount");
    const a = await step("Marta Conti: account e cassaforte", () => createDemoSession(DEMO_A));
    const b = await step("Paolo Conti: account e cassaforte", () => createDemoSession(DEMO_B));
    const admin = adminClient();

    // Il benvenuto alla cassaforte non serve a chi l'ha già creata.
    for (const s of [a, b]) {
      await admin.from("profiles").update({ master_key_intro_seen: true, birth_date: s === a ? "1968-03-05" : "1966-11-20" }).eq("id", s.userId);
    }

    log("\nCategorie e beni");
    const categoryIds = new Map<string, string>();
    for (const c of await listCategories(a.supabase)) categoryIds.set(c.name, c.id);
    await step("categorie personalizzate", async () => {
      for (const c of CUSTOM_CATEGORIES) categoryIds.set(c.name, await createCategory(a.supabase, a.userId, c));
    });
    const cat = (name: string | null) => (name ? (categoryIds.get(name) ?? null) : null);

    const assetIds = new Map<string, string>();
    await step("beni", async () => {
      for (const asset of ASSETS) {
        const id = await createAsset(a.supabase, a.masterKey, a.userId, {
          name: asset.name,
          categoryId: cat(asset.category),
          legacyNote: asset.legacyNote,
        });
        assetIds.set(asset.key, id);
        await backdate("assets", id, 200);
      }
    });

    log("\nPersone");
    const friendIds = new Map<string, string>();
    await step("rubrica di Marta", async () => {
      for (const f of FRIENDS) {
        const { id } = await createFriend(a.supabase, a.masterKey, a.userId, {
          name: f.name, email: f.email, firstName: f.firstName, lastName: f.lastName, role: f.role,
        });
        friendIds.set(f.key, id);
        // Chi ha un account Hinthial diventa guardiano per davvero (richiesta e accettazione, v. sotto): il solo segno sulla
        // rubrica non basta, "Chi proteggi" di Paolo legge le richieste accettate.
        await admin.from("friends").update({ is_friend: !!f.friend, is_guardian: !!f.guardian && !f.linkedToB }).eq("id", id);
        if (f.revoked) await setFriendStatus(a.supabase, id, "revoked");
        if (f.linkedToB) await setFriendLinkedUser(a.supabase, id, b.userId);
        await backdate("friends", id, f.addedAgo);
      }
    });
    // Paolo ha l'account: nella sua rubrica c'è Marta, collegata al suo.
    const martaInB = await step("rubrica di Paolo", async () => {
      const { id } = await createFriend(b.supabase, b.masterKey, b.userId, {
        name: "Marta Conti", email: DEMO_A.email, firstName: "Marta", lastName: "Conti", role: "Moglie",
      });
      await admin.from("friends").update({ is_friend: true, is_guardian: false }).eq("id", id);
      await setFriendLinkedUser(b.supabase, id, a.userId);
      return id;
    });

    log("\nGuardiani");
    await step("Paolo diventa guardiano di Marta; Paolo chiede a Marta di essere il suo", async () => {
      // Marta chiede, Paolo accetta: ora Paolo la protegge ("Chi proteggi") e lei lo vede come guardiano.
      await requestGuardianRole(a.supabase, a.userId, friendIds.get("paolo") as string, b.userId);
      const incoming = await listIncomingGuardianRoleRequests(b.supabase, b.userId);
      await acceptGuardianRoleRequest(b.supabase, incoming[0].id);
      // Paolo chiede a sua volta, e Marta non ha ancora risposto: la sua pagina "Protetti" ha una richiesta in attesa.
      await requestGuardianRole(b.supabase, b.userId, martaInB, a.userId);
    });

    log("\nFascicoli");
    const dossierIds = new Map<string, string>();
    await step("fascicoli (struttura)", async () => {
      for (const d of DOSSIERS) {
        const id = await createDossier(a.supabase, a.masterKey, a.userId, { title: d.title, description: d.description });
        dossierIds.set(d.key, id);
        if (d.phases) await setDossierPhases(a.supabase, a.masterKey, id, d.phases);
        for (const e of d.expected ?? []) await addExpectedItem(a.supabase, a.masterKey, a.userId, id, e.label);
        for (const s of d.steps ?? []) await addDossierStep(a.supabase, a.masterKey, a.userId, id, { text: s.text, dueOn: s.due === undefined ? null : day(s.due) });
        for (const p of d.people ?? []) await addDossierPerson(a.supabase, a.masterKey, a.userId, id, p);
        await backdate("dossiers", id, d.addedAgo);
      }
    });

    log("\nArchivio");
    const documentIds = new Map<string, string>();
    await step(`${DOCUMENTS.length} contenuti`, async () => {
      for (const spec of DOCUMENTS) {
        const id = await addDocument(a, spec, cat, assetIds, dossierIds);
        documentIds.set(spec.key, id);
        await backdate("documents", id, spec.addedAgo);
      }
    });
    await step("sintesi di Hinthia già salvate", async () => {
      for (const spec of DOCUMENTS.filter((d) => d.synthesis)) {
        await saveAISynthesis(a.supabase, a.masterKey, documentIds.get(spec.key) as string, spec.synthesis as string);
      }
    });

    await step("fascicoli: spunte, riassunti, chiusure", async () => {
      for (const d of DOSSIERS) {
        const id = dossierIds.get(d.key) as string;
        const expected = await listExpectedItems(a.supabase, a.masterKey, id);
        for (const e of d.expected ?? []) {
          if (e.done) await setExpectedItemDone(a.supabase, expected.find((x) => x.label === e.label)!.id, true);
        }
        const items = await listDossierItems(a.supabase, a.masterKey, id);
        for (const s of d.steps ?? []) {
          if (s.done) await setDossierStepDone(a.supabase, items.steps.find((x) => x.text === s.text)!.id, true);
        }
        if (d.summary) {
          const linked = DOCUMENTS.filter((doc) => doc.dossiers?.includes(d.key) && !doc.trashed);
          await setDossierSummary(a.supabase, a.masterKey, id, {
            text: d.summary,
            generatedAt: ago(Math.max(1, Math.min(d.addedAgo - 1, 20))),
            documentCount: linked.length,
            readableCount: linked.filter((doc) => doc.reading !== "unread").length,
          });
        }
        if (d.closed) await setDossierStatus(a.supabase, id, "closed");
      }
    });

    log("\nScadenze");
    await step(`${REMINDERS.length} scadenze`, async () => {
      for (const r of REMINDERS) {
        const id = await createReminder(a.supabase, a.masterKey, a.userId, {
          title: r.title,
          dueAt: day(r.due),
          relatedDocumentId: r.doc ? (documentIds.get(r.doc) ?? null) : null,
          relatedAssetId: r.asset ? (assetIds.get(r.asset) ?? null) : null,
        });
        if (r.done) await setReminderCompleted(a.supabase, id, true);
      }
    });

    log("\nCapsule");
    await step("capsule di Marta", async () => {
      for (const c of CAPSULES) {
        const files = c.audio ? [fileOf(toneWav(5, [392, 494, 587]), "per-elena.wav", "audio/wav")] : [];
        await createCapsule(a.supabase, a.masterKey, a.userId, {
          title: c.title,
          content: c.content,
          contentStyle: c.contentStyle,
          openEffect: c.effect ?? DEFAULT_OPEN_EFFECT,
          relatedFriendIds: c.friends.map((k) => friendIds.get(k) as string),
          files,
          linkedDocumentIds: (c.docs ?? []).map((k) => documentIds.get(k) as string),
          openAt: at(c.open),
          openOnLegacy: !!c.legacy,
        });
      }
      let list = await listCapsules(a.supabase, a.masterKey);
      for (const c of CAPSULES.filter((x) => x.state !== "draft")) {
        const item = list.find((x) => x.title === c.title)!;
        await closeCapsule(a.supabase, a.masterKey, a.userId, item);
        if (c.state === "shared") {
          list = await listCapsules(a.supabase, a.masterKey);
          await shareCapsule(a.supabase, a.masterKey, a.userId, list.find((x) => x.title === c.title)!);
        }
      }
      list = await listCapsules(a.supabase, a.masterKey);
      for (const c of CAPSULES) await backdate("capsules", list.find((x) => x.title === c.title)!.id, c.addedAgo);
    });
    await step("capsule di Paolo per Marta (\"Condivise con me\")", async () => {
      for (const c of CAPSULES_FROM_B) {
        await createCapsule(b.supabase, b.masterKey, b.userId, {
          title: c.title, content: c.content, contentStyle: "handwritten", openEffect: "light",
          relatedFriendIds: [martaInB], files: [], linkedDocumentIds: [], openAt: at(c.open), openOnLegacy: false,
        });
      }
      let list = await listCapsules(b.supabase, b.masterKey);
      for (const c of CAPSULES_FROM_B) {
        await closeCapsule(b.supabase, b.masterKey, b.userId, list.find((x) => x.title === c.title)!);
        list = await listCapsules(b.supabase, b.masterKey);
        await shareCapsule(b.supabase, b.masterKey, b.userId, list.find((x) => x.title === c.title)!);
      }
    });

    log("\nRaccontami");
    await step(`${STORY_ANSWERS.length} racconti scritti e uno a voce`, async () => {
      for (const [i, s] of STORY_ANSWERS.entries()) {
        const id = await saveStory(a.supabase, a.masterKey, a.userId, {
          question: STORY_THEMES[s.theme].questions[s.index],
          answer: s.answer,
        });
        await backdate("documents", id, 150 - i * 11);
      }
      const voiceId = await saveVoiceStory(a.supabase, a.masterKey, a.userId, {
        question: STORY_THEMES[0].questions[3],
        recording: fileOf(toneWav(6, [330, 392, 440]), "racconto.wav", "audio/wav"),
      });
      await backdate("documents", voiceId, 20);
    });

    log("\nEredità digitale");
    await step("impostazioni, scheda d'emergenza", async () => {
      await updateDigitalLegacySettings(a.supabase, a.userId, {
        enabled: true,
        preset: "balanced",
        ...DIGITAL_LEGACY_PRESET_VALUES.balanced,
      });
      await saveEmergencyCard(a.supabase, a.masterKey, a.userId, {
        bloodType: "A+",
        allergies: "Penicillina",
        conditions: "Lieve ipertensione",
        medications: "Un antipertensivo al mattino (5 mg)",
        doctorName: "Dott. Marco Galli",
        doctorPhone: "051 555 0142",
        contacts: [
          { name: "Paolo Conti", relation: "Marito", phone: "333 555 0101" },
          { name: "Elena Ferri", relation: "Sorella", phone: "333 555 0188" },
        ],
      });
    });

    log("\nFatto.");
    log(`  Marta Conti (A):  ${DEMO_A.email}`);
    log(`  Paolo Conti (B):  ${DEMO_B.email}`);
    log(`  Password di accesso: ${DEMO_PASSWORD}`);
    log(`  Master password:     ${DEMO_MASTER_PASSWORD}`);
  });
});

/** Carica un contenuto (PDF, immagine, nota, audio) con tutti i suoi dati, come farebbe l'app. */
async function addDocument(
  s: Session,
  spec: DocSpec,
  cat: (name: string | null) => string | null,
  assetIds: Map<string, string>,
  dossierIds: Map<string, string>,
): Promise<string> {
  const metadata = {
    categoryId: cat(spec.category),
    relatedAssetId: spec.asset ? (assetIds.get(spec.asset) ?? null) : null,
    dossierIds: (spec.dossiers ?? []).map((k) => dossierIds.get(k) as string),
    expiresAt: spec.expires === undefined ? null : day(spec.expires),
    notes: spec.notes ?? "",
    issuer: spec.issuer ?? "",
  };

  let id: string;
  if (spec.kind === "note") {
    id = await createTextNote(s.supabase, s.masterKey, s.userId, { title: spec.title, body: spec.body ?? "" }, metadata);
  } else {
    let buffer: Buffer;
    let name: string;
    let type: string;
    let text: string | null = null;
    if (spec.kind === "pdf") {
      const when = spec.expires === undefined ? "" : day(spec.expires).split("-").reverse().join("/");
      const lines = (spec.lines ?? [spec.title]).map((l) => l.replace("{scad}", when));
      buffer = buildPdf(lines);
      name = `${spec.key}.pdf`;
      type = "application/pdf";
      text = spec.reading === "unread" ? null : lines.join("\n");
      setNextThumbnail(await pageThumbnail(lines, spec.accent ?? "#1d7a4a"));
    } else if (spec.kind === "image") {
      buffer = await pictureJpeg(spec.picture?.caption ?? spec.title, spec.picture?.hue ?? ["#7aa", "#355"]);
      name = `${spec.key}.jpg`;
      type = "image/jpeg";
      setNextThumbnail(await pictureJpeg(spec.picture?.caption ?? spec.title, spec.picture?.hue ?? ["#7aa", "#355"], 600, 400));
    } else {
      buffer = toneWav(5, [349, 440, 523]);
      name = `${spec.key}.wav`;
      type = "audio/wav";
      setNextThumbnail(null);
    }
    const attempted = spec.reading !== "unread" && spec.kind !== "audio";
    id = await uploadDocument(s.supabase, s.masterKey, s.userId, fileOf(buffer, name, type), metadata, {
      title: spec.title,
      extraction: {
        text,
        attempted,
        segments: text ? [{ id: "p1", kind: "page", index: 1, text }] : [],
      },
    });
    setNextThumbnail(null);
  }

  if (spec.fields) {
    const encrypted = await encryptStructuredFields(s.masterKey, spec.fields);
    const { error } = await s.supabase.from("documents").update({ encrypted_structured_fields: encrypted }).eq("id", id);
    if (error) throw new Error(`campi della Scheda di "${spec.title}": ${error.message}`);
  }
  if (spec.excludeFromAI) await updateDocumentAIExtractionExclusion(s.supabase, id, true);
  if (spec.trashed) await moveDocumentsToTrash(s.supabase, s.userId, [id], 30);
  return id;
}
