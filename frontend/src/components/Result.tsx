import { useState } from "react";
import { CONCLUSION_FOR, STATUS_LABEL, statusClasses } from "./Badges";
import { Heatmap } from "./Heatmap";
import {
  AlertTriangleIcon,
  CheckCircleIcon,
  CpuChipIcon,
  DocumentTextIcon,
  ShieldAlertIcon,
  ShieldCheckIcon,
  ShieldXIcon,
  XCircleIcon,
} from "./Icons";
import type { Assessment, Row } from "../types";

const FLAG_TEXT: Record<string, string> = {
  unverified_quote: "quote not verified",
  missing_quote: "no quote",
  missing_citation: "no citation",
  sources_disagree: "sources disagree",
  unrecognised_verdict: "unclear verdict",
  missing_reason: "no reason given",
  vote_errors: "a model vote failed",
};

const REGIME_FLAGS: Record<string, string> = {
  EMIR: "🇪🇺",
  UKEMIR: "🇬🇧",
  ASIC: "🇦🇺",
  MAS: "🇸🇬",
  HKMA: "🇭🇰",
};

export function summaryLine(a: Assessment): string {
  const rows = a.compliance_table;
  const bad = rows.filter((r) => r.effective_status === "non_compliant").map((r) => r.regulation);
  const ok = rows.filter((r) => r.effective_status === "compliant").map((r) => r.regulation);
  if (a.overall_conclusion === "Do Not Proceed")
    return `Do Not Proceed globally - non-compliant with ${bad.length} of ${rows.length} regulations${ok.length ? `; may proceed only for: ${ok.join(", ")}` : ""}`;
  if (a.overall_conclusion === "Proceed") return `Proceed - compliant with all ${rows.length} regulations`;
  return "Needs Review - a human must review this before anyone proceeds";
}

