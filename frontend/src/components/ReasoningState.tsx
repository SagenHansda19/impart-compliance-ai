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
    <div className="w-full max-w-6xl mx-auto rounded-2xl border dark:border-slate-800/80 border-slate-200/80 dark:bg-slate-900/40 bg-white/70 backdrop-blur-md shadow-2xl transition-all duration-300 overflow-hidden">
      {/* Header Button: ChatGPT/Claude o1 Style Collapsible Thinking Indicator */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full cursor-pointer px-5 py-3.5 flex items-center justify-between text-left hover:dark:bg-slate-800/30 hover:bg-slate-100/50 transition-colors select-none"
        aria-expanded={isOpen}
      >
        <div className="flex items-center gap-3">
          <div className="relative flex size-7 items-center justify-center rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 dark:text-emerald-400">
            {busy ? (
              <SparklesIcon className="size-4 animate-spin" />
            ) : (
              <SparklesIcon className="size-4 text-emerald-400" />
            )}
          </div>

          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold dark:text-slate-200 text-slate-800 tracking-tight">
                {busy ? "Thinking Process" : "Thought Process"}
              </span>
              <span className="font-mono text-[11px] dark:text-slate-400 text-slate-500">
                ({displayTime}s)
              </span>
              {busy && (
                <span className="flex size-1.5 relative">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex size-1.5 rounded-full bg-emerald-500"></span>
                </span>
              )}
            </div>
            <p className="text-[11px] dark:text-slate-400 text-slate-500 mt-0.5 line-clamp-1">
              {busy
                ? STEPS[currentStep]
                : "Multi-jurisdiction pgvector retrieval and cross-border conflict evaluation completed"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs font-mono dark:text-slate-400 text-slate-500">
          <span>{isOpen ? "Hide" : "Show"}</span>
          <span className={`text-[10px] transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}>
            ▼
          </span>
        </div>
      </button>

      {/* Expanded Reasoning Trace Steps */}
      {isOpen && (
        <div className="px-5 pb-4 pt-1 border-t dark:border-slate-800/60 border-slate-200/80 animate-in fade-in duration-200">
          <div className="space-y-2 mt-2">
            {STEPS.map((step, idx) => {
              const isDone = !busy || idx < currentStep;
              const isCurrent = busy && idx === currentStep;

              return (
                <div
                  key={step}
                  className={`flex items-center gap-3 text-[12px] font-mono transition-opacity duration-300 ${
                    isDone
                      ? "dark:text-slate-300 text-slate-700"
                      : isCurrent
                      ? "dark:text-emerald-300 text-emerald-700 font-semibold"
                      : "dark:text-slate-600 text-slate-400 opacity-60"
                  }`}
                >
                  <div className="size-4 flex items-center justify-center shrink-0">
                    {isDone && <span className="text-emerald-500 dark:text-emerald-400 text-xs">✓</span>}
                    {isCurrent && (
                      <span className="size-2 rounded-full bg-emerald-400 animate-ping" />
                    )}
                    {!isDone && !isCurrent && (
                      <span className="size-1.5 rounded-full bg-slate-700" />
                    )}
                  </div>
                  <span>{step}</span>
                </div>
              );
            })}
          </div>

          <div className="mt-3.5 pt-2.5 border-t dark:border-slate-800/40 border-slate-200/60 flex items-center justify-between text-[10px] font-mono dark:text-slate-500 text-slate-400">
            <span>Retrieval model: BAAI/bge-base-en-v1.5</span>
            <span>Index: PostgreSQL 16 HNSW (ef=40)</span>
          </div>
        </div>
      )}
    </div>
  );
}
