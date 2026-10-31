import { useState } from "react";
import { buildHeatmap, type Level, type RegCell } from "../heatmap";
import type { Assessment } from "../types";
import { AlertTriangleIcon, CheckCircleIcon, MatrixGridIcon, XCircleIcon } from "./Icons";

const REGIME_FLAGS: Record<string, string> = {
  EMIR: "🇪🇺",
  UKEMIR: "🇬🇧",
  ASIC: "🇦🇺",
  MAS: "🇸🇬",
  HKMA: "🇭🇰",
};

const REGION_THEMES: Record<
  Level,
  {
    border: string;
    bg: string;
    text: string;
    badge: string;
    bar: string;
    word: string;
  }
> = {
  0: {
    border: "dark:border-emerald-500/30 border-emerald-200",
    bg: "dark:bg-emerald-950/20 bg-emerald-50/40",
    text: "dark:text-emerald-300 text-emerald-800",
    badge: "dark:bg-emerald-500/10 bg-emerald-100 dark:text-emerald-400 text-emerald-700 dark:border-emerald-500/20 border-emerald-300",
    bar: "bg-emerald-500",
    word: "0% Conflict Exposure",
  },
  1: {
    border: "dark:border-yellow-500/30 border-yellow-200",
    bg: "dark:bg-yellow-950/20 bg-yellow-50/40",
    text: "dark:text-yellow-300 text-yellow-800",
    badge: "dark:bg-yellow-500/10 bg-yellow-100 dark:text-yellow-400 text-yellow-700 dark:border-yellow-500/20 border-yellow-300",
    bar: "bg-yellow-500",
    word: "Low Conflict Exposure",
  },
  2: {
    border: "dark:border-amber-500/30 border-amber-200",
    bg: "dark:bg-amber-950/20 bg-amber-50/40",
    text: "dark:text-amber-300 text-amber-800",
    badge: "dark:bg-amber-500/10 bg-amber-100 dark:text-amber-400 text-amber-700 dark:border-amber-500/20 border-amber-300",
    bar: "bg-amber-500",
    word: "Moderate Exposure",
  },
  3: {
    border: "dark:border-rose-500/40 border-rose-200",
    bg: "dark:bg-rose-950/30 bg-rose-50/40",
    text: "dark:text-rose-300 text-rose-800",
    badge: "dark:bg-rose-500/10 bg-rose-100 dark:text-rose-400 text-rose-700 dark:border-rose-500/20 border-rose-300",
    bar: "bg-rose-500",
    word: "High Risk Exposure",
  },
};

