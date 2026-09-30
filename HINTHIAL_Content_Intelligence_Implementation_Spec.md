# HINTHIAL --- Content Intelligence & Deep Content Extraction

## Implementation Specification for Claude

> Repository: `giancarlomennatraining-creator/Hinthial-v2.0`
>
> Target branch: create a dedicated feature branch such as
> `feature/content-intelligence`
>
> Goal: transform content acquisition from "store/extract text" into a
> governed **Content Intelligence Pipeline** that deeply understands
> every acquired content item, extracts structured knowledge, preserves
> provenance, and persists the results into the appropriate HINTHIAL
> storage layers.

------------------------------------------------------------------------

# 1. Executive objective

The strategic objective is simple:

``` text
1. USER ACQUIRES CONTENT
        ↓
2. HINTHIAL DEEPLY ANALYZES THE CONTENT
        ↓
3. HINTHIAL EXTRACTS STRUCTURED KNOWLEDGE
        ↓
4. HINTHIAL VALIDATES + PRESERVES PROVENANCE
        ↓
5. HINTHIAL PERSISTS THE RESULT
```

The user should not have to manually tell HINTHIAL what to extract after
every upload.

The user's settings, permissions, delegations, AI consents and privacy
rules remain authoritative. Once those rules authorize automatic
analysis, acquisition should trigger the content intelligence pipeline
automatically.

This is not a request to add a generic "summarize with AI" button.

This is a request to introduce a **Content Intelligence subsystem** that
becomes a core capability of HINTHIAL.

------------------------------------------------------------------------

# 2. Existing repository context

Before implementing anything, inspect the current repository carefully
and preserve its existing architectural principles.

The current project already contains important foundations:

-   `src/domain/extraction/`
    -   current `TextExtractor`
    -   PDF/image extraction
    -   local OCR
-   `src/domain/transcription/`
    -   `TranscriptionProvider`
    -   currently intentionally conservative because browser Web Speech
        would send audio externally
-   `src/domain/categorizer/`
    -   content categorization/provider abstraction
-   `src/domain/structured-fields/`
    -   normalized structured fields
-   `src/domain/ai/`
    -   current Hinthia document analysis
    -   currently focused on expiry, issuer, category, generic fields
        and synthesis
-   `src/domain/proposals/`
    -   proposal/rejection workflow
-   document repository/types and encrypted content handling
-   AI consent/delegation concepts
-   client-side/local extraction philosophy
-   tests for extraction, proposals, AI analysis and document behavior

The existing AI analysis implementation already has an important
anti-hallucination rule:

> AI-extracted fields are accepted as candidates only when their
> `source` quote can be verified against the extracted text.

Preserve and generalize this principle.

Do not replace the existing security/privacy model with a simpler
cloud-first architecture.

------------------------------------------------------------------------

# 3. Core product principle

The central new abstraction is:

## `ContentIntelligence`

It must work across:

-   PDF
-   scanned PDF
-   images
-   DOCX
-   XLSX
-   PPTX
-   plain text
-   future office/document formats
-   audio
-   video

The application should not have separate product concepts such as:

-   Document Intelligence
-   Audio Intelligence
-   Video Intelligence

Instead, all of these are adapters into a common **Unified Content
Model**.

``` text
                         CONTENT
                            │
        ┌───────────────────┼───────────────────┐
        │                   │                   │
      PDF/OFFICE          IMAGE              AUDIO/VIDEO
        │                   │                   │
        └───────────────────┼───────────────────┘
                            ▼
                    CONTENT NORMALIZATION
                            │
                            ▼
                   CONTENT INTELLIGENCE
                            │
                            ▼
                  STRUCTURED KNOWLEDGE
```

------------------------------------------------------------------------

# 4. Non-negotiable architectural rule

Do NOT make the application depend directly on a specific AI vendor.

The semantic extraction layer must use a provider abstraction.

Conceptually:

``` ts
interface ContentIntelligenceProvider {
  readonly name: string;

  analyze(input: ContentIntelligenceInput): Promise<ContentIntelligenceResult>;
}
```

Possible implementations:

