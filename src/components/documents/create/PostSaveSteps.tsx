import Link from "next/link";
import { useAIProcessingConsent } from "@/components/ai/AIProcessingConsentProvider";
import { AIAnalysisTrigger } from "@/components/documents/AIAnalysisTrigger";
import {
  AccordionStep,
  SavedMoment,
  type StepState,
} from "@/components/documents/create/accordion";
import type { PostSave } from "@/components/documents/create/usePostSave";
import { formatDate } from "@/lib/format";
import { BTN_SECONDARY } from "@/components/ui/styles";
import type { DocumentListItem } from "@/domain/documents/types";

/** I passi di dopo il salvataggio: il momento "salvato", poi la lettura sul dispositivo (4) e l'analisi di Silva (5, facoltativa). */
export function PostSaveSteps({
  savedDoc,
  postSave,
  activeStep,
  setActiveStep,
  stepState,
}: {
  savedDoc: DocumentListItem;
  postSave: PostSave;
  activeStep: number;
  setActiveStep: (step: 1 | 2 | 3 | 4 | 5) => void;
  stepState: (step: number) => StepState;
}) {
  const { masterEnabled, extractionConsent } = useAIProcessingConsent();
  const { savedMoment, readingState, step4Summary, aiDone, aiBusy, aiProgress, savedAnalysis, categoryEnabledForAI } = postSave;

  return (
    <>
      <SavedMoment open={savedMoment} />
      <AccordionStep
        step={4}
        state={savedMoment ? "todo" : stepState(4)}
        title="Lettura dal dispositivo"
        summary={savedMoment ? undefined : step4Summary}
        separator="Da qui in poi lavora Hinthial."
        onOpen={() => setActiveStep(4)}
      >
        {readingState === "own-text" ? (
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            È già testo: non c&apos;è altro da leggere.
          </p>
        ) : readingState === "cannot" ? (
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Non so ancora leggere questo tipo di contenuto: lo
            trovi per nome e note.
          </p>
        ) : readingState === "nothing" ? (
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            L&apos;ho guardato, ma non ci ho trovato testo.
          </p>
        ) : readingState === "never" ? (
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Non l&apos;ho ancora letto.
          </p>
        ) : (
          <>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              {savedDoc.extractedText.length.toLocaleString(
                "it-IT",
              )}{" "}
              caratteri letti.
            </p>
            <Link
              href={`/archive/${savedDoc.id}`}
              className="w-fit text-sm font-medium text-accent underline-offset-2 hover:underline"
            >
              Vedi tutto sulla scheda →
            </Link>
          </>
        )}
        <button
          type="button"
          onClick={() => setActiveStep(5)}
          className={`${BTN_SECONDARY} w-full sm:w-fit`}
        >
          Continua →
        </button>
      </AccordionStep>

      <AccordionStep
        step={5}
        state={aiDone && activeStep !== 5 ? "done" : stepState(5)}
        last
        title="Analisi di Silva"
        summary={aiDone ? "Fatto" : "Opzionale"}
        onOpen={() => setActiveStep(5)}
      >
        <p className="flex items-center gap-2 text-sm text-zinc-500 dark:text-zinc-400">
          {/* eslint-disable-next-line @next/next/no-img-element -- copia ridotta dell'avatar HINTHIA, v. public/brand/README.md */}
          <img
            src="/brand/hinthia/hinthia-64.png"
            alt=""
            className="h-5 w-5 shrink-0 rounded-full"
          />
          Facoltativa: se vuoi, Silva legge il testo e prepara
          una sintesi.
        </p>
        {aiDone ? (
          <p className="text-sm text-emerald-600 dark:text-emerald-400">
            ✓ Fatto — trovi la sintesi e le proposte sulla scheda
            del documento.
          </p>
        ) : (
          <AIAnalysisTrigger
            masterEnabled={masterEnabled}
            extractionConsent={extractionConsent}
            hasCategory={savedDoc.categoryId !== null}
            categoryEnabled={categoryEnabledForAI}
            excluded={savedDoc.aiExtractionExcluded}
            busy={aiBusy}
            progress={aiProgress}
            savedState={savedAnalysis}
            analyzedAtLabel={savedDoc.analysisUpdatedAt ? formatDate(savedDoc.analysisUpdatedAt) : null}
            lastRunFailed={savedDoc.analysisStatus === "failed"}
            onAnalyze={postSave.handleAnalyzeWithClaude}
            onAbort={postSave.handleAbort}
            onToggleExcluded={postSave.handleToggleAIExclusion}
          />
        )}
      </AccordionStep>
    </>
  );
}
