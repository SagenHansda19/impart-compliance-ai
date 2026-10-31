import type { Assessment } from "../types";
import { summaryLine } from "./AuditReportView";
import {
  ShieldCheckIcon,
  ShieldXIcon,
  ShieldAlertIcon,
  ArrowPathIcon,
} from "./Icons";

interface ExecutiveVerdictCardProps {
  assessment: Assessment;
  activeView: "jurisdictions" | "heatmap" | "cot" | "spectrum";
  onViewChange: (view: "jurisdictions" | "heatmap" | "cot" | "spectrum") => void;
  onReassess?: () => void;
  busy: boolean;
}

export function ExecutiveVerdictCard({
  assessment,
  activeView,
  onViewChange,
  onReassess,
  busy,
}: ExecutiveVerdictCardProps) {
  const overall = assessment.overall_conclusion;
  const isProceed = overall === "Proceed";
  const isDoNot = overall === "Do Not Proceed";
  const reqs = assessment.cr_metadata?.requirements || [];
  const riskScore = assessment.risk_score ?? 0;
  const rows = assessment.compliance_table || [];
  
  const conflictCount = rows.filter((r) => r.effective_status === "non_compliant").length;
  const safeCount = rows.filter((r) => r.effective_status === "compliant").length;
  const reviewCount = rows.filter((r) => r.effective_status === "needs_review").length;

  return (
    <section
      aria-label="Summary"
      className="rounded-lg border dark:border-slate-800/90 border-slate-200/90 dark:bg-slate-950/70 bg-white/90 backdrop-blur-md p-5 shadow-xs transition-colors duration-150"
    >
      {/* 1. Command Center Top Header: Identification & Global Verdict */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b dark:border-slate-800/80 border-slate-200/80">
        <div className="flex items-center gap-3">
          <div
            className={`flex size-9 items-center justify-center rounded-md border shrink-0 ${
              isProceed
                ? "dark:bg-emerald-950/70 bg-emerald-50 dark:border-emerald-500/40 border-emerald-300 text-emerald-600 dark:text-emerald-400"
                : isDoNot
                ? "dark:bg-rose-950/70 bg-rose-50 dark:border-rose-500/40 border-rose-300 text-rose-600 dark:text-rose-400"
                : "dark:bg-amber-950/70 bg-amber-50 dark:border-amber-500/40 border-amber-300 text-amber-600 dark:text-amber-400"
            }`}
          >
            {isProceed && <ShieldCheckIcon className="size-4.5" />}
            {isDoNot && <ShieldXIcon className="size-4.5" />}
            {!isProceed && !isDoNot && <ShieldAlertIcon className="size-4.5" />}
          </div>

          <div>
            <div className="flex items-center gap-2">
              <span
                className={`rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider border font-mono ${
                  isProceed
                    ? "dark:bg-emerald-950/90 bg-emerald-100 dark:border-emerald-500/40 border-emerald-300 text-emerald-700 dark:text-emerald-300"
                    : isDoNot
                    ? "dark:bg-rose-950/90 bg-rose-100 dark:border-rose-500/40 border-rose-300 text-rose-700 dark:text-rose-300"
                    : "dark:bg-amber-950/90 bg-amber-100 dark:border-amber-500/40 border-amber-300 text-amber-700 dark:text-amber-300"
                }`}
              >
                {overall || "Needs Review"}
              </span>
              <span className="font-mono text-[11px] tabular-nums dark:text-slate-500 text-slate-400">
                AUDIT ID: {assessment.id.slice(0, 8)}
              </span>
              <span className="hidden sm:inline-block text-slate-600 dark:text-slate-600">·</span>
              <span className="hidden sm:inline-block font-mono text-[11px] tabular-nums dark:text-slate-500 text-slate-400">
                {new Date(assessment.created_at).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                  second: "2-digit",
                })}
              </span>
            </div>
            <h2 className="text-sm sm:text-base font-bold dark:text-white text-slate-900 mt-1 tracking-tight">
              Cross-Border Regulatory Compliance Verdict
            </h2>
          </div>
        </div>

        {onReassess && (
          <button
            type="button"
            onClick={onReassess}
            disabled={busy}
            className="cursor-pointer self-start sm:self-auto inline-flex items-center gap-2 rounded-md border dark:border-slate-800 border-slate-300 dark:bg-slate-900 bg-slate-100 px-3 py-1.5 text-xs font-semibold dark:text-slate-200 text-slate-700 hover:dark:bg-slate-800 hover:bg-slate-200 enabled:active:scale-[0.98] transition-all disabled:opacity-50 shadow-2xs"
          >
            <ArrowPathIcon className={`size-3.5 ${busy ? "animate-spin" : ""}`} />
            <span>Re-evaluate</span>
          </button>
        )}
      </div>

      {/* 2. Executive Summary Line */}
      <div className="py-3.5 border-b dark:border-slate-800/80 border-slate-200/80">
        <p
          className={`text-[13px] sm:text-[14px] font-semibold leading-relaxed ${
            isProceed
              ? "text-emerald-600 dark:text-emerald-400"
              : isDoNot
              ? "text-rose-600 dark:text-rose-400"
              : "text-amber-600 dark:text-amber-400"
          }`}
        >
          {summaryLine(assessment)}
        </p>
      </div>

      {/* 3. Institutional Portfolio Metrics Grid (4 KPI Summary Tiles) */}
      <div className="py-4 border-b dark:border-slate-800/80 border-slate-200/80">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Tile 1: Cross-Border Risk Exposure */}
          <div className="rounded-md border dark:border-slate-800/90 border-slate-200/90 dark:bg-slate-900/50 bg-slate-50/70 p-3 flex flex-col justify-between">
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 font-sans">
                Risk Exposure
              </div>
              <div className="mt-1 flex items-baseline gap-1.5">
                <span className="font-mono text-xl font-bold tabular-nums dark:text-white text-slate-900">
                  {riskScore}
                </span>
                <span className="font-mono text-xs dark:text-slate-500 text-slate-400">/100</span>
              </div>
            </div>
            <div className="mt-2.5">
              <div className="w-full h-1 rounded-full dark:bg-slate-800 bg-slate-200 overflow-hidden">
                <div
                  className={`h-full transition-all duration-500 ${
                    riskScore === 0
                      ? "bg-emerald-500 w-2"
                      : riskScore <= 30
                      ? "bg-amber-500 w-[30%]"
                      : "bg-rose-500 w-[70%]"
                  }`}
                />
              </div>
              <div className="mt-1.5 flex items-center justify-between text-[10px] font-mono">
                <span className="dark:text-slate-400 text-slate-500">Severity</span>
                <span
                  className={`font-semibold ${
                    riskScore === 0
                      ? "text-emerald-500 dark:text-emerald-400"
                      : riskScore <= 30
                      ? "text-amber-500 dark:text-amber-400"
                      : "text-rose-500 dark:text-rose-400"
                  }`}
                >
                  {riskScore === 0 ? "Zero Risk" : riskScore <= 30 ? "Moderate" : "Critical Conflict"}
                </span>
              </div>
            </div>
          </div>

          {/* Tile 2: Regimes Evaluated */}
          <div className="rounded-md border dark:border-slate-800/90 border-slate-200/90 dark:bg-slate-900/50 bg-slate-50/70 p-3 flex flex-col justify-between">
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 font-sans">
                Regulatory Scope
              </div>
              <div className="mt-1 flex items-baseline gap-1.5">
                <span className="font-mono text-xl font-bold tabular-nums dark:text-white text-slate-900">
                  {rows.length || 5}
                </span>
                <span className="font-mono text-xs dark:text-slate-500 text-slate-400">Jurisdictions</span>
              </div>
            </div>
            <div className="mt-2.5 text-[10px] font-mono dark:text-slate-400 text-slate-600 truncate">
              <span>EMIR · UK · ASIC · MAS · HKMA</span>
            </div>
          </div>

          {/* Tile 3: Audit Resolution Time / Retrieval Mode */}
          <div className="rounded-md border dark:border-slate-800/90 border-slate-200/90 dark:bg-slate-900/50 bg-slate-50/70 p-3 flex flex-col justify-between">
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 font-sans">
                Vector Retrieval
              </div>
              <div className="mt-1 flex items-baseline gap-1.5">
                <span className="font-mono text-xl font-bold tabular-nums dark:text-emerald-400 text-emerald-600">
                  &lt; 10ms
                </span>
                <span className="font-mono text-xs dark:text-slate-500 text-slate-400">HNSW Scan</span>
              </div>
            </div>
            <div className="mt-2.5 flex items-center justify-between text-[10px] font-mono">
              <span className="dark:text-slate-400 text-slate-500">Index</span>
              <span className="dark:text-emerald-400 text-emerald-600 font-medium">pgvector (ef=40)</span>
            </div>
          </div>

          {/* Tile 4: Active Conflicts Identified */}
          <div className="rounded-md border dark:border-slate-800/90 border-slate-200/90 dark:bg-slate-900/50 bg-slate-50/70 p-3 flex flex-col justify-between">
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 font-sans">
                Active Conflicts
              </div>
              <div className="mt-1 flex items-baseline gap-1.5">
                <span
                  className={`font-mono text-xl font-bold tabular-nums ${
                    conflictCount > 0
                      ? "text-rose-500 dark:text-rose-400"
                      : "text-emerald-500 dark:text-emerald-400"
                  }`}
                >
                  {conflictCount}
                </span>
                <span className="font-mono text-xs dark:text-slate-500 text-slate-400">
                  {conflictCount === 1 ? "Regime Conflict" : "Regime Conflicts"}
                </span>
              </div>
            </div>
            <div className="mt-2.5 flex items-center justify-between text-[10px] font-mono">
              <span className="dark:text-slate-400 text-slate-500">Accommodated</span>
              <span className="text-emerald-500 dark:text-emerald-400 font-medium">
                {safeCount} Compliant {reviewCount > 0 ? `· ${reviewCount} Review` : ""}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 4. Extracted Atomic Requirements (Institutional Spec Table) */}
      {reqs.length > 0 && (
        <div className="py-3.5 border-b dark:border-slate-800/80 border-slate-200/80">
          <div className="text-[10px] font-semibold uppercase tracking-wider dark:text-slate-400 text-slate-500 mb-2 font-mono">
            Extracted Atomic Requirements ({reqs.length})
          </div>
          <div className="space-y-1.5">
            {reqs.map((r, i) => (
              <div
                key={r.id || i}
                className="rounded-md border dark:border-slate-800/80 border-slate-200/80 dark:bg-slate-900/40 bg-slate-50/70 px-3 py-2 text-[12px] flex items-start gap-3"
              >
                <span className="rounded dark:bg-slate-800 bg-slate-200 border dark:border-slate-700 border-slate-300 px-1.5 py-0.2 font-mono text-[10px] font-bold dark:text-slate-300 text-slate-700 shrink-0 mt-0.5">
                  {r.id || `R${i + 1}`}
                </span>
                <div className="flex-1 min-w-0">
                  <span className="font-semibold dark:text-slate-200 text-slate-800">{r.concept}:</span>{" "}
                  <span className="dark:text-slate-300 text-slate-600">{r.requirement}</span>
                </div>
                {r.required_max_length && (
                  <span className="rounded dark:bg-slate-800/80 bg-amber-50 px-2 py-0.5 font-mono text-[10px] text-amber-700 dark:text-amber-300 border border-amber-500/30 shrink-0">
                    Max: {r.required_max_length}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 5. Progressive Disclosure Navigation Buttons */}
      <div className="pt-3.5 flex flex-wrap gap-1.5 text-[12px]">
        <button
          type="button"
          onClick={() => onViewChange("jurisdictions")}
          className={`cursor-pointer rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
            activeView === "jurisdictions"
              ? "bg-emerald-600 text-white font-semibold shadow-2xs"
              : "dark:bg-slate-900 bg-slate-100 text-slate-700 dark:text-slate-300 border dark:border-slate-800 border-slate-200 hover:dark:bg-slate-800 hover:bg-slate-200 hover:dark:text-white"
          }`}
        >
          Jurisdiction Matrix
        </button>

        <button
          type="button"
          onClick={() => onViewChange("heatmap")}
          className={`cursor-pointer rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
            activeView === "heatmap"
              ? "bg-emerald-600 text-white font-semibold shadow-2xs"
              : "dark:bg-slate-900 bg-slate-100 text-slate-700 dark:text-slate-300 border dark:border-slate-800 border-slate-200 hover:dark:bg-slate-800 hover:bg-slate-200 hover:dark:text-white"
          }`}
        >
          Conflict Heatmap
        </button>

        <button
          type="button"
          onClick={() => onViewChange("cot")}
          className={`cursor-pointer rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
            activeView === "cot"
              ? "bg-emerald-600 text-white font-semibold shadow-2xs"
              : "dark:bg-slate-900 bg-slate-100 text-slate-700 dark:text-slate-300 border dark:border-slate-800 border-slate-200 hover:dark:bg-slate-800 hover:bg-slate-200 hover:dark:text-white"
          }`}
        >
          Reasoning Trace
        </button>

        <button
          type="button"
          onClick={() => onViewChange("spectrum")}
          className={`cursor-pointer rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
            activeView === "spectrum"
              ? "bg-emerald-600 text-white font-semibold shadow-2xs"
              : "dark:bg-slate-900 bg-slate-100 text-slate-700 dark:text-slate-300 border dark:border-slate-800 border-slate-200 hover:dark:bg-slate-800 hover:bg-slate-200 hover:dark:text-white"
          }`}
        >
          Complexity Spectrum
        </button>
      </div>
    </section>
  );
}