-   Anthropic / Claude
-   OpenAI
-   Google Gemini
-   Azure-hosted model
-   local model
-   future provider

The rest of HINTHIAL must consume the normalized result, not
vendor-specific response structures.

The current Anthropic integration can become the first implementation.

------------------------------------------------------------------------

# 5. New canonical model: `ExtractedContent`

The current `TextExtractor` returns essentially a `string | null`.

That is no longer sufficient.

Introduce a richer canonical representation while preserving
compatibility where practical.

Suggested shape:

``` ts
export interface ExtractedContent {
  text: string | null;
  language: string | null;
  languages: string[];

  segments: ContentSegment[];

  technicalMetadata: TechnicalContentMetadata;

  provenance: ProvenanceReference[];

  extraction: ExtractionMetadata;
}
```

Do not blindly copy this interface. Adapt naming and placement to the
existing repository conventions.

The important requirement is that extracted content is no longer "just
text".

------------------------------------------------------------------------

# 6. `ContentSegment`

Every extracted portion should be addressable.

Suggested conceptual model:

``` ts
type ContentSegment =
  | {
      id: string;
      kind: "page";
      index: number;
      text: string;
      provenance: ProvenanceReference;
    }
  | {
      id: string;
      kind: "section";
      title?: string;
      text: string;
      provenance: ProvenanceReference;
    }
  | {
      id: string;
      kind: "audio";
      startMs: number;
      endMs: number;
      speaker?: string;
      text: string;
      provenance: ProvenanceReference;
    }
  | {
      id: string;
      kind: "video";
      startMs: number;
      endMs: number;
      text?: string;
      visualDescription?: string;
      provenance: ProvenanceReference;
    };
```

The exact implementation can differ.

The essential requirement is:

> every meaningful piece of extracted information must be traceable back
> to its original location.

For documents this may be:

-   page
-   paragraph
-   block
-   table/cell

For audio/video:

-   timestamp
-   speaker where available
-   frame/scene where relevant

------------------------------------------------------------------------

# 7. Provenance is mandatory

Every extracted attribute, entity, event or relationship that claims to
be grounded in the source must have provenance.

Example:

``` json
{
  "field": "expiration_date",
  "value": "2027-12-31",
  "provenance": {
    "contentId": "abc",
    "page": 17,
    "quote": "Il presente contratto scadrà il 31 dicembre 2027."
  },
  "confidence": 0.96
}
```

For audio:

``` json
{
  "field": "decision",
  "value": "Posticipare il progetto",
  "provenance": {
    "contentId": "meeting-123",
    "startMs": 1842200,
    "endMs": 1856700,
    "speaker": "speaker_03"
  }
}
```

Do not accept an AI-generated factual attribute without a source
reference whenever a source reference is technically possible.

------------------------------------------------------------------------

# 8. Content Intelligence result

Introduce a canonical result similar to:

``` ts
interface ContentIntelligenceResult {
  classification: ContentClassification;

  metadata: ContentSemanticMetadata;

  entities: ExtractedEntity[];

  attributes: ExtractedAttribute[];

  events: ExtractedEvent[];

  relationships: ExtractedRelationship[];

  topics: ExtractedTopic[];

  obligations?: ExtractedObligation[];

  risks?: ExtractedRisk[];

  claims?: ExtractedClaim[];

  summary?: string | null;

  sensitivity: SensitivityClassification;

  provenance: ProvenanceReference[];

  confidence: ConfidenceSummary;

  processing: ProcessingMetadata;
}
```

Do not implement every optional concept as a huge first-release database
model if that conflicts with the existing architecture.

The first implementation must establish the canonical contract and
persistence boundaries.

------------------------------------------------------------------------

# 9. Classification

The first semantic operation should answer:

> What is this content?

Examples:

``` text
legal.contract
legal.invoice
legal.letter
technical.manual
technical.specification
technical.certificate
medical.report
medical.prescription
administrative.application
financial.statement
meeting.transcript
email
image
unknown
```

The taxonomy must remain extensible.

Do not hard-code a finite list that requires code changes for every new
document type.

Use the existing category system where appropriate, but distinguish:

-   application/user category
-   semantic document type
-   AI classification