function Summary({ a }: { a: Assessment }) {
  const isDoNotProceed = a.overall_conclusion === "Do Not Proceed";
  const isProceed = a.overall_conclusion === "Proceed";

  const bannerBg = isDoNotProceed
    ? "bg-red-50/90 border-red-200"
    : isProceed
      ? "bg-emerald-50/90 border-emerald-200"
      : "bg-amber-50/90 border-amber-200";

  const tone = isDoNotProceed ? "text-no-ink" : isProceed ? "text-yes-ink" : "text-rev-ink";

  return (
    <section aria-label="Summary" className={`rounded-xl border p-5 shadow-xs transition-all ${bannerBg}`}>
      <div className="flex items-start gap-4">
        <div className="mt-0.5 shrink-0">
          {isDoNotProceed && <ShieldXIcon className="size-8 text-red-600" />}
          {isProceed && <ShieldCheckIcon className="size-8 text-emerald-600" />}
          {!isDoNotProceed && !isProceed && <ShieldAlertIcon className="size-8 text-amber-600" />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2.5">
            <span
              className="rounded-md px-2.5 py-0.5 font-sans text-[11px] font-bold uppercase tracking-wider text-white"
              style={{ backgroundColor: isDoNotProceed ? "#dc2626" : isProceed ? "#059669" : "#d97706" }}
            >
              {a.overall_conclusion || "Pending Decision"}
            </span>
            <span className="font-mono text-[11px] text-slate-500">ID: {a.id.slice(0, 8)}</span>
          </div>
          <div className={`mt-1.5 text-[15px] font-bold leading-snug ${tone}`}>
            {summaryLine(a)}
          </div>
          <div className="mt-1 text-[11px] text-slate-500">
            {a.risk_score !== null && <>Risk score {a.risk_score}/100 · </>}
            {a.model.latency_ms !== null && <>{a.model.latency_ms} ms · </>}
            {a.disclaimer}. Decision-support only, not a legal opinion.
          </div>
        </div>
      </div>

      {a.warnings.length > 0 && (
        <div className="mt-3.5 rounded-lg border border-amber-200 bg-amber-50/80 p-3">
          <div className="flex items-center gap-1.5 font-semibold text-[11px] text-amber-900">
            <AlertTriangleIcon className="size-3.5 text-amber-700" />
            <span>Advisory Warnings:</span>
          </div>
          <ul className="mt-1 list-disc space-y-0.5 pl-5 text-[11px] text-rev-ink">
            {a.warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

function Tiles({ rows }: { rows: Row[] }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
      {rows.map((r) => (
        <div
          key={r.regulation}
          className={`rounded-xl border p-4 text-center shadow-2xs transition-all ${statusClasses(
            r.effective_status
          )}`}
        >
          <div className="flex items-center justify-center gap-1.5 font-mono text-[12px] font-bold">
            <span>{REGIME_FLAGS[r.regulation]}</span>
            <span>{r.regulation}</span>
          </div>
          <div className="mt-1.5 text-2xl font-bold tracking-tight">
            {r.effective_status === "needs_review" ? "Review" : r.compliant}
          </div>
          <div className="mt-0.5 text-[11px] font-medium">{CONCLUSION_FOR[r.effective_status]}</div>
          {r.region && (
            <div className="mt-1.5 inline-block rounded bg-black/5 px-2 py-0.2 font-mono text-[9px] uppercase tracking-wider">
              {r.region}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function Table({ rows, onSelectReg }: { rows: Row[]; onSelectReg: (reg: string) => void }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-xs overflow-hidden">
      <div className="border-b border-slate-200 bg-slate-50/70 px-4 py-3">
        <h3 className="text-[14px] font-semibold text-slate-900">Multi-Regime Compliance Table</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[700px] border-collapse text-left text-[12px]">
          <thead className="bg-slate-50 text-[11px] font-semibold text-slate-600 border-b border-slate-200">
            <tr>
              <th className="px-4 py-2.5 w-[16%]">Regulation</th>
              <th className="px-3.5 py-2.5 w-[15%]">Is CR compliant?</th>
              <th className="px-3.5 py-2.5 w-[15%]">Conclusion</th>
              <th className="px-4 py-2.5 w-[26%]">Reason if not compliant</th>
              <th className="px-4 py-2.5 w-[28%]">Clause / citation</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {rows.map((r) => (
              <tr key={r.regulation} className="align-top hover:bg-slate-50/50 transition-colors">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1.5 font-mono font-bold text-slate-900">
                    <span>{REGIME_FLAGS[r.regulation]}</span>
                    <span>{r.regulation}</span>
                  </div>
                  {r.region && (
                    <span className="mt-0.5 inline-block text-[10px] text-slate-500">{r.region} Region</span>
                  )}
                </td>
                <td className={`px-3.5 py-3 font-bold ${statusClasses(r.effective_status)}`}>
                  {r.compliant}
                  {r.effective_status === "needs_review" && (
                    <div className="text-[10px] font-semibold">{STATUS_LABEL.needs_review}</div>
                  )}
                </td>
                <td className="px-3.5 py-3 font-semibold text-slate-900">
                  {CONCLUSION_FOR[r.effective_status]}
                </td>
                <td className="px-4 py-3">
                  <div className="text-slate-800 leading-relaxed">{r.reason_if_not_compliant || "-"}</div>
                  {r.flags.length > 0 && (
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {r.flags.map((f) => (
                        <span
                          key={f}
                          className="rounded border border-rev-line bg-rev-bg px-1.5 py-0.2 text-[10px] text-rev-ink"
                        >
                          {FLAG_TEXT[f] ?? f}
                        </span>
                      ))}
                    </div>
                  )}
                </td>
                <td className="px-4 py-3">
                  {r.citation ? (
                    <div className="font-mono text-[10px] text-slate-700 bg-slate-100 rounded px-1.5 py-0.5 inline-block font-medium">
                      {r.citation}
                    </div>
                  ) : (
                    <div className="text-slate-400">No citation returned</div>
                  )}
                  {r.quote && (
                    <div className="mt-1 rounded bg-slate-50 p-2 whitespace-pre-line italic text-[11px] text-slate-700 border-l-2 border-emerald-600">
                      &ldquo;{r.quote}&rdquo;
                    </div>
                  )}
                  {r.findings && r.findings.length > 0 && (
                    <div className="mt-2">
                      <button
                        type="button"
                        onClick={() => onSelectReg(r.regulation)}
                        className="inline-flex cursor-pointer items-center gap-1 text-[11px] font-medium text-emerald-700 hover:text-emerald-800 hover:underline"
                      >
                        <span>Inspect {r.findings.length} findings in Evidence Inspector</span> &rarr;
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function EvidenceInspector({ rows, selectedReg, onSelectReg }: { rows: Row[]; selectedReg: string; onSelectReg: (reg: string) => void }) {
  const current = rows.find((r) => r.regulation === selectedReg) || rows[0];
  if (!current) return null;

  const fs = current.findings ?? [];
  const mapped = Object.entries(current.mapped_fields ?? {});

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
      <div className="border-b border-slate-200 pb-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <DocumentTextIcon className="size-4 text-emerald-700" />
            <h3 className="text-[14px] font-semibold text-slate-900">Evidence & Clauses Inspector</h3>
          </div>
          <p className="text-[11px] text-slate-500 mt-0.5">
            Examine clause citations, field specifications, and rule mismatches per jurisdiction.
          </p>
        </div>

        {/* Regulation selector tabs */}
        <div className="flex items-center gap-1.5">
          {rows.map((r) => (
            <button
              key={r.regulation}
              type="button"
              onClick={() => onSelectReg(r.regulation)}
              className={`cursor-pointer rounded-md px-3 py-1 font-mono text-[11px] font-bold transition-all ${
                r.regulation === current.regulation
                  ? "bg-slate-900 text-white shadow-xs"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900"
              }`}
            >
              {REGIME_FLAGS[r.regulation]} {r.regulation}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="font-mono text-[14px] font-bold text-slate-900">
              {REGIME_FLAGS[current.regulation]} {current.regulation}
            </span>
            <span className={`rounded px-2 py-0.5 text-[10px] font-bold uppercase ${statusClasses(current.effective_status)}`}>
              {current.compliant} · {CONCLUSION_FOR[current.effective_status]}
            </span>
          </div>
          {current.citation && (
            <div className="font-mono text-[11px] text-slate-600 bg-slate-50 border border-slate-200 px-2 py-0.5 rounded">
              Rulebook: {current.citation.split(",")[0]}
            </div>
          )}
        </div>

        {current.reason_if_not_compliant && (
          <div className="mt-2.5 rounded-lg border border-red-200 bg-red-50/70 p-3 text-[12px] text-red-900">
            <strong>Compliance Finding:</strong> {current.reason_if_not_compliant}
          </div>
        )}

        {/* Verbatim quote */}
        {current.quote && (
          <div className="mt-3 rounded-lg border-l-4 border-emerald-600 bg-slate-50 p-3 text-[12px] text-slate-800 italic">
            &ldquo;{current.quote}&rdquo;
          </div>
        )}

        {/* Findings List (Beautiful Cards, NOT crammed in table) */}
        {fs.length > 0 ? (
          <div className="mt-4 space-y-3">
            <div className="text-[11px] font-semibold uppercase text-slate-500 tracking-wider">
              Evaluated Specifications ({fs.length})
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {fs.map((f, i) => {
                const isConflict = f.supported === false || f.conflict;
                return (
                  <div
                    key={i}
                    className={`rounded-lg border p-3.5 text-[12px] transition-all ${
                      isConflict
                        ? "border-red-200 bg-red-50/40"
                        : "border-slate-200 bg-slate-50/40"
                    }`}
                  >
                    <div className="flex items-center justify-between border-b border-slate-200/60 pb-2">
                      <div className="flex items-center gap-1.5">
                        <span className="rounded bg-slate-200 px-1.5 py-0.2 font-mono text-[10px] font-bold text-slate-800">
                          {f.req_id}
                        </span>
                        <span className="font-mono font-semibold text-slate-900">{f.field_name || "Field Check"}</span>
                      </div>
                      <span className={`inline-flex items-center gap-1 text-[11px] font-bold ${isConflict ? "text-red-700" : "text-emerald-700"}`}>
                        {isConflict ? <XCircleIcon className="size-3.5 inline" /> : <CheckCircleIcon className="size-3.5 inline" />}
                        {isConflict ? "Conflict" : "Supported"}
                      </span>
                    </div>

                    {f.requirement && (
                      <div className="mt-2 text-slate-600 leading-snug">
                        <span className="font-medium text-slate-800">Requirement:</span> {f.requirement}
                      </div>
                    )}
                    {f.spec_constraint && (
                      <div className="mt-1 text-slate-800 font-medium leading-snug">
                        <span className="text-slate-500">Specification Rule:</span> {f.spec_constraint}
                      </div>
                    )}
                    {f.conflict && (
                      <div className="mt-1 text-red-800 font-bold leading-snug">
                        <span>Conflict Reason:</span> {f.conflict}
                      </div>
                    )}
                    {f.reasoning && (
                      <div className="mt-1 text-slate-500 text-[11px] leading-snug">
                        {f.reasoning}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <p className="mt-3 text-[12px] text-slate-500">No atomic finding entries logged for this regulation.</p>
        )}

        {/* Fields considered */}
        {mapped.length > 0 && (
          <div className="mt-3.5 pt-3 border-t border-slate-200/80 text-[11px] text-slate-600">
            <span className="font-semibold text-slate-800">Candidate fields mapped from catalog: </span>
            {mapped.map(([req, names]) => (
              <span key={req} className="ml-1">
                <span className="font-mono font-bold text-slate-800">{req}</span>: {names.join(", ")};
              </span>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function Reasoning({ a }: { a: Assessment }) {
  const reqs = a.cr_metadata?.requirements ?? [];
  const rawLines = (a.chain_of_thought_explanation ?? "").split("\n").map((l) => l.trim()).filter(Boolean);

  // STRICT FILTER: Do not show raw lines like "EMIR: [R1=FAIL] EMIR defines..." in chain of thought
  const cleanLines = rawLines.filter((l) => {
    return !/\[R\d+\s*=\s*(FAIL|OK|WARN|PARTIAL)\]/i.test(l) && !/^[A-Z]+:\s*\[R\d+/i.test(l);
  });

  return (
    <section aria-label="Chain of thought" className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2.5">
        <CpuChipIcon className="size-4 text-emerald-700" />
        <h2 className="text-[14px] font-semibold text-slate-900">Chain of Thought</h2>
      </div>

      {a.cr_metadata?.summary && (
        <p className="mt-2.5 text-[12px] text-slate-600 leading-relaxed">
          <strong className="text-slate-900">Understood as:</strong> {a.cr_metadata.summary}
        </p>
      )}

      {reqs.length > 0 && (
        <div className="mt-3">
          <div className="text-[11px] font-semibold uppercase text-slate-500 tracking-wider">
            Decomposed Requirements ({reqs.length})
          </div>
          <ul className="mt-1.5 space-y-1.5 text-[12px]">
            {reqs.map((q, i) => (
              <li key={q.id ?? i} className="rounded-lg border border-slate-200 bg-slate-50/50 p-2.5 text-slate-800">
                <b className="font-mono text-emerald-800">{q.id}</b>{" "}
                {q.concept && <span className="font-semibold text-slate-900">· {q.concept}</span>}
                {q.requirement && <span className="text-slate-600"> - {q.requirement}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}

      {cleanLines.length > 0 && (
        <div className="mt-3">
          <div className="text-[11px] font-semibold uppercase text-slate-500 tracking-wider">
            Analytical Deliberation
          </div>
          <ol className="mt-1.5 space-y-1.5 text-[12px]">
            {cleanLines.map((l, i) => (
              <li key={i} className="rounded bg-slate-50 p-2.5 text-slate-800 border-l-2 border-emerald-600">
                {l}
              </li>
            ))}
          </ol>
        </div>
      )}
    </section>
  );
}

function Spectrum({ a }: { a: Assessment }) {
  const items = a.spectrum_of_complexity ?? [];
  if (!items.length) return null;

  return (
    <section aria-label="Spectrum of complexity" className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
      <div className="border-b border-slate-200 pb-2.5">
        <h2 className="text-[14px] font-semibold text-slate-900">Spectrum of Complexity</h2>
      </div>

      <div className="mt-3 overflow-x-auto rounded-lg border border-slate-200">
        <table className="w-full text-left text-[12px]">
          <thead className="bg-slate-50 text-[11px] font-semibold text-slate-600 border-b border-slate-200">
            <tr>
              <th className="py-2.5 pl-3.5 pr-2 w-[28%]">Requirement</th>
              <th className="py-2.5 pr-2 w-[18%]">Kind</th>
              <th className="py-2.5 pr-2 w-[16%]">Severity</th>
              <th className="py-2.5 pr-3 w-[38%]">Reason</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {items.map((s, i) => (
              <tr key={i} className="align-top hover:bg-slate-50/50">
                <td className="py-2.5 pl-3.5 pr-2">
                  <b className="font-mono text-slate-900">{s.requirement_id}</b>{" "}
                  <span className="text-slate-700">{s.concept}</span>
                </td>
                <td className="py-2.5 pr-2">
                  <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] text-slate-700 font-medium">
                    {s.kind}
                  </span>
                </td>
                <td className="py-2.5 pr-2 font-semibold text-slate-900">{s.severity}</td>
                <td className="py-2.5 pr-3 text-slate-600 leading-snug">{s.reason}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export function Result({
  a,
  onReassess,
  busy,
}: {
  a: Assessment;
  onReassess?: () => void;
  busy?: boolean;
}) {
  const [selectedReg, setSelectedReg] = useState<string>("EMIR");

  if (a.status === "model_error" || a.status === "invalid_model_output" || a.status === "pending") {
    return (
      <div role="alert" className="rounded-xl border border-no-line bg-no-bg p-5 text-no-ink shadow-xs">
        <div className="flex items-center gap-2 font-semibold">
          <ShieldAlertIcon className="size-5" />
          <span>{a.status === "pending" ? "This assessment never finished." : "This assessment failed."}</span>
        </div>
        {a.error && (
          <div className="mt-1 text-[12px]">
            {a.error.message} <span className="font-mono text-[11px]">({a.error.code})</span>
          </div>
        )}
      </div>
    );
  }

  const ambiguous = a.status === "needs_clarification";

  return (
    <div className="space-y-6">
      {ambiguous && (
        <div role="alert" className="rounded-xl border border-rev-line bg-rev-bg p-5 text-rev-ink shadow-xs">
          <div className="flex items-center gap-2 font-semibold">
            <AlertTriangleIcon className="size-5 text-amber-700" />
            <span>The change request is too vague to assess. Please clarify:</span>
          </div>
          <div className="mt-1.5 text-[12px] leading-relaxed">
            {a.clarification_prompt ?? "The model did not say what is missing."}
          </div>
        </div>
      )}

      {a.compliance_table.length > 0 && (
        <>
          {/* Top Level: Executive Verdict & 5 Jurisdiction Cards */}
          <Summary a={a} />
          <Tiles rows={a.compliance_table} />

          {/* Section 1: Multi-Regime Regulatory Table */}
          <Table rows={a.compliance_table} onSelectReg={setSelectedReg} />

          {/* Section 2: Dedicated Evidence & Clauses Inspector (Clean, spacious, not cramped in table!) */}
          <EvidenceInspector
            rows={a.compliance_table}
            selectedReg={selectedReg}
            onSelectReg={setSelectedReg}
          />

          {/* Section 3: Conflict Heatmap */}
          <Heatmap a={a} />

          {/* Section 4: Balanced 2-Column Row for Reasoning & Complexity Spectrum */}
          <div className="grid gap-6 lg:grid-cols-2 items-start">
            <Reasoning a={a} />
            <Spectrum a={a} />
          </div>
        </>
      )}

      {a.source_discrepancies.length > 0 && (
        <div className="rounded-xl border border-rev-line bg-rev-bg p-4 text-[12px] text-rev-ink">
          <b>Source documents disagree.</b> {a.source_discrepancies.length} discrepanc
          {a.source_discrepancies.length === 1 ? "y was" : "ies were"} reported by the model.
        </div>
      )}

      {onReassess && (
        <div className="flex items-center justify-between border-t border-slate-200 pt-4 text-[11px] text-slate-500">
          <span className="font-mono">Assessment ID: {a.id}</span>
          <button
            type="button"
            disabled={busy}
            onClick={onReassess}
            className="cursor-pointer rounded-md border border-slate-200 bg-white px-3.5 py-1.5 text-[12px] font-semibold text-slate-800 shadow-2xs hover:bg-slate-50 active:scale-95 disabled:opacity-50 transition-all"
          >
            Run again
          </button>
        </div>
      )}
    </div>
  );
}
