import { buildHeatmap, type Level, type RegCell } from "../heatmap";
import type { Assessment } from "../types";
import { AlertTriangleIcon, CheckCircleIcon, XCircleIcon } from "./Icons";

const LEVEL_CLASS: Record<Level, string> = {
  0: "bg-heat-0 text-heat-0-ink border-slate-200",
  1: "bg-heat-1 text-heat-1-ink border-red-200",
  2: "bg-heat-2 text-heat-2-ink border-red-300",
  3: "bg-heat-3 text-heat-3-ink border-red-500",
};

const LEVEL_WORD: Record<Level, string> = {
  0: "Not affected",
  1: "Low",
  2: "Medium",
  3: "High",
};

const REGIME_FLAGS: Record<string, string> = {
  EMIR: "🇪🇺",
  UKEMIR: "🇬🇧",
  ASIC: "🇦🇺",
  MAS: "🇸🇬",
  HKMA: "🇭🇰",
};

function RegBox({ c }: { c: RegCell }) {
  const review = c.status === "needs_review";
  const cls = review
    ? "bg-rev-bg text-rev-ink ring-2 ring-inset ring-rev-line border-amber-300"
    : LEVEL_CLASS[c.level];
  const text = review
    ? "Needs review"
    : c.status === "non_compliant"
      ? `${c.conflicting} of ${c.total} requirement${c.total === 1 ? "" : "s"} conflict`
      : "No conflict";

  return (
    <div
      className={`rounded-md border p-2.5 transition-all ${cls}`}
      title={`${c.regulation}: ${text}`}
    >
      <div className="flex items-center justify-between gap-1">
        <span className="font-mono text-[12px] font-bold">
          {REGIME_FLAGS[c.regulation] || ""} {c.regulation}
        </span>
        {c.status === "compliant" && <CheckCircleIcon className="size-3.5 text-emerald-600" />}
        {c.status === "non_compliant" && <XCircleIcon className="size-3.5 text-red-600" />}
        {review && <AlertTriangleIcon className="size-3.5 text-amber-600" />}
      </div>
      <div className="mt-1 text-[11px] leading-snug">{text}</div>
    </div>
  );
}

export function Heatmap({ a }: { a: Assessment }) {
  const regions = buildHeatmap(a);
  const reqs = a.cr_metadata?.requirements ?? [];
  const rows = a.compliance_table ?? [];

  return (
    <section aria-label="Conflict heatmap" className="rounded-lg border border-line bg-card p-5 shadow-xs">
      <div className="border-b border-line pb-3">
        <h2 className="text-[14px] font-semibold text-ink">Conflict Heatmap</h2>
        <p className="mt-0.5 text-[11px] text-sub">
          Region risk is the model&apos;s own rating. Red = a conflict was found (darker = more of the change request&apos;s requirements conflict). Grey = not affected.
        </p>
      </div>

      {regions.length === 0 ? (
        <p className="mt-3 text-[12px] text-sub">The model returned no heatmap for this change request.</p>
      ) : (
        <div className="mt-4 space-y-4">
          {/* Regional Macro Cards */}
          <div className="grid gap-3 sm:grid-cols-2">
            {regions.map((r) => {
              const total = r.regulations.length;
              const conflictPercent = total > 0 ? Math.round((r.conflictingRegs / total) * 100) : 0;

              return (
                <div key={r.region} className="rounded-lg border border-line bg-page/40 p-3.5">
                  <div className={`rounded-md border p-3 ${LEVEL_CLASS[r.level]}`}>
                    <div className="flex items-baseline justify-between">
                      <span className="text-[14px] font-bold">{r.region}</span>
                      <span className="rounded bg-black/10 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider">
                        {LEVEL_WORD[r.level]}
                      </span>
                    </div>
                    <div className="mt-1 flex items-center justify-between">
                      <div className="text-[12px] font-semibold">{r.riskStatus}</div>
                      <span className="font-mono text-[11px] font-bold">{conflictPercent}% Conflict Exposure</span>
                    </div>
                    <div className="mt-1 text-[11px] opacity-90">
                      {r.conflictingRegs} of {r.regulations.length} regulations in conflict
                      {Object.keys(r.breakdown).length > 0 &&
                        " · " +
                          Object.entries(r.breakdown)
                            .map(([k, n]) => `${k.replace(/_/g, " ")}: ${n}`)
                            .join(", ")}
                    </div>
                  </div>
                  <div className="mt-2.5 grid grid-cols-2 gap-2">
                    {r.regulations.map((c) => (
                      <RegBox key={c.regulation} c={c} />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Detailed Requirement-by-Regime Matrix (Directly rendered, no toggles) */}
          {rows.length > 0 && (
            <div className="rounded-lg border border-line bg-white overflow-hidden">
              <div className="bg-slate-50 px-3.5 py-2 border-b border-line text-[11px] font-semibold text-sub">
                Requirement-Level Conflict Breakdown
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[580px] border-collapse text-left text-[12px]">
                  <thead>
                    <tr className="border-b border-line bg-slate-50/50 text-[11px] text-sub">
                      <th className="px-3 py-2 w-[40%] font-semibold">Requirement</th>
                      {rows.map((r) => (
                        <th key={r.regulation} className="px-2 py-2 text-center font-mono font-semibold">
                          {REGIME_FLAGS[r.regulation]} {r.regulation}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {(reqs.length > 0
                      ? reqs
                      : [{ id: "REQ-1", concept: "Primary Specification", requirement: a.change_request.text }]
                    ).map((req, idx) => {
                      const reqId = req.id || `REQ-${idx + 1}`;

                      return (
                        <tr key={reqId} className="hover:bg-slate-50/50">
                          <td className="px-3 py-2 align-middle">
                            <span className="font-mono font-bold text-ink mr-1.5">{reqId}</span>
                            <span className="text-slate-700 text-[11px]">{req.concept || req.requirement}</span>
                          </td>
                          {rows.map((r) => {
                            const finding = r.findings?.find((f) => f.req_id === reqId);
                            const hasConflict =
                              finding?.conflict ||
                              finding?.supported === false ||
                              (r.effective_status === "non_compliant" && !finding);
                            const isReview = r.effective_status === "needs_review";

                            return (
                              <td key={r.regulation} className="p-1.5 text-center align-middle">
                                <span
                                  className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-semibold border ${
                                    hasConflict
                                      ? "bg-red-50 text-red-800 border-red-200"
                                      : isReview
                                        ? "bg-amber-50 text-amber-800 border-amber-200"
                                        : "bg-emerald-50 text-emerald-800 border-emerald-200"
                                  }`}
                                >
                                  {hasConflict ? "Conflict" : isReview ? "Review" : "OK"}
                                </span>
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Accessible Heatmap Legend */}
      <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-line/80 pt-3 text-[11px] text-sub" aria-label="Legend">
        <span className="font-semibold text-ink">Scale:</span>
        {([0, 1, 2, 3] as Level[]).map((l) => (
          <span key={l} className="flex items-center gap-1.5">
            <span className={`inline-block size-3.5 rounded-xs border ${LEVEL_CLASS[l]}`} />
            {LEVEL_WORD[l]}
          </span>
        ))}
        <span className="flex items-center gap-1.5">
          <span className="inline-block size-3.5 rounded-xs bg-rev-bg ring-2 ring-inset ring-rev-line border border-amber-300" />
          Needs review (could not be verified)
        </span>
      </div>
    </section>
  );
}