These are related but not necessarily identical.

------------------------------------------------------------------------

# 10. Dynamic schema registry

HINTHIAL must support configurable extraction schemas.

Examples:

### `legal.contract.v1`

``` text
contract_number
parties
effective_date
expiration_date
value
currency
jurisdiction
renewal_clause
termination_clause
obligations
```

### `technical.manual.v1`

``` text
manufacturer
product
model
serial_number
firmware
revision
operating_temperature
power
certifications
warnings
maintenance_interval
```

### `medical.report.v1`

``` text
facility
physician
report_date
exam_type
findings
measurements
diagnoses
medications
recommendations
```

Do not create one giant universal schema.

The system should:

``` text
content
  ↓
classification
  ↓
schema resolution
  ↓
schema-specific extraction
```

Unknown types should be supported.

A future enhancement may allow:

``` text
UNKNOWN
  ↓
AI suggests likely type
  ↓
AI suggests schema
  ↓
user/admin approves
  ↓
new schema becomes available
```

------------------------------------------------------------------------

# 11. Attributes

An attribute is not merely a key/value pair.

It should carry:

-   key
-   label
-   value
-   type
-   source/provenance
-   confidence
-   extraction method
-   status

Conceptually:

``` ts
interface ExtractedAttribute {
  key: string;
  label: string;
  value: unknown;
  valueType: AttributeValueType;

  provenance: ProvenanceReference[];

  confidence?: number;

  status:
    | "discovered"
    | "proposed"
    | "accepted"
    | "rejected";
}
```

The existing `structuredFields` and proposal system should be
reused/evolved rather than duplicated.

------------------------------------------------------------------------

# 12. Entities

Introduce normalized entities.

Examples:

``` text
Person
Organization
Location
Product
Equipment
Document
Account
Vehicle
Medication
Diagnosis
```

Conceptually:

``` ts
interface ExtractedEntity {
  id: string;
  type: string;
  name: string;

  aliases?: string[];

  attributes?: Record<string, unknown>;

  provenance: ProvenanceReference[];

  confidence?: number;
}
```

Do not introduce a graph database just for this first implementation.

Persist entities in the simplest storage compatible with the current
project, but design the model so relationships can later support a
knowledge graph.

------------------------------------------------------------------------

# 13. Relationships

The system should be able to express relationships such as:

``` text
Company A --signed--> Contract 123
Contract 123 --concerns--> Product X
Contract 123 --expires--> 2027-12-31
Person A --works_for--> Company A
Document B --references--> Document A
```

Conceptually:

``` ts
interface ExtractedRelationship {
  subjectId: string;
  predicate: string;
  objectId: string;

  provenance: ProvenanceReference[];

  confidence?: number;
}
```

Again, first-release persistence may remain relational.

------------------------------------------------------------------------

# 14. Events

Extract important events where relevant.

Examples:

``` text
contract_signed
contract_renewed
payment_due
maintenance_performed
medical_exam
meeting_decision
deadline
```

Conceptually:

``` ts
interface ExtractedEvent {
  type: string;
  date?: string;
  start?: string;
  end?: string;

  participants?: string[];

  attributes?: Record<string, unknown>;

  provenance: ProvenanceReference[];

  confidence?: number;
}
```

------------------------------------------------------------------------

# 15. Deep analysis must be multi-stage

Do NOT implement the entire feature as one prompt saying "analyze this
document".

Use a pipeline:

``` text
1. technical inspection
        ↓
2. content extraction
        ↓
3. classification
        ↓
4. schema resolution
        ↓
5. entity extraction
        ↓
6. attribute extraction
        ↓
7. events / relationships / topics
        ↓
8. sensitivity classification
        ↓
9. validation
        ↓
10. persistence
```

Some stages can be combined in one AI call for performance, but the
domain model must preserve these conceptual boundaries.

------------------------------------------------------------------------

# 16. Technical inspection

For every content item collect, when available:

``` text
mimeType
filename
extension
size
hash
pageCount
duration
language
creation metadata
author metadata
source/provider
```

Do not confuse technical metadata with semantic metadata.

------------------------------------------------------------------------

# 17. PDF and document processing

