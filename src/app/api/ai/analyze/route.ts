import { NextResponse, type NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/db/supabase/server";
import { logAuditEvent } from "@/lib/audit/log-event";
import { isCategoryEnabledForExtraction } from "@/domain/categories/ai-consent";

/**
 * FASE 22: unico punto di contatto tra Hinthial e Anthropic per l'analisi vera di un documento (non solo la Chat,
 * v. api/ai/chat/route.ts) --- la chiave API vive solo qui. I tre controlli di consenso sono verificati QUI sul
 * database, non fidandosi del client: cancello generale + funzione (ai_master_enabled/ai_extraction_consent),
 * categoria abilitata (permanente o temporanea, salvo scope "once"), esclusione del documento --- quest'ultima
 * vince sempre, anche su "once".
 */

const SYSTEM_PROMPT = `Sei il motore di lettura di Hinthial, un'app personale di gestione della vita digitale.
Leggi il testo di UN documento dell'utente e restituisci SOLO un oggetto JSON, senza testo attorno né blocchi markdown, con questa forma esatta:
{"expiry": [{"value": "YYYY-MM-DD", "source": "citazione verbatim dal testo"}], "issuer": [{"value": "nome di chi ha emesso il documento", "source": "citazione verbatim"}], "category": {"id": "uno degli id di categoria forniti", "source": "citazione verbatim"} | null}
Regole non negoziabili:
- Ogni "source" deve essere una citazione ESATTA, copiata parola per parola dal testo fornito --- non riassumere, non parafrasare. Se non trovi una citazione esatta per un campo, omettilo.
- "category.id" deve essere uno degli id nell'elenco categorie fornito, mai un id inventato o un nome.
- Nel dubbio, ometti il campo: un campo mancante costa meno di uno sbagliato.
- Se il documento non contiene nulla di utile, rispondi {"expiry": [], "issuer": [], "category": null}.`;

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

  const { documentId, text, categories, scope } = (body ?? {}) as {
    documentId?: unknown;
    text?: unknown;
    categories?: unknown;
    scope?: unknown;
  };

  if (typeof documentId !== "string" || !documentId) {
    return NextResponse.json({ error: "Documento mancante." }, { status: 400 });
  }
  if (typeof text !== "string" || !text.trim()) {
    return NextResponse.json({ error: "Testo del documento mancante." }, { status: 400 });
  }
  if (!Array.isArray(categories) || !categories.every(isCategoryOption)) {
    return NextResponse.json({ error: "Elenco categorie non valido." }, { status: 400 });
  }
  if (scope !== "category" && scope !== "temporary" && scope !== "once") {
    return NextResponse.json({ error: "Scope non valido." }, { status: 400 });
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
    return NextResponse.json({ error: "Questo documento è escluso dall'analisi AI." }, { status: 403 });
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
      return NextResponse.json({ error: "Questa categoria non è abilitata all'estrazione AI." }, { status: 403 });
    }
    categoryName = category.name;
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "L'analisi AI reale non è ancora configurata su questo server." },
      { status: 503 },
    );
  }

  try {
    const client = new Anthropic({ apiKey });
    const response = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: `Categorie disponibili (usa solo questi id):\n${categories
            .map((c) => `- ${c.id}: ${c.name}`)
            .join("\n")}\n\nTesto del documento:\n${text.slice(0, 200_000)}`,
        },
      ],
    });

    const textBlock = response.content.find((block) => block.type === "text");
    const raw = textBlock?.text ?? "{}";

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return NextResponse.json({ error: "Risposta di Claude non interpretabile." }, { status: 502 });
    }

    // Traccia che il contenuto è davvero uscito, con che permesso --- mai il testo o il nome del file.
    await logAuditEvent(supabase, user.id, "ai_extraction_used", {
      category: categoryName,
      scope: scope as "category" | "temporary" | "once",
    });

    return NextResponse.json({ result: parsed });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Errore sconosciuto.";
    return NextResponse.json({ error: `Impossibile contattare Claude: ${message}` }, { status: 502 });
  }
}