function RegBox({ c }: { c: RegCell }) {
  const review = c.status === "needs_review";
  const isConflict = c.status === "non_compliant";

  const exposurePct = review
    ? 50
    : isConflict
    ? Math.max(25, Math.round((c.conflicting / Math.max(1, c.total)) * 100))
    : 0;

  return (
    <div
      className={`rounded-md border p-2.5 transition-colors ${
        review
          ? "dark:border-amber-500/30 border-amber-200 dark:bg-amber-950/20 bg-amber-50/50"
          : isConflict
          ? "dark:border-rose-500/30 border-rose-200 dark:bg-rose-950/20 bg-rose-50/50 hover:dark:border-rose-500/50 hover:border-rose-300"
          : "dark:border-slate-800/90 border-slate-200/90 dark:bg-slate-900/40 bg-white hover:dark:border-slate-700/80 hover:border-slate-300"
      }`}
      title={`${c.regulation}: ${
        review
          ? "Needs manual review"
          : isConflict
          ? `${c.conflicting} of ${c.total} requirement(s) conflict`
          : "Accommodated without conflict"
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-xs font-bold dark:text-white text-slate-900 flex items-center gap-1.5">
          <span>{REGIME_FLAGS[c.regulation] || "🌐"}</span>
          <span>{c.regulation}</span>
        </span>

        {c.status === "compliant" && (
          <span className="inline-flex items-center gap-1 rounded px-1.5 py-0.2 text-[10px] font-semibold dark:bg-emerald-500/10 bg-emerald-50 dark:text-emerald-400 text-emerald-700 dark:border-emerald-500/20 border-emerald-300 font-mono">
            <CheckCircleIcon className="size-2.5" />
            OK
          </span>
        )}
        {isConflict && (
          <span className="inline-flex items-center gap-1 rounded px-1.5 py-0.2 text-[10px] font-semibold dark:bg-rose-500/10 bg-rose-50 dark:text-rose-400 text-rose-700 dark:border-rose-500/20 border-rose-300 font-mono">
            <XCircleIcon className="size-2.5" />
            Conflict
          </span>
        )}
        {review && (
          <span className="inline-flex items-center gap-1 rounded px-1.5 py-0.2 text-[10px] font-semibold dark:bg-amber-500/10 bg-amber-50 dark:text-amber-400 text-amber-700 dark:border-amber-500/20 border-amber-300 font-mono">
            <AlertTriangleIcon className="size-2.5" />
            Review
          </span>
        )}
      </div>

      <div className="w-full h-1 rounded-full dark:bg-slate-800 bg-slate-200 overflow-hidden mt-2">
        <div
          className={`h-full rounded-full transition-all duration-500 ${
            review
              ? "bg-amber-400"
              : isConflict
              ? "bg-rose-500"
              : "bg-emerald-500"
          }`}
          style={{ width: `${isConflict || review ? exposurePct : 100}%` }}
        />
      </div>

      <div className="mt-1.5 flex items-center justify-between text-[10px] font-mono tabular-nums">
        <span className="dark:text-slate-400 text-slate-500">
          {review
            ? "Unverified"
            : isConflict
            ? `${c.conflicting}/${c.total} conflicts`
            : "0 conflicts"}
        </span>
        <span
          className={`font-semibold ${
            review
              ? "dark:text-amber-400 text-amber-600"
              : isConflict
              ? "dark:text-rose-400 text-rose-600"
              : "dark:text-emerald-400 text-emerald-600"
          }`}
        >
          {review ? "Manual Check" : isConflict ? `${exposurePct}% Risk` : "Safe"}
        </span>
      </div>
    </div>
  );
}

export function Heatmap({ a }: { a: Assessment }) {
  const regions = buildHeatmap(a);
  const reqs = a.cr_metadata?.requirements ?? [];
  const rows = a.compliance_table ?? [];
  const [activeCell, setActiveCell] = useState<{
    reqId: string;
    reg: string;
    score: number;
    detail: string;
  } | null>(null);

  return (
    <section
      aria-label="Conflict heatmap"
      className="rounded-lg border dark:border-slate-800/90 border-slate-200/90 dark:bg-slate-950/70 bg-white/90 backdrop-blur-md p-5 shadow-xs space-y-5 transition-colors duration-150"
    >
      {/* 1. Header with Scientific Compliance Matrix Meta */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3.5 border-b dark:border-slate-800/80 border-slate-200/80">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs dark:text-emerald-400 text-emerald-600 font-bold">
              [Matrix]:
            </span>
            <h2 className="text-sm font-bold dark:text-white text-slate-900 tracking-tight flex items-center gap-2">
              Cross-Jurisdiction Conflict Heatmap Matrix
            </h2>
          </div>
          <p className="mt-0.5 text-[12px] dark:text-slate-400 text-slate-600">
            Precision compliance matrix mapping atomic technical requirements across regimes with normalized conflict coefficients.
          </p>
        </div>

        <div className="flex items-center gap-2 font-mono text-[10px] tabular-nums">
          <span className="rounded-md dark:bg-slate-900 bg-slate-100 border dark:border-slate-800 border-slate-200 px-2.5 py-1 dark:text-slate-300 text-slate-700">
            Shape: ({reqs.length || 1} × {rows.length})
          </span>
          <span className="rounded-md dark:bg-emerald-950/40 bg-emerald-50 border dark:border-emerald-500/30 border-emerald-200 px-2.5 py-1 dark:text-emerald-400 text-emerald-700 font-semibold">
            cmap="RdYlGn_r"
          </span>
        </div>
      </div>

      {regions.length === 0 ? (
        <p className="text-[12px] dark:text-slate-500 text-slate-400 font-mono py-4">
          The model returned no heatmap analysis for this change request.
        </p>
      ) : (
        <>
          {/* 2. HIGH-PRECISION RISK GRID TABLE */}
          <div className="rounded-md border dark:border-slate-800/90 border-slate-200/90 overflow-hidden dark:bg-slate-950/80 bg-slate-50/70">
            <div className="px-4 py-2 border-b dark:border-slate-800/80 border-slate-200/80 flex items-center justify-between text-xs font-mono dark:text-slate-400 text-slate-600">
              <div className="flex items-center gap-2">
                <MatrixGridIcon className="size-3.5 text-emerald-400" />
                <span className="font-semibold dark:text-slate-300 text-slate-700 text-[11px]">
                  Requirement vs Jurisdiction Matrix (annot=True)
                </span>
              </div>
              <span className="text-[11px] tabular-nums">Values: 0.00 (Safe) → 1.00 (Conflict)</span>
            </div>

            <div className="overflow-x-auto p-3.5">
              <table className="w-full min-w-[620px] border-separate border-spacing-1.5 text-left font-sans">
                <thead>
                  <tr>
                    <th className="px-3 py-1.5 text-[11px] font-mono font-semibold uppercase tracking-wider dark:text-slate-400 text-slate-600 w-[38%]">
                      Atomic Requirement Specification
                    </th>
                    {rows.map((r) => (
                      <th
                        key={r.regulation}
                        className="px-2 py-1.5 text-center font-mono text-xs font-semibold dark:text-slate-300 text-slate-800"
                      >
                        <div className="flex flex-col items-center gap-0.5">
                          <span className="text-sm">{REGIME_FLAGS[r.regulation]}</span>
                          <span className="text-[11px] font-bold">{r.regulation}</span>
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(reqs.length > 0
                    ? reqs
                    : [{ id: "REQ-1", concept: "Primary Specification", requirement: a.change_request.text }]
                  ).map((req, idx) => {
                    const reqId = req.id || `REQ-${idx + 1}`;

                    return (
                      <tr key={reqId}>
                        {/* Row Header (Requirement Details) */}
                        <td className="p-2.5 rounded-md dark:bg-slate-900/60 bg-white border dark:border-slate-800/80 border-slate-200 align-middle">
                          <div className="flex items-start gap-2">
                            <span className="rounded dark:bg-slate-800 bg-slate-100 border dark:border-slate-700/80 border-slate-300 px-1.5 py-0.2 font-mono text-[10px] font-bold dark:text-emerald-400 text-emerald-700 shrink-0 mt-0.5">
                              {reqId}
                            </span>
                            <div className="min-w-0">
                              <div className="font-semibold dark:text-slate-200 text-slate-800 text-[11px] truncate">
                                {req.concept || req.requirement}
                              </div>
                              {req.concept && req.requirement && req.concept !== req.requirement && (
                                <div className="text-[10px] dark:text-slate-400 text-slate-500 mt-0.5 line-clamp-1 font-mono">
                                  {req.requirement}
                                </div>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* Heatmap Matrix Cells with Interactive Micro-Tooltips */}
                        {rows.map((r) => {
                          const finding = r.findings?.find((f) => f.req_id === reqId);
                          const hasConflict =
                            finding?.conflict ||
                            finding?.supported === false ||
                            (r.effective_status === "non_compliant" && !finding);
                          const isReview = r.effective_status === "needs_review";

                          // Normalized numerical score for Seaborn heatmap cell
                          const score = hasConflict ? 1.0 : isReview ? 0.5 : 0.0;
                          const cellDetail = hasConflict
                            ? `Conflict - ${finding?.conflict || "Regulatory constraint violated"}`
                            : isReview
                            ? `Needs Review - Manual verification required`
                            : `Compliant - Accommodated in ${r.regulation}`;

                          const isHovered = activeCell?.reqId === reqId && activeCell?.reg === r.regulation;

                          return (
                            <td
                              key={r.regulation}
                              className="p-0.5 align-middle text-center relative"
                            >
                              <div
                                onMouseEnter={() =>
                                  setActiveCell({ reqId, reg: r.regulation, score, detail: cellDetail })
                                }
                                onMouseLeave={() => setActiveCell(null)}
                                className={`rounded-md p-2 flex flex-col items-center justify-center transition-all duration-150 border font-mono select-none cursor-crosshair ${
                                  isHovered ? "ring-1 ring-slate-400 dark:ring-slate-400 scale-[1.02] z-10" : ""
                                } ${
                                  hasConflict
                                    ? "dark:bg-rose-950/80 bg-rose-100/90 dark:border-rose-500/40 border-rose-300 dark:text-rose-300 text-rose-800 shadow-2xs"
                                    : isReview
                                    ? "dark:bg-amber-950/80 bg-amber-100/90 dark:border-amber-500/40 border-amber-300 dark:text-amber-300 text-amber-800 shadow-2xs"
                                    : "dark:bg-emerald-950/80 bg-emerald-100/90 dark:border-emerald-500/40 border-emerald-300 dark:text-emerald-300 text-emerald-800 shadow-2xs"
                                }`}
                                title={`${reqId} × ${r.regulation}: ${
                                  hasConflict
                                    ? `Conflict (Score 1.00) - ${finding?.conflict || "Non-compliant"}`
                                    : isReview
                                    ? `Needs Review (Score 0.50)`
                                    : `Compliant / OK (Score 0.00)`
                                }`}
                              >
                                <span className="text-xs font-bold tabular-nums tracking-tight">
                                  {score.toFixed(2)}
                                </span>
                                <span className="text-[9px] mt-0.5 uppercase font-sans font-semibold tracking-wider">
                                  {hasConflict ? "Conflict" : isReview ? "Review" : "OK"}
                                </span>
                              </div>

                              {/* Interactive Cell Micro-Tooltip */}
                              {isHovered && (
                                <div className="absolute z-30 bottom-full left-1/2 -translate-x-1/2 mb-1.5 w-48 p-2 rounded-md bg-slate-900 border border-slate-700 text-left text-[10px] text-slate-200 shadow-xl pointer-events-none animate-in fade-in duration-100 font-mono">
                                  <div className="flex items-center justify-between text-slate-400 pb-1 border-b border-slate-800 font-semibold">
                                    <span>{reqId} × {r.regulation}</span>
                                    <span className={score === 1 ? "text-rose-400" : score === 0.5 ? "text-amber-400" : "text-emerald-400"}>
                                      {score.toFixed(2)}
                                    </span>
                                  </div>
                                  <div className="mt-1 text-slate-300 leading-tight">
                                    {cellDetail}
                                  </div>
                                </div>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* 3. Scientific Continuous Colorbar Legend */}
            <div className="px-5 py-3 border-t dark:border-slate-800/80 border-slate-200/80 dark:bg-slate-900/40 bg-slate-100/60">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2 font-mono dark:text-slate-300 text-slate-700 text-[11px]">
                  <span className="font-semibold">Colorbar Scale (cbar):</span>
                  <span className="dark:text-slate-400 text-slate-500">Conflict Severity Ratio r_ij ∈ [0.00, 1.00]</span>
                </div>

                <div className="flex flex-col gap-1 sm:w-72">
                  {/* Continuous Gradient Bar */}
                  <div className="h-2 w-full rounded-full bg-gradient-to-r from-emerald-500 via-amber-400 to-rose-500 shadow-inner" />
                  
                  {/* Scale Ticks & Labels */}
                  <div className="flex items-center justify-between text-[10px] font-mono tabular-nums dark:text-slate-400 text-slate-500">
                    <span className="text-emerald-500 font-semibold">0.00 (Safe)</span>
                    <span className="text-amber-400 font-semibold">0.50 (Review)</span>
                    <span className="text-rose-400 font-semibold">1.00 (Conflict)</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 4. Regional Macro Breakdown (EMEA & APAC with "High Risk" and "Safe to Implement") */}
          <div className="pt-1">
            <div className="text-[10px] font-bold uppercase tracking-wider dark:text-slate-400 text-slate-500 mb-2.5 font-mono">
              Regional Jurisdiction Exposure
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {regions.map((r) => {
                const total = r.regulations.length;
                const conflictPercent = total > 0 ? Math.round((r.conflictingRegs / total) * 100) : 0;
                const theme = REGION_THEMES[r.level];

                return (
                  <div
                    key={r.region}
                    className="rounded-md border dark:border-slate-800/90 border-slate-200/90 dark:bg-slate-900/30 bg-slate-50/50 p-4 flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold dark:text-white text-slate-900 tracking-tight">
                            {r.region}
                          </span>
                          <span className="rounded dark:bg-slate-800 bg-slate-200 border dark:border-slate-700/60 border-slate-300 px-1.5 py-0.2 font-mono text-[10px] dark:text-slate-300 text-slate-700">
                            {r.regulations.length} Regimes
                          </span>
                        </div>
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider font-mono ${theme.badge}`}>
                          {r.riskStatus}
                        </span>
                      </div>

                      <div className="mt-3 space-y-1">
                        <div className="flex items-center justify-between text-[10px] font-mono tabular-nums">
                          <span className="font-medium dark:text-slate-300 text-slate-700">Regional Conflict Exposure</span>
                          <span className="font-bold dark:text-white text-slate-900">{conflictPercent}%</span>
                        </div>
                        <div className="w-full h-1 rounded-full dark:bg-slate-800 bg-slate-200 overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-500 ${
                              conflictPercent === 0 ? "bg-emerald-500 w-2" : theme.bar
                            }`}
                            style={{ width: `${Math.max(conflictPercent, 3)}%` }}
                          />
                        </div>
                      </div>

                      <div className="mt-2 text-[11px] dark:text-slate-400 text-slate-600 font-mono tabular-nums">
                        <span className="font-semibold dark:text-slate-200 text-slate-800">{r.conflictingRegs}</span> of{" "}
                        <span className="font-semibold dark:text-slate-200 text-slate-800">{r.regulations.length}</span> regulations in conflict
                      </div>
                    </div>

                    <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2.5 border-t dark:border-slate-800/60 border-slate-200/80">
                      {r.regulations.map((c) => (
                        <RegBox key={c.regulation} c={c} />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}
    </section>
  );
}