For PDF and scans:

-   retain page boundaries
-   retain OCR information where available
-   preserve text ordering
-   preserve tables where practical
-   preserve headings/sections
-   preserve page provenance
-   avoid the current hard truncation becoming the semantic-analysis
    ceiling

The current `MAX_EXTRACTED_CHARS = 200_000` behavior was designed around
searchable text. Do not blindly feed the entire extracted text to an LLM
for large documents.

Introduce chunking/segmentation.

A 500-page document should be analyzed without requiring one enormous
prompt.

------------------------------------------------------------------------

# 18. Office documents

Add adapters for common Office formats where technically feasible:

``` text
DOCX
XLSX
PPTX
```

The normalized result should still be `ExtractedContent`.

Examples:

-   DOCX → paragraphs, headings, tables
-   XLSX → sheets, tables, cells/ranges
-   PPTX → slides, text, notes, images

Do not make the semantic layer care about the original format.

------------------------------------------------------------------------

# 19. Audio

Replace the current transcription stub with a provider abstraction that
can eventually support:

-   local transcription
-   cloud transcription
-   provider-specific transcription

The result must preserve:

``` text
transcript
timestamps
speaker
segments
language
```

Conceptually:

``` text
AUDIO
 ↓
transcription
 ↓
timestamped segments
 ↓
semantic analysis
```

The Web Speech API must not be reintroduced as an implicit privacy
violation.

------------------------------------------------------------------------

# 20. Video

Treat video as a multimodal content container:

``` text
VIDEO
 ├── audio
 │    └── transcript
 ├── scenes
 ├── frames
 ├── OCR
 └── visual observations
```

At minimum, design the model now so timestamps can exist.

Full video understanding can be implemented incrementally.

------------------------------------------------------------------------

# 21. Privacy and delegation model

This is critical.

HINTHIAL's current privacy philosophy must remain intact.

There must be no implicit cloud upload.

The pipeline must check the user's current settings/delegations before
sending content to an external AI provider.

Conceptually:

``` text
CONTENT
   ↓
USER DELEGATIONS / SETTINGS
   ↓
Can this operation be performed?
   │
   ├── NO → stop / local-only path
   │
   └── YES
         ↓
      provider
```

Different permissions may apply to:

-   local extraction
-   cloud AI analysis
-   transcription
-   medical/sensitive content
-   automatic acceptance
-   storage/indexing
-   embeddings

Do not bypass existing consent gates.

------------------------------------------------------------------------

# 22. Sensitive/health data

Medical content must be treated as sensitive content.

The system must be able to classify:

``` text
personal_data
special_category_data
health_data
financial_data
legal_data
```

The AI pipeline should expose this classification before or during
external processing where possible.

Do not send sensitive content to a provider merely because the generic
AI consent is enabled if a more specific health/sensitive-content
delegation is required by the current product rules.

Reuse and extend existing consent infrastructure rather than creating a
second permission system.

------------------------------------------------------------------------

# 23. AI provider abstraction

The current Anthropic integration should be adapted into the generic
provider model.

Conceptually:

``` ts
interface ContentIntelligenceProvider {
  readonly name: string;

  analyze(
    input: ContentIntelligenceInput,
    schema: ContentExtractionSchema,
  ): Promise<ContentIntelligenceResult>;
}
```

The provider adapter is responsible for:

-   prompt/model invocation
-   structured output parsing
-   provider-specific retries
-   provider-specific limits

The domain layer is responsible for:

-   validation
-   provenance checks
-   permission enforcement
-   persistence
-   proposal handling

Do not leak Anthropic/OpenAI/Gemini response objects into domain models.

------------------------------------------------------------------------

# 24. Structured output

The AI provider must return machine-readable structured output.

Do not rely on free-form prose parsing.

Prefer JSON schema / structured outputs whenever the selected provider
supports them.

All returned fields must be validated at runtime.

Invalid output must become:

``` text
failed validation
```

not silently accepted data.

------------------------------------------------------------------------

# 25. Anti-hallucination validation

Generalize the existing `quoteAppearsIn()` strategy.

For source-grounded values:

``` text
AI value
+
AI source
       ↓
source validation
       ↓
accepted/rejected
```

For values that are inherently derived rather than directly quoted,
explicitly mark them as:

``` text
derived
```

Example:

``` text
summary = derived
```

whereas:

``` text
contract_number = source-grounded
```

Never pretend that a generated summary is a literal source citation.

------------------------------------------------------------------------

# 26. Confidence

Confidence must not be treated as absolute truth.

Use it as an operational signal.

For example:

``` text
high confidence
medium confidence
low confidence
```

or numeric confidence where the provider can justify it.

Do not implement a global "0.95 means automatically correct" policy.

Different fields have different risk profiles.

------------------------------------------------------------------------

# 27. Proposal model

Reuse the existing proposal/rejection model.

The pipeline should not silently overwrite user-entered information.

The desired lifecycle is:

``` text
AI DISCOVERS
      ↓
candidate
      ↓
validation
      ↓
proposal
      ↓
user accepts / edits / rejects
      ↓
persisted structured data
```

If an existing field is already populated, do not overwrite it
automatically.

The current behavior in `buildAIProposals()` should be preserved
conceptually.

------------------------------------------------------------------------

# 28. Persistence

Persist the following categories separately according to the current
repository architecture:

### Original content

The encrypted/original content mechanism already present in HINTHIAL.

### Extracted content

Current `extractedText` should remain available for compatibility, but
the new normalized extraction model should additionally preserve
segments/provenance.

### Semantic metadata

Document type, language, classification, sensitivity.

### Structured knowledge

Attributes, entities, events, relationships.

### Summary

Keep distinct from source-grounded fields.

### Provenance

Keep sufficient references to locate the original evidence.

### Processing metadata

Record:

``` text
provider
model
version
startedAt
completedAt
status
error
```

Never store sensitive prompt content in ordinary logs.

------------------------------------------------------------------------

# 29. Idempotency

Reprocessing the same content must not create duplicate semantic
records.

Use the existing content/document identity plus a processing
fingerprint/version.

Conceptually:

``` text
content hash
+
schema version
+
pipeline version
+
model/provider
```

determines whether an analysis result is reusable.

If the model changes, the same content may be reprocessed.

------------------------------------------------------------------------

# 30. Processing status

Introduce a clear processing lifecycle.

Suggested:

``` text
pending
extracting
classifying
analyzing
validating
persisting
completed
partial
failed
cancelled
```

The UI should be able to show meaningful progress.

Do not make a document appear "fully processed" if only OCR succeeded.

------------------------------------------------------------------------

# 31. Error handling

The pipeline must support partial success.

Example:

``` text
OCR:                 success
classification:     success
attributes:          success
entity extraction:   success
audio transcription: failed
video analysis:      skipped
```

The document should not be corrupted.

Store the successful results and mark the incomplete stages
appropriately.

Retries must be stage-aware.

------------------------------------------------------------------------

# 32. UI behavior

The existing document detail page should evolve rather than be replaced.

After acquisition:

``` text
Acquired
   ↓
Analyzing...
   ↓
Analyzed
```

Show at minimum:

-   content type
-   extracted metadata
-   detected entities
-   structured attributes
-   summary
-   source/provenance
-   analysis status
-   AI/provider indicator when applicable
-   user proposals requiring review

Do not expose raw internal AI JSON as the primary UX.

------------------------------------------------------------------------

# 33. Search implications

Do not implement a vector database as a prerequisite for the first MVP.

First make the canonical semantic model correct.

The architecture should later support:

``` text
keyword search
+
structured filters
+
semantic/vector search
```

Example:

> "Find contracts expiring next year that mention penalties for delayed
> delivery."

This requires both structured metadata and semantic retrieval.

------------------------------------------------------------------------

# 34. Storage evolution

Do not introduce a large number of new infrastructure components
immediately.

Prefer the simplest storage compatible with the current application.

First implementation can use the existing Supabase/Postgres
architecture.

Potential future layers:

``` text
Postgres
pgvector
OpenSearch
Knowledge Graph
```

Only introduce each when there is a concrete requirement.

------------------------------------------------------------------------

# 35. Suggested domain modules

