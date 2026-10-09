import { NextResponse, type NextRequest } from "next/server";
import { authenticate, readJsonBody } from "@/lib/http/api-guards";
import { logAuditEvent } from "@/lib/audit/log-event";
import { isCategoryEnabledForExtraction } from "@/domain/categories/ai-consent";
import { parseSummaryRequest } from "@/domain/ai/dossier-summary";
import { summarizeDossierWithClaude } from "@/lib/ai/claude-dossier-summary";

/**
 * Il riassunto di un fascicolo: Hinthia riassume le sintesi che ha già scritto sui documenti, non rilegge i file. Come
 * per api/ai/analyze, i controlli di consenso sono QUI sul database, non fidandosi del client: cancello generale +
 * funzione (ai_master_enabled/ai_extraction_consent), e per ogni documento l'esclusione (vince sempre) e la categoria
 * abilitata (permanente o temporanea). Un documento che non passa resta fuori dal riassunto e viene contato come
 * saltato; "solo questa volta" non vale qui, perché il permesso riguarda un solo documento alla volta.
 */
export async function POST(request: NextRequest) {
  const auth = await authenticate();
  if (auth instanceof NextResponse) return auth;
  const { supabase, user } = auth;

  const parsedBody = await readJsonBody(request);
  if (parsedBody instanceof NextResponse) return parsedBody;
  const { body } = parsedBody;
  const parsed = parseSummaryRequest(body);
  if (!parsed) {
    return NextResponse.json({ error: "Richiesta non valida." }, { status: 400 });
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("ai_master_enabled, ai_extraction_consent")
    .eq("id", user.id)
    .single();
  if (profileError || !profile?.ai_master_enabled || !profile.ai_extraction_consent) {
    return NextResponse.json({ error: "Consenso all'estrazione avanzata non attivo." }, { status: 403 });
  }

  // Solo documenti dell'utente (le regole di accesso nascondono gli altri): un id altrui risulta semplicemente assente.
  const { data: rows, error: docsError } = await supabase
    .from("documents")
    .select("id, category_id, ai_extraction_excluded")
    .in("id", parsed.documents.map((d) => d.id));
  if (docsError) {
    return NextResponse.json({ error: "Impossibile controllare i documenti." }, { status: 500 });
  }

  const categoryIds = [...new Set((rows ?? []).map((r) => r.category_id).filter((id): id is string => id !== null))];
  const { data: categories } =
    categoryIds.length > 0
      ? await supabase.from("categories").select("id, name, ai_extraction_enabled, ai_extraction_enabled_until").in("id", categoryIds)
      : { data: [] };

  const allowed = new Map<string, string>(); // id documento → nome categoria
  for (const row of rows ?? []) {
    if (row.ai_extraction_excluded || !row.category_id) continue;
    const category = (categories ?? []).find((c) => c.id === row.category_id);
    if (
      category &&
      isCategoryEnabledForExtraction({
        aiExtractionEnabled: category.ai_extraction_enabled,
        aiExtractionEnabledUntil: category.ai_extraction_enabled_until,
      })
    ) {
      allowed.set(row.id, category.name);
    }
  }

  const documents = parsed.documents.filter((d) => allowed.has(d.id));
  const skipped = parsed.documents.length - documents.length;
  if (documents.length === 0) {
    return NextResponse.json(
      { error: "Nessun documento di questo fascicolo è abilitato alla lettura di Hinthia (categoria non abilitata o documento escluso)." },
      { status: 403 },
    );
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "Hinthia non è ancora configurata su questo server." }, { status: 503 });
  }

  try {
    const summary = await summarizeDossierWithClaude(apiKey, { title: parsed.title, documents });
    if (!summary) {
      return NextResponse.json({ error: "Hinthia non ha scritto nulla: riprova." }, { status: 502 });
    }

    // Traccia che il contenuto è davvero uscito, con che permesso --- mai il testo o il nome del file.
    await Promise.all(
      documents.map((d) =>
        logAuditEvent(supabase, user.id, "ai_extraction_used", { category: allowed.get(d.id) ?? null, scope: "category", reread: false }, {
          type: "document",
          id: d.id,
        }),
      ),
    );
    return NextResponse.json({ summary, used: documents.length, skipped });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Errore sconosciuto.";
    return NextResponse.json({ error: `Impossibile contattare Hinthia: ${message}` }, { status: 502 });
  }
}
