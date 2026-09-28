/**
 * Il kind "field" (campi eterogenei aperti) è l'unica parte del meccanismo di proposte che non può essere
 * verificata con un database finto: mergeStructuredField legge lo stato più recente dal database prima di
 * scrivere, apposta per non perdere un campo aggiunto nel frattempo --- una funzione pura non lo eserciterebbe
 * davvero. Verificato contro il database reale, come guardian-verification.integration.test.ts. Nessuna vera
 * chiamata a Claude qui: solo meccanica di lettura/scrittura Supabase, con un account usa e getta.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { generateSymmetricKey } from "@/lib/crypto/symmetric-key";
import { decryptStructuredFields } from "@/domain/documents/repository";
import {
  acceptProposal,
  listProposalRejections,
  rejectProposal,
  undoAcceptance,
} from "@/domain/proposals/repository";
import type { DocumentListItem } from "@/domain/documents/types";
import type { Proposal } from "@/domain/proposals/types";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const canRun = Boolean(SUPABASE_URL && ANON_KEY && SERVICE_ROLE_KEY);

const noSession = { auth: { autoRefreshToken: false, persistSession: false } };

describe.runIf(canRun)("proposte di campo generico (kind \"field\") contro il database reale", () => {
  let admin: SupabaseClient;
  let userClient: SupabaseClient;
  let userId = "";
  let masterKey: CryptoKey;
  let documentId = "";

  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const testUser = { email: `hinthial-fields-${suffix}@example.com`, password: "Structured-Fields-Test-1" };

  beforeAll(async () => {
    admin = createClient(SUPABASE_URL!, SERVICE_ROLE_KEY!, noSession);

    const created = await admin.auth.admin.createUser({
      email: testUser.email,
      password: testUser.password,
      email_confirm: true,
      user_metadata: { first_name: "Test", last_name: "Fields" },
    });
    if (created.error || !created.data.user) {
      throw new Error(`Impossibile creare l'utente di test: ${created.error?.message}`);
    }
    userId = created.data.user.id;

    userClient = createClient(SUPABASE_URL!, ANON_KEY!, noSession);
    const signIn = await userClient.auth.signInWithPassword(testUser);
    if (signIn.error) throw new Error(`Login fallito: ${signIn.error.message}`);

    masterKey = await generateSymmetricKey();

    // Riga minima --- non serve un envelope reale per encrypted_filename/wrapped_document_key: questo test non li
    // decifra mai, esercita solo encrypted_structured_fields e proposal_rejections.
    documentId = crypto.randomUUID();
    const { error: insertError } = await admin.from("documents").insert({
      id: documentId,
      owner_id: userId,
      encrypted_filename: "unused",
      wrapped_document_key: "unused",
      storage_path: `test/${documentId}.json`,
      mime_type: "application/pdf",
      size: 100,
    });
    if (insertError) throw new Error(`Impossibile creare il documento di test: ${insertError.message}`);
  }, 30_000);

  afterAll(async () => {
    if (userId) await admin.auth.admin.deleteUser(userId);
  });

  function docRef(): DocumentListItem {
    // Per il kind "field", acceptProposal/undoAcceptance usano solo l'id: mergeStructuredField legge lo stato
    // vero dal database, non questo oggetto --- stesso principio già usato altrove (v. build.test.ts, `as Category`).
    return { id: documentId } as DocumentListItem;
  }

  it("accetta un campo, lo scrive nel blob cifrato, e registra la chiave nel vocabolario", async () => {
    const proposal: Proposal = {
      kind: "field",
      value: "IT-4471-2027",
      source: "Numero polizza: IT-4471-2027",
      fieldKey: "numero_polizza",
      fieldLabel: "Numero polizza",
    };

    const accepted = await acceptProposal(userClient, masterKey, userId, docRef(), proposal, proposal.value);
    expect(accepted).toEqual({ kind: "field", fieldKey: "numero_polizza", previousValue: null });

    const { data } = await userClient
      .from("documents")
      .select("encrypted_structured_fields")
      .eq("id", documentId)
      .single();
    const fields = await decryptStructuredFields(masterKey, data!.encrypted_structured_fields);
    expect(fields).toEqual({ numero_polizza: "IT-4471-2027" });

    const { data: vocab } = await userClient
      .from("structured_field_vocabulary")
      .select("field_key, label")
      .eq("owner_id", userId);
    expect(vocab).toEqual([{ field_key: "numero_polizza", label: "Numero polizza" }]);
  });

  it("annullare un campo non perde un altro campo accettato nel frattempo --- il punto di leggere fresco dal database", async () => {
    const franchigia: Proposal = {
      kind: "field",
      value: "300,00",
      source: "Franchigia: 300,00 €",
      fieldKey: "franchigia",
      fieldLabel: "Franchigia",
    };
    await acceptProposal(userClient, masterKey, userId, docRef(), franchigia, franchigia.value);

    // "accepted" qui simula una closure di "Annulla" rimasta indietro rispetto all'accettazione di "franchigia".
    const staleAccepted = { kind: "field" as const, fieldKey: "numero_polizza", previousValue: null };
    await undoAcceptance(userClient, masterKey, userId, documentId, staleAccepted);

    const { data } = await userClient
      .from("documents")
      .select("encrypted_structured_fields")
      .eq("id", documentId)
      .single();
    const fields = await decryptStructuredFields(masterKey, data!.encrypted_structured_fields);
    expect(fields).toEqual({ franchigia: "300,00" });
  });

  it("rifiuta un campo generico e lo ritrova con la sua chiave, decifrato", async () => {
    const proposal: Proposal = {
      kind: "field",
      value: "AB123CD",
      source: "Targa: AB123CD",
      fieldKey: "targa",
      fieldLabel: "Targa",
    };

    const rejectionId = await rejectProposal(userClient, masterKey, userId, documentId, proposal);
    const rejections = await listProposalRejections(userClient, masterKey, documentId);

    expect(rejections).toContainEqual({ id: rejectionId, kind: "field", fieldKey: "targa", value: "AB123CD" });
  });

  it("rifiutare una proposta di emittente non fallisce più contro il vincolo del database (bug preesistente, corretto in questa stessa migrazione)", async () => {
    const proposal: Proposal = {
      kind: "issuer",
      value: "GENERALI ITALIA S.p.A.",
      source: "GENERALI ITALIA S.p.A.",
    };

    await expect(rejectProposal(userClient, masterKey, userId, documentId, proposal)).resolves.toBeTypeOf("string");
  });
});
