import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/db/supabase/server";
import { logAuditEvent } from "@/lib/audit/log-event";
import { isCategoryEnabledForExtraction } from "@/domain/categories/ai-consent";
import { createClaudeAnalysisProvider } from "@/lib/ai/claude-analysis-provider";
import { MAX_BLOCK_CHARS, MAX_BLOCKS_PER_DOCUMENT } from "@/domain/ai/analysis/blocks";
import { isAnalysisDocumentType } from "@/domain/ai/analysis/schemas";
import { AnalysisOutputError } from "@/domain/ai/analysis/types";

/**
 * FASE 22: unico punto di contatto tra Hinthial e Anthropic per l'analisi vera di un documento (non solo la Chat,
 * v. api/ai/chat/route.ts) --- la chiave API vive solo qui. I tre controlli di consenso sono verificati QUI sul
 * database, non fidandosi del client: cancello generale + funzione (ai_master_enabled/ai_extraction_consent),
 * categoria abilitata (permanente o temporanea, salvo scope "once"), esclusione del documento --- quest'ultima
 * vince sempre, anche su "once".
 */

interface CategoryOption {
  id: string;
  name: string;
}

function isCategoryOption(value: unknown): value is CategoryOption {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return typeof v.id === "string" && typeof v.name === "string";
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Devi essere autenticato." }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Richiesta non valida." }, { status: 400 });
  }

  const { documentId, mode, block, partials, documentType, categories, scope, reread } = (body ?? {}) as {
    documentId?: unknown;
    reread?: unknown;
    mode?: unknown;
    block?: unknown;
    partials?: unknown;
    documentType?: unknown;
    categories?: unknown;
    scope?: unknown;
  };

  if (typeof documentId !== "string" || !documentId) {
    return NextResponse.json({ error: "Documento mancante." }, { status: 400 });
  }
  if (scope !== "category" && scope !== "temporary" && scope !== "once") {
    return NextResponse.json({ error: "Scope non valido." }, { status: 400 });
  }
  if (mode !== "block" && mode !== "merge") {
    return NextResponse.json({ error: "Richiesta non valida." }, { status: 400 });
  }

  // Una richiesta = un pezzo di lavoro piccolo e limitato (un blocco, o le sintesi da fondere): il server non
  // accetta mai un documento intero, così nemmeno un client modificato può farne partire uno enorme.
  let blockInput: { id: string; segmentIds: string[]; text: string } | null = null;
  let partialSyntheses: string[] = [];
  if (mode === "block") {
    const b = (block ?? {}) as Record<string, unknown>;
    if (
      typeof b.id !== "string" ||
      typeof b.text !== "string" ||
      !b.text.trim() ||
      !Array.isArray(b.segmentIds) ||
      !b.segmentIds.every((id) => typeof id === "string")
    ) {
      return NextResponse.json({ error: "Testo del documento mancante." }, { status: 400 });
    }
    if (b.text.length > MAX_BLOCK_CHARS) {
      return NextResponse.json({ error: "Blocco troppo grande." }, { status: 400 });
    }
    blockInput = { id: b.id, segmentIds: b.segmentIds as string[], text: b.text };
    if (!Array.isArray(categories) || !categories.every(isCategoryOption)) {
      return NextResponse.json({ error: "Elenco categorie non valido." }, { status: 400 });
    }
  } else {
    if (
      !Array.isArray(partials) ||
      partials.length === 0 ||
      partials.length > MAX_BLOCKS_PER_DOCUMENT ||
      !partials.every((p) => typeof p === "string" && p.trim() && p.length <= 4_000)
    ) {
      return NextResponse.json({ error: "Richiesta non valida." }, { status: 400 });
    }
    partialSyntheses = partials as string[];
  }

  // Cancello: funzione (v. api/ai/chat/route.ts, stesso schema a due controlli).
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("ai_master_enabled, ai_extraction_consent")
    .eq("id", user.id)
    .single();
  if (profileError || !profile?.ai_master_enabled || !profile.ai_extraction_consent) {
    return NextResponse.json({ error: "Consenso all'estrazione avanzata non attivo." }, { status: 403 });
  }

  // Documento: l'esclusione vince sempre, anche su scope "once".
  const { data: doc, error: docError } = await supabase
    .from("documents")
    .select("category_id, ai_extraction_excluded")
    .eq("id", documentId)
    .single();
  if (docError || !doc) {
    return NextResponse.json({ error: "Documento non trovato." }, { status: 404 });
  }
  if (doc.ai_extraction_excluded) {
    return NextResponse.json({ error: "Questo documento è escluso dall'analisi di Hinthia." }, { status: 403 });
  }

  let categoryName: string | null = null;
  if (scope !== "once") {
    if (!doc.category_id) {
      return NextResponse.json(
        { error: "Un documento senza categoria può essere analizzato solo con 'solo questa volta'." },
        { status: 403 },
      );
    }
    const { data: category, error: categoryError } = await supabase
      .from("categories")
      .select("name, ai_extraction_enabled, ai_extraction_enabled_until")
      .eq("id", doc.category_id)
      .single();
    if (categoryError || !category) {
      return NextResponse.json({ error: "Categoria non trovata." }, { status: 404 });
    }
    if (
      !isCategoryEnabledForExtraction({
        aiExtractionEnabled: category.ai_extraction_enabled,
        aiExtractionEnabledUntil: category.ai_extraction_enabled_until,
      })
    ) {
      return NextResponse.json({ error: "Questa categoria non è abilitata all'estrazione con Hinthia." }, { status: 403 });
    }
    categoryName = category.name;
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "Hinthia non è ancora configurata su questo server." },
      { status: 503 },
    );
  }

  const provider = createClaudeAnalysisProvider(apiKey);
  const auditMetadata = { category: categoryName, scope: scope as "category" | "temporary" | "once", documentId, reread: reread === true };

  try {
    if (blockInput) {
      // Vocabolario noto dell'utente, come suggerimento --- governa la scrittura (accettare registra una chiave nuova,
      // v. domain/proposals/repository.ts), non il ragionamento: Claude può sempre proporne una diversa se serve.
      const { data: vocabularyRows } = await supabase
        .from("structured_field_vocabulary")
        .select("field_key, label")
        .order("label");

      const result = await provider.analyzeBlock({
        block: blockInput,
        categories: categories as CategoryOption[],
        vocabulary: vocabularyRows ?? [],
        documentType: isAnalysisDocumentType(documentType) ? documentType : null,
      });

      // Traccia che il contenuto è davvero uscito, con che permesso --- mai il testo o il nome del file.
      await logAuditEvent(supabase, user.id, "ai_extraction_used", auditMetadata);
      return NextResponse.json({ result });
    }

    const synthesis = await provider.mergeSyntheses(partialSyntheses);
    await logAuditEvent(supabase, user.id, "ai_extraction_used", auditMetadata);
    return NextResponse.json({ synthesis });
  } catch (err) {
    if (err instanceof AnalysisOutputError) {
      return NextResponse.json({ error: "Risposta di Hinthia non valida." }, { status: 502 });
    }
    const message = err instanceof Error ? err.message : "Errore sconosciuto.";
    return NextResponse.json({ error: `Impossibile contattare Hinthia: ${message}` }, { status: 502 });
  }
}
