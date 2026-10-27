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

  return (
    <section
      aria-label="Summary"
      className="rounded-2xl border dark:border-slate-800/80 border-slate-200/80 dark:bg-slate-900/40 bg-white/70 backdrop-blur-md p-5 sm:p-6 shadow-2xl"
    >
      {/* Top Banner: Status + Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b dark:border-slate-800/60 border-slate-200/80">
        <div className="flex items-center gap-3">
          <div
            className={`flex size-10 items-center justify-center rounded-xl border ${
              isProceed
                ? "dark:bg-emerald-950/80 bg-emerald-50 dark:border-emerald-500/40 border-emerald-200 text-emerald-600 dark:text-emerald-400"
                : isDoNot
                ? "dark:bg-rose-950/80 bg-rose-50 dark:border-rose-500/40 border-rose-200 text-rose-600 dark:text-rose-400"
                : "dark:bg-amber-950/80 bg-amber-50 dark:border-amber-500/40 border-amber-200 text-amber-600 dark:text-amber-400"
            }`}
          >
            {isProceed && <ShieldCheckIcon className="size-5" />}
            {isDoNot && <ShieldXIcon className="size-5" />}
            {!isProceed && !isDoNot && <ShieldAlertIcon className="size-5" />}
          </div>

          <div>
            <div className="flex items-center gap-2">
              <span
                className={`rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider border ${
                  isProceed
                    ? "dark:bg-emerald-950 bg-emerald-100 dark:border-emerald-500/40 border-emerald-300 text-emerald-700 dark:text-emerald-300"
                    : isDoNot
                    ? "dark:bg-rose-950 bg-rose-100 dark:border-rose-500/40 border-rose-300 text-rose-700 dark:text-rose-300"
                    : "dark:bg-amber-950 bg-amber-100 dark:border-amber-500/40 border-amber-300 text-amber-700 dark:text-amber-300"
                }`}
              >
                {overall || "Needs Review"}
              </span>
              <span className="font-mono text-[11px] dark:text-slate-500 text-slate-400">
                ID: {assessment.id.slice(0, 8)}
              </span>
            </div>
            <h2 className="text-base font-bold dark:text-white text-slate-900 mt-1">
              Multi-Regime Compliance Executive Verdict
            </h2>
          </div>
        </div>

        {onReassess && (
          <button
            type="button"
            onClick={onReassess}
            disabled={busy}
            className="cursor-pointer inline-flex items-center gap-2 rounded-lg border dark:border-slate-700/80 border-slate-300 dark:bg-slate-800/80 bg-slate-100 px-3 py-1.5 text-xs font-semibold dark:text-slate-200 text-slate-700 hover:dark:bg-slate-700 hover:bg-slate-200 transition-colors disabled:opacity-50"
          >
            <ArrowPathIcon className={`size-3.5 ${busy ? "animate-spin" : ""}`} />
            <span>Re-evaluate</span>
          </button>
        )}
      </div>

      {/* Summary Sentence */}
      <div className="py-4 border-b dark:border-slate-800/60 border-slate-200/80">
        <p
          className={`text-[14px] font-bold leading-snug ${
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

      {/* Risk Exposure Meter */}
      <div className="py-4 border-b dark:border-slate-800/60 border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-[12px]">
        <div className="flex-1">
          <div className="flex items-center justify-between mb-1.5 dark:text-slate-400 text-slate-500">
            <span className="font-medium">Cross-Border Risk Exposure:</span>
            <span className="font-mono font-bold dark:text-white text-slate-900">{riskScore}/100</span>
          </div>
          <div className="w-full h-1.5 rounded-full dark:bg-slate-800 bg-slate-200 overflow-hidden">
            <div
              className={`h-full transition-all duration-700 ${
                riskScore === 0
                  ? "bg-emerald-500 w-2"
                  : riskScore <= 30
                  ? "bg-amber-500 w-[30%]"
                  : "bg-rose-500 w-[70%]"
              }`}
            />
          </div>
        </div>

        <div className="flex items-center gap-4 dark:text-slate-400 text-slate-500 font-mono text-[11px] shrink-0">
          <span>
            {new Date(assessment.created_at).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
          <span>·</span>
          <span>5 Regimes Checked</span>
        </div>
      </div>

      {/* Extracted Atomic Requirements */}
      {reqs.length > 0 && (
        <div className="py-4 border-b dark:border-slate-800/60 border-slate-200/80">
          <div className="text-[11px] font-semibold uppercase tracking-wider dark:text-slate-400 text-slate-500 mb-2.5">
            Extracted Atomic Requirements ({reqs.length})
          </div>
          <div className="space-y-2">
            {reqs.map((r, i) => (
              <div
                key={r.id || i}
                className="rounded-lg border dark:border-slate-800/60 border-slate-200/80 dark:bg-slate-900/30 bg-slate-50/50 p-3 text-[12px] flex items-start gap-3"
              >
                <span className="rounded dark:bg-slate-800 bg-slate-200 border dark:border-slate-700 border-slate-300 px-2 py-0.5 font-mono text-[10px] font-bold dark:text-slate-200 text-slate-700">
                  {r.id || `R${i + 1}`}
                </span>
                <div className="flex-1">
                  <span className="font-semibold dark:text-slate-200 text-slate-800">{r.concept}:</span>{" "}
                  <span className="dark:text-slate-300 text-slate-600">{r.requirement}</span>
                </div>
                {r.required_max_length && (
                  <span className="rounded dark:bg-slate-800 bg-amber-50 px-2 py-0.5 font-mono text-[10px] text-amber-700 dark:text-amber-300 border border-amber-500/30 shrink-0">
                    Max: {r.required_max_length}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Progressive Disclosure Views Navigation */}
      <div className="pt-4 flex flex-wrap gap-2 text-[12px]">
        <button
          type="button"
          onClick={() => onViewChange("jurisdictions")}
          className={`cursor-pointer rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
            activeView === "jurisdictions"
              ? "bg-emerald-600 text-white font-semibold"
              : "dark:bg-slate-800/60 bg-slate-100 text-slate-700 dark:text-slate-300 hover:dark:bg-slate-800 hover:bg-slate-200 hover:dark:text-white"
          }`}
        >
          Jurisdiction Matrix
        </button>

        <button
          type="button"
          onClick={() => onViewChange("heatmap")}
          className={`cursor-pointer rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
            activeView === "heatmap"
              ? "bg-emerald-600 text-white font-semibold"
              : "dark:bg-slate-800/60 bg-slate-100 text-slate-700 dark:text-slate-300 hover:dark:bg-slate-800 hover:bg-slate-200 hover:dark:text-white"
          }`}
        >
          Conflict Heatmap
        </button>

        <button
          type="button"
          onClick={() => onViewChange("cot")}
          className={`cursor-pointer rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
            activeView === "cot"
              ? "bg-emerald-600 text-white font-semibold"
              : "dark:bg-slate-800/60 bg-slate-100 text-slate-700 dark:text-slate-300 hover:dark:bg-slate-800 hover:bg-slate-200 hover:dark:text-white"
          }`}
        >
          Reasoning Trace
        </button>

        <button
          type="button"
          onClick={() => onViewChange("spectrum")}
          className={`cursor-pointer rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
            activeView === "spectrum"
              ? "bg-emerald-600 text-white font-semibold"
              : "dark:bg-slate-800/60 bg-slate-100 text-slate-700 dark:text-slate-300 hover:dark:bg-slate-800 hover:bg-slate-200 hover:dark:text-white"
          }`}
        >
          Complexity Spectrum
        </button>
      </div>
    </section>
  );
}