Adapt to the existing structure, but aim for something conceptually
close to:

``` text
src/domain/content-intelligence/
  types.ts
  provider.ts
  pipeline.ts
  classifier.ts
  schema-registry.ts
  validator.ts
  provenance.ts
  persistence.ts
  sensitivity.ts

src/domain/content/
  types.ts
  segments.ts
  normalization.ts

src/domain/extraction/
  ...
  document-extractor.ts
  office-extractor.ts

src/domain/transcription/
  ...
  provider.ts

src/domain/ai/
  ...
  content-intelligence-provider.ts
  anthropic-content-intelligence-provider.ts
```

Do not duplicate an existing abstraction merely because this
specification uses a different directory name. Reuse the repository's
established conventions.

------------------------------------------------------------------------

# 36. API design

Introduce a server-side endpoint/service that triggers content
intelligence.

Conceptually:

``` http
POST /api/content-intelligence/analyze
```

Input:

``` json
{
  "documentId": "...",
  "mode": "automatic"
}
```

The server must derive:

-   user identity
-   permissions
-   content
-   current delegations
-   applicable schema
-   provider configuration

Do not trust the browser to supply authorization decisions.

Possible status endpoint:

``` http
GET /api/content-intelligence/status/:documentId
```

or reuse an existing document/job status mechanism if one already
exists.

------------------------------------------------------------------------

# 37. Automatic trigger

The target UX is:

``` text
USER UPLOADS
     ↓
document created
     ↓
content extraction
     ↓
automatic content intelligence
     ↓
persist result
```

This should not require the user to press "Analyze" after every upload
if automatic analysis is authorized.

However, respect the existing application model if processing currently
occurs only after an explicit action. The settings/delegation system
must decide whether the trigger is automatic.

------------------------------------------------------------------------

# 38. Avoid synchronous long-running requests

Do not run large document/video analysis entirely inside the upload HTTP
request.

Use a background job abstraction appropriate to the existing
application.

At minimum, structure the pipeline so it can be invoked asynchronously.

The UI should poll/subscribe to processing status rather than waiting
for a huge request.

------------------------------------------------------------------------

# 39. Tests

This feature must be heavily tested.

Add unit tests for:

### Content normalization

-   PDF
-   empty extraction
-   oversized extraction
-   page segmentation
-   language

### Classification

-   known type
-   unknown type
-   invalid AI classification

### Schema extraction

-   valid structured output
-   malformed output
-   missing fields
-   wrong types

### Provenance

-   valid quote
-   invalid quote
-   missing provenance
-   timestamped audio provenance

### Proposals

-   existing fields are not overwritten
-   rejected proposals remain rejected
-   duplicate candidates are removed

### Privacy

-   unauthorized external analysis is blocked
-   sensitive/health data respects the dedicated delegation
-   local-only path does not invoke external provider

### Pipeline

-   successful end-to-end processing
-   partial failure
-   retry
-   idempotent reprocessing

------------------------------------------------------------------------

# 40. Acceptance criteria

The implementation is considered successful only if all of the following
are true.

## Acquisition

A user can acquire supported content using the existing HINTHIAL flow.

## Automatic analysis

If authorized by settings/delegations, the content is automatically
analyzed without a second manual "Analyze" action.

## Deep extraction

The system extracts substantially more than the current:

``` text
expiry
issuer
category
generic fields
synthesis
```

It must support, at minimum:

``` text
classification
metadata
entities
attributes
topics
events
summary
sensitivity
provenance
```

## Source traceability

Every source-grounded extracted fact can be traced back to the source
content.

## Existing data protection

Existing encryption and consent/delegation behavior remains intact.

## No accidental external transmission

No content is sent to an external provider without the appropriate
authorization.

## No destructive AI overwrite

Existing user-entered values are not silently overwritten.

## Persistence

The semantic result survives page refresh and can be retrieved with the
document.

## Provider independence

The domain layer does not depend on Anthropic-specific response
structures.

## Backward compatibility

Existing document acquisition, extraction, proposal and AI analysis
tests continue to work unless intentionally superseded by the new model.

------------------------------------------------------------------------

# 41. MVP scope

