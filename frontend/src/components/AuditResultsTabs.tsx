import { useState } from "react";
import type { Assessment, Row } from "../types";
import { ExecutiveVerdictCard } from "./ExecutiveVerdictCard";
import { JurisdictionAccordion } from "./JurisdictionAccordion";
import { Heatmap } from "./Heatmap";
import {
  DiagramIcon,
  GlobeAltIcon,
  SparklesIcon,
  CpuChipIcon,
  CopyIcon,
} from "./Icons";

export type AuditTabId = "overview" | "jurisdictions" | "reasoning" | "complexity";

const REGIME_FLAGS: Record<string, string> = {
  EMIR: "🇪🇺",
  UKEMIR: "🇬🇧",
  ASIC: "🇦🇺",
  MAS: "🇸🇬",
  HKMA: "🇭🇰",
};

interface AuditResultsTabsProps {
  assessment: Assessment;
  filteredRows: Row[];
  onInspectDrawer: (row: Row) => void;
  onReassess?: () => void;
  busy: boolean;
}

export function AuditResultsTabs({
  assessment,
  filteredRows,
  onInspectDrawer,
  onReassess,
  busy,
}: AuditResultsTabsProps) {
  const [activeTab, setActiveTab] = useState<AuditTabId>("overview");
  const [copied, setCopied] = useState(false);
  const [showRawCot, setShowRawCot] = useState(false);

  const reqs = assessment.cr_metadata?.requirements ?? [];
  const rows = assessment.compliance_table ?? [];
  const cot = assessment.chain_of_thought_explanation ?? "";
  const spectrum = assessment.spectrum_of_complexity ?? [];

  const handleCopyReasoning = async () => {
    if (!cot) return;
    try {
      await navigator.clipboard.writeText(cot);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  };

  // Parse COT by regime lines if formatted like "EMIR: ... UKEMIR: ..."
  const cotSections = cot
    ? cot.split(/\n(?=[A-Z]{3,8}:)/).map((chunk) => {
        const m = chunk.match(/^([A-Z]{3,8}):\s*(?:\[([^\]]+)\])?\s*(.*)$/s);
        if (m) {
          return {
            regime: m[1],
            tag: m[2],
            content: m[3] || chunk,
          };
        }
        return { regime: null, tag: null, content: chunk };
      })
    : [];

  const tabs: {
    id: AuditTabId;
    label: string;
    icon: typeof DiagramIcon;
    badge?: string;
  }[] = [
    {
      id: "overview",
      label: "Executive Overview",
      icon: DiagramIcon,
    },
    {
      id: "jurisdictions",
      label: "Jurisdiction Matrix",
      icon: GlobeAltIcon,
      badge: `${filteredRows.length}`,
    },
    {
      id: "reasoning",
      label: "Reasoning Trace",
      icon: SparklesIcon,
      badge: "LLM",
    },
    {
      id: "complexity",
      label: "Complexity & Requirements",
      icon: CpuChipIcon,
      badge: reqs.length > 0 ? `${reqs.length} Reqs` : undefined,
    },
  ];

  return (
    <div className="space-y-5 w-full">
      {/* 1. TOP TAB NAVIGATION BAR (Sticky Full-Width Header) */}
      <div className="sticky top-0 z-40 w-full backdrop-blur-xl dark:bg-[#090d16]/95 bg-white/95 border-b dark:border-slate-800/90 border-slate-200/90 py-2 shadow-xs transition-colors">
        <nav
          role="tablist"
          aria-label="Audit Results Views"
          className="w-full"
        >
          <div className="w-full grid grid-cols-2 sm:grid-cols-4 gap-1.5">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;

              return (
                <button
                  key={tab.id}
                  id={`tab-${tab.id}`}
                  role="tab"
                  type="button"
                  aria-selected={isActive}
                  aria-controls={`panel-${tab.id}`}
                  onClick={() => setActiveTab(tab.id)}
                  className={`cursor-pointer w-full flex-1 inline-flex items-center justify-center gap-2 rounded-md px-3 py-2 text-xs font-semibold transition-all duration-150 select-none shadow-2xs focus:outline-none ${
                    isActive
                      ? "dark:bg-slate-800/90 bg-slate-100 dark:text-white text-slate-900 border dark:border-slate-700/80 border-slate-300 ring-1 dark:ring-emerald-500/20 ring-emerald-500/10"
                      : "dark:text-slate-400 text-slate-600 hover:dark:text-slate-200 hover:text-slate-900 hover:dark:bg-slate-900/60 hover:bg-slate-100/70 border border-transparent"
                  }`}
                >
                  <Icon
                    className={`size-3.5 shrink-0 ${
                      isActive ? "text-emerald-500 dark:text-emerald-400" : "text-slate-400 dark:text-slate-500"
                    }`}
                  />
                  <span className="truncate">{tab.label}</span>
                  {tab.badge && (
                    <span
                      className={`rounded px-1.5 py-0.2 text-[10px] font-mono shrink-0 ${
                        isActive
                          ? "dark:bg-emerald-950/80 bg-emerald-100 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 font-semibold"
                          : "dark:bg-slate-800/80 bg-slate-200/80 dark:text-slate-400 text-slate-600"
                      }`}
                    >
                      {tab.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </nav>
      </div>

      {/* 2. TAB 1: EXECUTIVE OVERVIEW (Verdict Card + Summary + Conflict Heatmap) */}
      <div
        id="panel-overview"
        role="tabpanel"
        aria-labelledby="tab-overview"
        aria-label="Executive Overview"
        className={activeTab === "overview" ? "space-y-5 block animate-in fade-in duration-150" : "hidden"}
      >
        <ExecutiveVerdictCard
          assessment={assessment}
          activeView="jurisdictions"
          onViewChange={() => setActiveTab("jurisdictions")}
          onReassess={onReassess}
          busy={busy}
        />

        <Heatmap a={assessment} />

        {/* Quick Transition Banner */}
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border dark:border-slate-800/90 border-slate-200/90 dark:bg-slate-950/70 bg-white/90 backdrop-blur-md p-3.5 text-[12px] shadow-2xs">
          <div className="flex items-center gap-2 dark:text-slate-300 text-slate-700">
            <GlobeAltIcon className="size-4 text-emerald-500 dark:text-emerald-400" />
            <span>Need deeper legal citations and exact field specifications?</span>
          </div>
          <button
            type="button"
            onClick={() => setActiveTab("jurisdictions")}
            className="cursor-pointer inline-flex items-center gap-1.5 rounded-md dark:bg-slate-800 bg-slate-100 hover:dark:bg-slate-700 hover:bg-slate-200 px-3 py-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400 transition-colors border dark:border-slate-700 border-slate-300"
          >
            <span>Open Jurisdiction Matrix</span>
            <span>&rarr;</span>
          </button>
        </div>
      </div>

      {/* 3. TAB 2: JURISDICTION MATRIX (Detailed Multi-Regime Breakdown Cards) */}
      <div
        id="panel-jurisdictions"
        role="tabpanel"
        aria-labelledby="tab-jurisdictions"
        aria-label="Jurisdiction Matrix"
        className={activeTab === "jurisdictions" ? "space-y-5 block animate-in fade-in duration-150" : "hidden"}
      >
        <div className="rounded-lg border dark:border-slate-800/90 border-slate-200/90 dark:bg-slate-950/70 bg-white/90 backdrop-blur-md p-4 shadow-2xs">
          <div className="flex items-center justify-between pb-2.5 border-b dark:border-slate-800/80 border-slate-200/80">
            <div>
              <h3 className="text-xs font-bold dark:text-white text-slate-900 uppercase tracking-wider flex items-center gap-2 font-mono">
                <GlobeAltIcon className="size-3.5 text-emerald-500 dark:text-emerald-400" />
                Cross-Border Derivatives Jurisdiction Matrix
              </h3>
              <p className="mt-0.5 text-[11px] dark:text-slate-400 text-slate-500">
                Detailed regulatory findings, candidate fields mapped from catalog, and official rulebook citations.
              </p>
            </div>
            <span className="font-mono text-[10px] dark:text-slate-400 text-slate-600 dark:bg-slate-900 bg-slate-100 px-2 py-0.5 rounded border dark:border-slate-800 border-slate-200 tabular-nums">
              {filteredRows.length} of {rows.length} Regimes
            </span>
          </div>
        </div>

        <JurisdictionAccordion
          rows={filteredRows}
          onInspectDrawer={onInspectDrawer}
        />
      </div>

      {/* 4. TAB 3: REASONING TRACE (Step-by-Step LLM Audit Trail) */}
      <div
        id="panel-reasoning"
        role="tabpanel"
        aria-labelledby="tab-reasoning"
        aria-label="Reasoning Trace"
        className={activeTab === "reasoning" ? "space-y-5 block animate-in fade-in duration-150" : "hidden"}
      >
        {cot ? (
          <section className="rounded-lg border dark:border-slate-800/90 border-slate-200/90 dark:bg-slate-950/70 bg-white/90 backdrop-blur-md p-5 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b dark:border-slate-800/80 border-slate-200/80">
              <div>
                <div className="flex items-center gap-2">
                  <SparklesIcon className="size-4 text-emerald-500 dark:text-emerald-400" />
                  <h3 className="text-sm font-bold dark:text-white text-slate-900 tracking-tight font-mono">Chain of Thought</h3>
                </div>
                <p className="mt-0.5 text-[11px] dark:text-slate-400 text-slate-500">
                  Step-by-step regulatory decomposition and multi-regime deductive reasoning trace.
                </p>
              </div>

              <div className="flex items-center gap-2 self-start sm:self-auto font-mono text-[11px]">
                <button
                  type="button"
                  onClick={() => setShowRawCot(!showRawCot)}
                  className="cursor-pointer inline-flex items-center gap-1.5 rounded-md border dark:border-slate-800 border-slate-300 dark:bg-slate-900 bg-slate-100 px-2.5 py-1 font-semibold dark:text-slate-300 text-slate-700 hover:dark:bg-slate-800 hover:bg-slate-200 transition-colors"
                >
                  <span>{showRawCot ? "Hide Raw Trace" : "View Raw Trace"}</span>
                </button>

                <button
                  type="button"
                  onClick={handleCopyReasoning}
                  className="cursor-pointer inline-flex items-center gap-1.5 rounded-md border dark:border-slate-800 border-slate-300 dark:bg-slate-900 bg-slate-100 px-2.5 py-1 font-semibold dark:text-slate-300 text-slate-700 hover:dark:text-white hover:text-slate-900 hover:dark:bg-slate-800 hover:bg-slate-200 transition-colors"
                >
                  <CopyIcon className="size-3" />
                  <span>{copied ? "Copied!" : "Copy Trace"}</span>
                </button>
              </div>
            </div>

            {/* Per-regime reasoning cards with proper typography & line-height */}
            {cotSections.length > 0 && (
              <div className="space-y-2.5">
                <div className="text-[10px] font-semibold uppercase tracking-wider dark:text-slate-400 text-slate-500 font-mono">
                  Deductive Breakdown by Regime ({cotSections.length})
                </div>
                <div className="grid gap-2.5 sm:grid-cols-1">
                  {cotSections.map((sec, i) => {
                    const isFail = sec.tag?.includes("FAIL") || sec.content.toLowerCase().includes("conflict");
                    const isOk = sec.tag?.includes("OK") || sec.content.toLowerCase().includes("accommodat");

                    return (
                      <div
                        key={i}
                        className="rounded-md border dark:border-slate-800/80 border-slate-200/80 dark:bg-slate-900/40 bg-slate-50/70 p-3.5 text-[12px] leading-relaxed transition-all"
                      >
                        <div className="flex items-center justify-between gap-2 mb-2 pb-2 border-b dark:border-slate-800/60 border-slate-200/80">
                          <span className="font-bold dark:text-white text-slate-900 flex items-center gap-2 font-mono">
                            <span className="text-base">{sec.regime ? REGIME_FLAGS[sec.regime] || "🌐" : "🌐"}</span>
                            <span>{sec.regime || `Deduction Step ${i + 1}`}</span>
                            {sec.tag && (
                              <span
                                className={`rounded px-1.5 py-0.2 text-[10px] font-mono font-bold border ${
                                  isFail
                                    ? "bg-rose-500/10 text-rose-500 dark:text-rose-300 border-rose-500/30"
                                    : isOk
                                    ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-300 border border-emerald-500/30"
                                    : "bg-amber-500/10 text-amber-600 dark:text-amber-300 border border-amber-500/30"
                                }`}
                              >
                                {sec.tag}
                              </span>
                            )}
                          </span>
                          <span className="text-[10px] font-mono tabular-nums dark:text-slate-500 text-slate-400">
                            Step {i + 1} of {cotSections.length}
                          </span>
                        </div>
                        <p className="font-sans text-[12px] dark:text-slate-200 text-slate-700 leading-relaxed whitespace-pre-wrap">
                          {sec.content.trim()}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Collapsible Verbatim Monospace Stream */}
            {showRawCot && (
              <div className="pt-2 animate-in fade-in duration-150">
                <div className="text-[10px] font-semibold uppercase tracking-wider dark:text-slate-400 text-slate-500 mb-1.5 font-mono">
                  Raw Model Reasoning Output
                </div>
                <div className="font-mono text-[11px] dark:text-slate-300 text-slate-800 dark:bg-slate-900/80 bg-slate-100 p-3.5 rounded-md border dark:border-slate-800/80 border-slate-200 leading-relaxed whitespace-pre-wrap max-h-96 overflow-y-auto">
                  {cot}
                </div>
              </div>
            )}
          </section>
        ) : (
          <div className="rounded-lg border dark:border-slate-800/90 border-slate-200/90 dark:bg-slate-950/70 bg-white/90 backdrop-blur-md p-8 text-center text-slate-500 text-[12px] shadow-2xs font-mono">
            No chain of thought reasoning trace recorded for this evaluation.
          </div>
        )}
      </div>

      {/* 5. TAB 4: COMPLEXITY & REQUIREMENTS (Atomic Requirements & Severity Spectrum) */}
      <div
        id="panel-complexity"
        role="tabpanel"
        aria-labelledby="tab-complexity"
        aria-label="Complexity & Requirements"
        className={activeTab === "complexity" ? "space-y-5 block animate-in fade-in duration-150" : "hidden"}
      >
        {/* Extracted Atomic Requirements */}
        <section className="rounded-lg border dark:border-slate-800/90 border-slate-200/90 dark:bg-slate-950/70 bg-white/90 backdrop-blur-md p-5 shadow-xs">
          <div className="pb-3 border-b dark:border-slate-800/80 border-slate-200/80">
            <h3 className="text-xs font-bold dark:text-white text-slate-900 uppercase tracking-wider flex items-center gap-2 font-mono">
              <CpuChipIcon className="size-3.5 text-emerald-500 dark:text-emerald-400" />
              Extracted Atomic Requirements ({reqs.length})
            </h3>
            <p className="mt-0.5 text-[11px] dark:text-slate-400 text-slate-500">
              Discrete, independently testable regulatory assertions parsed from the change request.
            </p>
          </div>

          <div className="mt-3.5 space-y-2">
            {reqs.length > 0 ? (
              reqs.map((r, i) => (
                <div
                  key={r.id || i}
                  className="rounded-md border dark:border-slate-800/80 border-slate-200/80 dark:bg-slate-900/40 bg-slate-50/70 p-3 text-[12px] space-y-1.5"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <span className="rounded dark:bg-slate-800 bg-slate-200 border dark:border-slate-700 border-slate-300 px-1.5 py-0.2 font-mono text-[10px] font-bold dark:text-emerald-400 text-emerald-700">
                        {r.id || `R${i + 1}`}
                      </span>
                      <span className="font-semibold dark:text-slate-200 text-slate-800">{r.concept}</span>
                    </div>
                    {r.required_max_length && (
                      <span className="rounded dark:bg-slate-800 bg-amber-50 px-2 py-0.5 font-mono text-[10px] text-amber-700 dark:text-amber-300 border border-amber-500/30 font-semibold">
                        Max: {r.required_max_length}
                      </span>
                    )}
                  </div>

                  <p className="dark:text-slate-300 text-slate-600 leading-relaxed text-[11px]">{r.requirement}</p>

                  {r.search_queries && r.search_queries.length > 0 && (
                    <div className="pt-1.5 border-t dark:border-slate-800/60 border-slate-200/60 flex flex-wrap items-center gap-1.5 text-[10px]">
                      <span className="dark:text-slate-500 text-slate-400 font-mono">pgvector queries:</span>
                      {r.search_queries.map((q, qIdx) => (
                        <span
                          key={qIdx}
                          className="rounded dark:bg-slate-800/70 bg-slate-200 px-1.5 py-0.2 font-mono text-[10px] dark:text-slate-400 text-slate-600"
                        >
                          &ldquo;{q}&rdquo;
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))
            ) : (
              <p className="text-slate-500 text-[12px] py-4 text-center font-mono">
                No decomposed atomic requirements were generated.
              </p>
            )}
          </div>
        </section>

        {/* Spectrum of Complexity */}
        {spectrum && spectrum.length > 0 && (
          <section className="rounded-lg border dark:border-slate-800/90 border-slate-200/90 dark:bg-slate-950/70 bg-white/90 backdrop-blur-md p-5 shadow-xs">
            <div className="pb-3 border-b dark:border-slate-800/80 border-slate-200/80">
              <h3 className="text-xs font-bold dark:text-white text-slate-900 tracking-tight font-mono uppercase">
                Spectrum of Complexity
              </h3>
              <p className="mt-0.5 text-[11px] dark:text-slate-400 text-slate-500">
                Evaluation of regulatory edge cases, architectural complexity, and cross-border risks.
              </p>
            </div>

            <div className="mt-3.5 space-y-1.5 text-[12px]">
              {spectrum.map((s, idx) => (
                <div
                  key={s.concept || idx}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 p-3 rounded-md border dark:border-slate-800/80 border-slate-200/80 dark:bg-slate-900/40 bg-slate-50/70 hover:dark:bg-slate-800/40 hover:bg-slate-100/70 transition-colors"
                >
                  <span className="font-semibold dark:text-slate-200 text-slate-800 shrink-0 font-mono text-[11px]">
                    {s.concept}
                  </span>
                  <span className="dark:text-slate-400 text-slate-600 sm:text-right text-[11px] leading-relaxed">
                    {s.reason}
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
