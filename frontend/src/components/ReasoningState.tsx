import { useState, useEffect } from "react";
import { SparklesIcon } from "./Icons";

const STEPS = [
  "Decomposing Change Request into atomic technical requirements...",
  "Running pgvector dense HNSW search across 8,500+ regulatory clauses...",
  "Evaluating cross-border conflict matrix across EMIR, UK EMIR, ASIC, MAS, HKMA...",
  "Synthesizing cross-border audit verdicts and citations...",
];

interface ReasoningStateProps {
  busy?: boolean;
  elapsedSeconds?: number;
  initiallyOpen?: boolean;
}

export function ReasoningState({
  busy = true,
  elapsedSeconds: externalElapsed,
  initiallyOpen = true,
}: ReasoningStateProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [internalElapsed, setInternalElapsed] = useState(0);
  const [isOpen, setIsOpen] = useState(initiallyOpen);

  useEffect(() => {
    if (!busy) return;
    const stepTimer = setInterval(() => {
      setCurrentStep((prev) => (prev < STEPS.length - 1 ? prev + 1 : prev));
    }, 850);

    const elapsedTimer = setInterval(() => {
      setInternalElapsed((prev) => +(prev + 0.1).toFixed(1));
    }, 100);

    return () => {
      clearInterval(stepTimer);
      clearInterval(elapsedTimer);
    };
  }, [busy]);

  const displayTime =
    externalElapsed !== undefined ? externalElapsed.toFixed(1) : internalElapsed.toFixed(1);

  return (
    <div className="w-full rounded-lg border dark:border-slate-800/90 border-slate-200/90 dark:bg-slate-950/70 bg-white/90 backdrop-blur-md shadow-xs transition-all duration-150 overflow-hidden">
      {/* Header Button: Linear / o1 Style Collapsible Thinking Indicator */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full cursor-pointer px-4 py-3 flex items-center justify-between text-left hover:dark:bg-slate-900/40 hover:bg-slate-100/60 transition-colors select-none focus:outline-none"
        aria-expanded={isOpen}
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="relative flex size-7 shrink-0 items-center justify-center rounded-md bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 dark:text-emerald-400 shadow-inner">
            {busy ? (
              <SparklesIcon className="size-3.5 animate-spin text-emerald-400" />
            ) : (
              <span className="text-emerald-400 font-bold text-xs">✓</span>
            )}
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-bold dark:text-white text-slate-900 tracking-tight font-mono">
                Reasoning & Vector Audit Trace
              </span>
              <span className="font-mono text-[11px] tabular-nums dark:text-slate-400 text-slate-500 rounded px-1.5 py-0.2 dark:bg-slate-900 bg-slate-100 border dark:border-slate-800 border-slate-200">
                {busy ? `${displayTime}s` : `Completed in ${displayTime}s`}
              </span>
              {busy ? (
                <span className="flex size-2 relative">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex size-2 rounded-full bg-emerald-500"></span>
                </span>
              ) : (
                <span className="text-[10px] font-mono text-emerald-500 dark:text-emerald-400 font-medium">
                  ✓ Verified
                </span>
              )}
            </div>
            <p className="text-[11px] dark:text-slate-400 text-slate-500 mt-0.5 truncate font-sans">
              {busy
                ? STEPS[currentStep]
                : "Multi-jurisdiction pgvector retrieval and cross-border conflict evaluation completed"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs font-mono dark:text-slate-400 text-slate-500 shrink-0 ml-3">
          <span className="hidden sm:inline text-[11px]">{isOpen ? "Hide trace" : "Show trace"}</span>
          <span className={`text-[10px] transition-transform duration-150 ${isOpen ? "rotate-180" : ""}`}>
            ▼
          </span>
        </div>
      </button>

      {/* Expanded Reasoning Trace Steps with Linear-style Step Badges */}
      {isOpen && (
        <div className="px-4 pb-3.5 pt-2 border-t dark:border-slate-800/80 border-slate-200/80 animate-in fade-in duration-150">
          <div className="space-y-1.5 mt-1">
            {STEPS.map((step, idx) => {
              const isDone = !busy || idx < currentStep;
              const isCurrent = busy && idx === currentStep;
              const stepNumber = String(idx + 1).padStart(2, "0");

              return (
                <div
                  key={step}
                  className={`flex items-center gap-2.5 text-[11px] font-mono transition-opacity duration-150 rounded px-2 py-1 ${
                    isDone
                      ? "dark:text-slate-300 text-slate-700 dark:bg-slate-900/30 bg-slate-50"
                      : isCurrent
                      ? "dark:text-emerald-300 text-emerald-700 font-semibold dark:bg-emerald-950/20 bg-emerald-50/50 border border-emerald-500/20"
                      : "dark:text-slate-600 text-slate-400 opacity-50"
                  }`}
                >
                  <span className={`text-[10px] tabular-nums font-bold px-1 rounded ${
                    isDone
                      ? "text-emerald-500 dark:text-emerald-400"
                      : isCurrent
                      ? "text-emerald-400 bg-emerald-500/20"
                      : "text-slate-600"
                  }`}>
                    {isDone ? "✓" : stepNumber}
                  </span>
                  <span className="leading-relaxed flex-1">{step}</span>
                  {isCurrent && (
                    <span className="size-1.5 rounded-full bg-emerald-400 animate-ping shrink-0" />
                  )}
                </div>
              );
            })}
          </div>

          <div className="mt-3 pt-2 border-t dark:border-slate-800/60 border-slate-200/60 flex flex-wrap items-center justify-between gap-2 text-[10px] font-mono tabular-nums dark:text-slate-500 text-slate-400">
            <span>Model: BAAI/bge-base-en-v1.5</span>
            <span>Index: PostgreSQL 16 HNSW (ef_search=40)</span>
            <span>Grounding: 4-Tier Guardrails Active</span>
          </div>
        </div>
      )}
    </div>
  );
}