The first implementation should NOT attempt to solve everything at once.

### MVP-1

Implement:

``` text
PDF
image/scanned PDF
DOCX where feasible
existing text content
```

and:

``` text
classification
metadata
entities
attributes
summary
provenance
sensitivity
automatic persistence
```

Use the existing Anthropic integration as the first provider, behind a
provider abstraction.

### MVP-2

Add:

``` text
XLSX
PPTX
audio
timestamped transcription
```

### MVP-3

Add:

``` text
video
visual analysis
semantic search
embeddings
cross-document relationships
```

### Future

``` text
schema suggestion
knowledge graph
advanced RAG
automatic workflow generation
cross-document intelligence
```

------------------------------------------------------------------------

# 42. Important implementation philosophy

Do not over-engineer.

The immediate objective is not to build a perfect enterprise document AI
platform.

The immediate objective is:

> **make HINTHIAL genuinely intelligent at the moment content enters the
> system.**

The smallest useful end-to-end flow is:

``` text
UPLOAD
  ↓
EXTRACT
  ↓
CLASSIFY
  ↓
UNDERSTAND
  ↓
EXTRACT KNOWLEDGE
  ↓
VALIDATE
  ↓
PERSIST
```

Make that flow work extremely well before introducing vector databases,
graph databases or complex distributed infrastructure.

------------------------------------------------------------------------

# 43. Expected final architecture

The desired conceptual architecture is:

``` text
                         HINTHIAL
                            │
                    ┌───────┴───────┐
                    │   ACQUISITION │
                    └───────┬───────┘
                            │
                            ▼
                  ┌───────────────────┐
                  │ CONTENT EXTRACTION│
                  └─────────┬─────────┘
                            │
                            ▼
                  ┌───────────────────┐
                  │ UNIFIED CONTENT   │
                  │ MODEL              │
                  └─────────┬─────────┘
                            │
                            ▼
                  ┌───────────────────┐
                  │ CONTENT           │
                  │ INTELLIGENCE      │
                  ├───────────────────┤
                  │ Classification    │
                  │ Metadata          │
                  │ Entities          │
                  │ Attributes        │
                  │ Events             │
                  │ Relationships      │
                  │ Topics            │
                  │ Summary            │
                  │ Sensitivity       │
                  └─────────┬─────────┘
                            │
                            ▼
                  ┌───────────────────┐
                  │ VALIDATION +      │
                  │ PROVENANCE        │
                  └─────────┬─────────┘
                            │
             ┌──────────────┼──────────────┐
             ▼              ▼              ▼
        DOCUMENT         KNOWLEDGE       SEARCH
        STORAGE          STORAGE         INDEX
             │              │              │
             └──────────────┼──────────────┘
                            ▼
                     HINTHIAL USER
```

------------------------------------------------------------------------

# 44. Final instruction to Claude

You are implementing this specification directly in the existing
HINTHIAL repository.

Before changing code:

1.  Inspect the repository and understand the existing architecture.
2.  Identify the existing extraction, document, encryption, consent,
    proposal and AI flows.
3.  Reuse existing abstractions whenever possible.
4.  Do not create parallel implementations of functionality that already
    exists.
5.  Do not weaken the current privacy/zero-knowledge model.
6.  Do not hard-code Anthropic into the domain model.
7.  Do not silently overwrite user data.
8.  Do not treat AI output as truth without validation/provenance.
9.  Keep backward compatibility where practical.
10. Add tests before declaring the feature complete.

Then implement the feature incrementally.

At the end, provide:

-   files changed
-   database migrations
-   new environment variables/secrets
-   provider configuration
-   tests added
-   known limitations
-   manual verification steps
-   migration/rollback considerations

Do not stop at an architectural proposal. The goal of this document is
an **actual implementation in the repository**.

------------------------------------------------------------------------

# 45. Definition of success

The final user experience should feel like this:

> **"I put something into HINTHIAL, and HINTHIAL understands what it is,
> reads it, extracts what matters, connects the information to the right
> structures, preserves where every fact came from, and stores the
> resulting knowledge --- all according to the permissions and
> delegations I have granted."**

That is the feature being built.
