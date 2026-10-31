import { useState } from "react";
import type { Effective, Row } from "../types";
import { CheckCircleIcon, XCircleIcon, AlertTriangleIcon } from "./Icons";
import { CitationBadge } from "./CitationBadge";

interface JurisdictionAccordionProps {
  rows: Row[];
  onInspectDrawer: (row: Row) => void;
}

const REGION_FLAGS: Record<string, string> = {
  EMIR: "🇪🇺",
  UKEMIR: "🇬🇧",
  ASIC: "🇦🇺",
  MAS: "🇸🇬",
  HKMA: "🇭🇰",
};

export function JurisdictionAccordion({ rows, onInspectDrawer }: JurisdictionAccordionProps) {
  const [expandedReg, setExpandedReg] = useState<string | null>(null);

  const toggle = (reg: string) => {
    setExpandedReg((cur) => (cur === reg ? null : reg));
  };

  return (
    <section aria-label="Jurisdiction matrix" className="space-y-3">
      <div className="flex items-center justify-between px-1">
        <h3 className="text-sm font-bold dark:text-white text-slate-900 uppercase tracking-wider">
          Jurisdiction Breakdown ({rows.length})
        </h3>
        <span className="text-[11px] font-mono dark:text-slate-400 text-slate-500">
          Click a regime to expand audit details
        </span>
      </div>

      <div className="space-y-3">
        {rows.map((row) => {
          const isExpanded = expandedReg === row.regulation;
          const status = row.effective_status;
          const flag = REGION_FLAGS[row.regulation] || "🌐";
          const mappedFields = Object.values(row.mapped_fields || {}).flat();

          return (
            <div
              key={row.regulation}
              className={`rounded-2xl border transition-all overflow-hidden shadow-sm backdrop-blur-md ${
                isExpanded
                  ? "border-emerald-500/50 dark:bg-slate-950/80 bg-emerald-50/20"
                  : "dark:border-slate-800/80 border-slate-200/80 dark:bg-slate-950/60 bg-white/80 hover:dark:border-slate-700/80 hover:border-slate-300"
              }`}
            >
              {/* Header Row */}
              <div
                onClick={() => toggle(row.regulation)}
                className="cursor-pointer p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 select-none"
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <span className="text-2xl shrink-0">{flag}</span>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <h4 className="text-base font-bold dark:text-white text-slate-900 tracking-tight">
                        {row.regulation}
                      </h4>
                      <span className="rounded dark:bg-slate-900 bg-slate-100 dark:border-slate-800 border-slate-200 px-2 py-0.5 font-mono text-[10px] dark:text-slate-300 text-slate-600">
                        {row.region || "Global"}
                      </span>
                      <VerdictBadge status={status} />
                    </div>

                    {/* Instant Citation line */}
                    {row.citation && (
                      <div className="text-[11px] dark:text-slate-400 text-slate-500 font-mono mt-1.5 flex items-center gap-1.5 flex-wrap">
                        <span className="dark:text-slate-500 text-slate-400">Citation:</span>
                        <CitationBadge
                          citation={row.citation}
                          snippet={row.quote}
                          regulation={row.regulation}
                          onClickInspect={() => onInspectDrawer(row)}
                        />
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-3 self-end sm:self-auto shrink-0">
                  {/* Matched Fields Tags Preview */}
                  {mappedFields.length > 0 && (
                    <div className="hidden md:flex flex-wrap gap-1 max-w-[260px]">
                      {mappedFields.slice(0, 2).map((f, i) => (
                        <span
                          key={i}
                          className="rounded dark:bg-slate-900 bg-slate-100 border dark:border-slate-800 border-slate-200 px-2 py-0.5 text-[10px] dark:text-slate-300 text-slate-600 font-mono truncate max-w-[120px]"
                          title={f}
                        >
                          {f}
                        </span>
                      ))}
                      {mappedFields.length > 2 && (
                        <span className="rounded dark:bg-slate-900 bg-slate-100 border dark:border-slate-800 border-slate-200 px-1.5 py-0.5 text-[10px] dark:text-slate-400 text-slate-500 font-mono">
                          +{mappedFields.length - 2}
                        </span>
                      )}
                    </div>
                  )}

                  <span className={`text-xs dark:text-slate-400 text-slate-500 font-bold p-1 transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`}>
                    ▼
                  </span>
                </div>
              </div>

              {/* Collapsed/Expanded Body: Structured Legal Evidence Card */}
              {isExpanded && (
                <div className="px-5 pb-5 pt-4 border-t dark:border-slate-800/60 border-slate-200/80 space-y-4 animate-in fade-in duration-150">
                  {/* 1. Structured Metadata Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-[11px] font-mono">
                    <div className="rounded-xl dark:bg-slate-900/60 bg-slate-100/70 border dark:border-slate-800/80 border-slate-200 p-2.5">
                      <div className="text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400 font-sans font-semibold">
                        Regime Scope
                      </div>
                      <div className="mt-1 font-bold dark:text-slate-200 text-slate-800 truncate">
                        {row.regulation} ({row.region || "Global"})
                      </div>
                    </div>

                    <div className="rounded-xl dark:bg-slate-900/60 bg-slate-100/70 border dark:border-slate-800/80 border-slate-200 p-2.5">
                      <div className="text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400 font-sans font-semibold">
                        Document Source
                      </div>
                      <div className="mt-1 font-bold dark:text-emerald-400 text-emerald-700 truncate" title={row.citation || "Regulatory Rulebook"}>
                        {row.citation ? row.citation.split(",")[0] : "Official Specification"}
                      </div>
                    </div>

                    <div className="rounded-xl dark:bg-slate-900/60 bg-slate-100/70 border dark:border-slate-800/80 border-slate-200 p-2.5">
                      <div className="text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400 font-sans font-semibold">
                        Grounding Status
                      </div>
                      <div className="mt-1 font-semibold flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
                        <span>✓</span>
                        <span>pgvector Verified</span>
                      </div>
                    </div>
                  </div>

                  {/* 2. Verbatim Legal Evidence Quote Box */}
                  {row.quote && (
                    <div className="rounded-xl dark:bg-slate-900/40 bg-slate-100/60 border dark:border-slate-800/80 border-slate-200 p-4 space-y-2">
                      <div className="flex items-center justify-between text-[11px] font-mono">
                        <span className="text-slate-400 uppercase tracking-wider font-sans font-semibold text-[10px]">
                          Verbatim Regulatory Rulebook Excerpt
                        </span>
                        {row.citation && (
                          <span className="dark:text-slate-500 text-slate-400 truncate max-w-xs">
                            {row.citation}
                          </span>
                        )}
                      </div>
                      <blockquote className="font-mono text-[12px] dark:text-slate-200 text-slate-800 italic leading-relaxed pl-3 border-l-2 border-emerald-500/60 whitespace-pre-wrap">
                        “{row.quote}”
                      </blockquote>
                    </div>
                  )}

                  {/* 3. AI-Generated Synthesis Summary */}
                  <div className="rounded-xl dark:bg-slate-900/20 bg-slate-50/50 border dark:border-slate-800/60 border-slate-200/80 p-3.5 text-[12px] leading-relaxed">
                    <div className="text-[10px] uppercase tracking-wider font-semibold text-slate-500 dark:text-slate-400 mb-1">
                      Regulatory Synthesis & Compliance Finding
                    </div>
                    {status === "compliant" ? (
                      <p className="dark:text-emerald-300 text-emerald-800 font-medium">
                        Change request fully supported and accommodated in {row.regulation} technical specifications without schema alterations.
                      </p>
                    ) : (
                      <p className="dark:text-rose-300 text-rose-800 font-medium">
                        {row.reason_if_not_compliant || "Regulatory mismatch or specification constraint exceeded."}
                      </p>
                    )}
                  </div>

                  {/* 4. Action Trigger to Slide Open Full Audit Drawer */}
                  <div className="pt-1 flex justify-end">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onInspectDrawer(row);
                      }}
                      className="cursor-pointer inline-flex items-center gap-1.5 rounded-lg dark:bg-slate-900 bg-slate-100 hover:dark:bg-slate-800 hover:bg-slate-200 dark:border-slate-800 border-slate-300 px-3.5 py-1.5 text-xs font-semibold dark:text-emerald-400 text-emerald-600 transition-colors shadow-xs"
                    >
                      <span>Inspect Legal Chunks & pgvector Evidence</span>
                      <span>&rarr;</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

function VerdictBadge({ status }: { status: Effective }) {
  if (status === "compliant") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full dark:bg-emerald-500/10 bg-emerald-50 dark:border-emerald-500/30 border-emerald-300 px-2.5 py-0.5 text-[11px] font-semibold dark:text-emerald-400 text-emerald-700">
        <CheckCircleIcon className="size-3" />
        <span>Compliant</span>
      </span>
    );
  }
  if (status === "non_compliant") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full dark:bg-rose-500/10 bg-rose-50 dark:border-rose-500/30 border-rose-300 px-2.5 py-0.5 text-[11px] font-semibold dark:text-rose-400 text-rose-700">
        <XCircleIcon className="size-3" />
        <span>Non-Compliant</span>
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full dark:bg-amber-500/10 bg-amber-50 dark:border-amber-500/30 border-amber-300 px-2.5 py-0.5 text-[11px] font-semibold dark:text-amber-400 text-amber-700">
      <AlertTriangleIcon className="size-3" />
      <span>Needs Review</span>
    </span>
  );
}
