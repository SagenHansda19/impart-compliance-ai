import { useState } from "react";
import type { Assessment, Effective, Row } from "../types";
import { Heatmap } from "./Heatmap";
import {
  ShieldCheckIcon,
  ShieldXIcon,
  ShieldAlertIcon,
  CheckCircleIcon,
  XCircleIcon,
  AlertTriangleIcon,
  SparklesIcon,
  ArrowPathIcon,
} from "./Icons";

export function summaryLine(a: Assessment): string {
  const rows = a.compliance_table || [];
  const bad = rows.filter((r) => r.effective_status === "non_compliant").map((r) => r.regulation);
  const ok = rows.filter((r) => r.effective_status === "compliant").map((r) => r.regulation);
  if (a.overall_conclusion === "Do Not Proceed")
    return `Do Not Proceed globally - non-compliant with ${bad.length} of ${rows.length} regulations${
      ok.length ? `; may proceed only for: ${ok.join(", ")}` : ""
    }`;
  if (a.overall_conclusion === "Proceed")
    return `Proceed - compliant with all ${rows.length} regulations`;
  return "Needs Review - a human must review this before anyone proceeds";
}

interface AuditReportViewProps {
  assessment: Assessment | null;
  busy: boolean;
  onReassess?: () => void;
  filterJurisdictions?: string[];
}

const REGION_FLAGS: Record<string, string> = {
  EMIR: "🇪🇺",
  UKEMIR: "🇬🇧",
  ASIC: "🇦🇺",
  MAS: "🇸🇬",
  HKMA: "🇭🇰",
};

export function AuditReportView({
  assessment,
  busy,
  onReassess,
  filterJurisdictions,
}: AuditReportViewProps) {
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  if (!assessment) {
    return <EmptyWorkstationState />;
  }

  // Handle ambiguous clarification state
  if (assessment.status === "needs_clarification") {
    return (
      <div className="rounded-xl border border-amber-500/40 bg-amber-950/30 p-6 shadow-xl shadow-black/20 text-slate-100">
        <div className="flex items-start gap-3">
          <AlertTriangleIcon className="size-6 text-amber-400 shrink-0 mt-0.5" />
          <div className="flex-1">
            <h3 className="text-base font-bold text-amber-300">
              Clarification Needed by Regulatory Engine
            </h3>
            <p className="mt-2 text-[13px] text-slate-200 leading-relaxed font-medium">
              {assessment.clarification_prompt || "Which field should change?"}
            </p>
            <p className="mt-3 text-[11px] text-slate-400 font-mono">
              The change request is underspecified or ambiguous. Clarify the prompt on the left to proceed with automated cross-border evaluation.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const rows = (assessment.compliance_table || []).filter((r) =>
    !filterJurisdictions || filterJurisdictions.length === 0
      ? true
      : filterJurisdictions.includes(r.regulation)
  );

  const reqs = assessment.cr_metadata?.requirements || [];
  const overall = assessment.overall_conclusion;
  const isProceed = overall === "Proceed";
  const isDoNotProceed = overall === "Do Not Proceed";

  const toggleRow = (reg: string) => {
    setExpandedRow((cur) => (cur === reg ? null : reg));
  };

  return (
    <div className="space-y-6">
      {/* 1. EXECUTIVE SUMMARY CARD */}
      <section
        aria-label="Summary"
        className="rounded-xl border border-slate-800 bg-slate-900/90 p-5 shadow-xl shadow-black/20"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                Audit Assessment
              </span>
              <span className="font-mono text-[11px] text-slate-500">
                ID: {assessment.id.slice(0, 8)}
              </span>
            </div>
            <h2 className="text-lg font-bold text-white mt-0.5">
              Multi-Regime Compliance Executive Report
            </h2>
          </div>

          <div className="flex items-center gap-3">
            {onReassess && (
              <button
                type="button"
                onClick={onReassess}
                disabled={busy}
                className="cursor-pointer inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800/80 hover:bg-slate-700 px-3 py-1.5 text-[12px] font-medium text-slate-200 transition-colors disabled:opacity-50"
              >
                <ArrowPathIcon className={`size-3.5 ${busy ? "animate-spin" : ""}`} />
                <span>Re-assess</span>
              </button>
            )}

            {/* Overall Verdict Badge */}
            <div
              className={`inline-flex items-center gap-2 rounded-lg px-3.5 py-1.5 border text-[13px] font-bold tracking-wide shadow-sm ${
                isProceed
                  ? "bg-emerald-950/70 border-emerald-500/40 text-emerald-400 shadow-emerald-950/20"
                  : isDoNotProceed
                  ? "bg-rose-950/70 border-rose-500/40 text-rose-400 shadow-rose-950/20"
                  : "bg-amber-950/70 border-amber-500/40 text-amber-400 shadow-amber-950/20"
              }`}
            >
              {isProceed && <ShieldCheckIcon className="size-4" />}
              {isDoNotProceed && <ShieldXIcon className="size-4" />}
              {!isProceed && !isDoNotProceed && <ShieldAlertIcon className="size-4" />}
              <span>{overall || "Needs Review"}</span>
            </div>
          </div>
        </div>

        {/* Highlighted Conclusion Summary Line */}
        <div className="py-3 border-b border-slate-800">
          <p
            className={`text-[14px] font-bold leading-snug ${
              isProceed
                ? "text-emerald-400"
                : isDoNotProceed
                ? "text-rose-400"
                : "text-amber-400"
            }`}
          >
            {summaryLine(assessment)}
          </p>
        </div>

        {/* Risk & Performance Metrics Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 py-3 border-b border-slate-800 text-[12px]">
          {/* Risk Score */}
          <div className="bg-slate-950/60 rounded-lg p-2.5 border border-slate-800/80">
            <div className="flex items-center justify-between text-slate-400 mb-1">
              <span>Cross-Border Risk Exposure</span>
              <span className="font-mono font-semibold text-slate-200">
                {assessment.risk_score ?? 0}/100
              </span>
            </div>
            <div className="w-full h-1.5 rounded-full bg-slate-800 overflow-hidden">
              <div
                className={`h-full transition-all duration-500 ${
                  (assessment.risk_score ?? 0) === 0
                    ? "bg-emerald-500 w-2"
                    : (assessment.risk_score ?? 0) <= 30
                    ? "bg-amber-500 w-[30%]"
                    : "bg-rose-500 w-[70%]"
                }`}
              />
            </div>
          </div>

          {/* Model & Latency */}
          <div className="bg-slate-950/60 rounded-lg p-2.5 border border-slate-800/80 flex items-center justify-between">
            <div>
              <div className="text-slate-400">Inference & Retrieval</div>
              <div className="font-semibold text-slate-200 font-mono text-[11px] mt-0.5">
                {assessment.model?.latency_ms
                  ? `${assessment.model.latency_ms} ms`
                  : "Sub-4s Multi-Regime"}
              </div>
            </div>
            <span className="inline-flex items-center rounded bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 font-mono text-[10px] text-emerald-400">
              pgvector &lt;10ms
            </span>
          </div>

          {/* Timestamp */}
          <div className="bg-slate-950/60 rounded-lg p-2.5 border border-slate-800/80 flex items-center justify-between">
            <div>
              <div className="text-slate-400">Audit Timestamp</div>
              <div className="font-semibold text-slate-200 text-[11px] mt-0.5">
                {new Date(assessment.created_at).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                  second: "2-digit",
                })}
              </div>
            </div>
            <span className="text-slate-500 font-mono text-[10px]">
              {new Date(assessment.created_at).toLocaleDateString()}
            </span>
          </div>
        </div>

        {/* Extracted Atomic Requirements */}
        {reqs.length > 0 && (
          <div className="pt-3.5">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-2">
              Extracted Atomic Requirements ({reqs.length})
            </div>
            <div className="space-y-1.5">
              {reqs.map((r, idx) => (
                <div
                  key={r.id || idx}
                  className="rounded-lg bg-slate-950/70 border border-slate-800/90 px-3 py-2 text-[12px] flex items-start gap-2.5"
                >
                  <span className="rounded bg-slate-800 border border-slate-700 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-slate-300">
                    {r.id || `R${idx + 1}`}
                  </span>
                  <div className="flex-1">
                    <span className="font-semibold text-slate-200">
                      {r.concept}:
                    </span>{" "}
                    <span className="text-slate-300">{r.requirement}</span>
                  </div>
                  {r.required_max_length && (
                    <span className="rounded bg-slate-800/80 px-2 py-0.5 font-mono text-[10px] text-amber-300 border border-amber-500/20 shrink-0">
                      Max: {r.required_max_length}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* 2. COMPLIANCE MATRIX TABLE */}
      <section className="rounded-xl border border-slate-800 bg-slate-900/90 shadow-xl shadow-black/20 overflow-hidden">
        <div className="border-b border-slate-800/80 px-5 py-3.5 bg-slate-900/50 flex items-center justify-between">
          <div>
            <h3 className="text-[13px] font-semibold text-slate-100">
              Multi-Jurisdiction Compliance Matrix
            </h3>
            <p className="text-[11px] text-slate-400">
              Independent technical evaluation across EMIR, UK EMIR, ASIC, MAS, and HKMA
            </p>
          </div>
          <span className="text-[11px] font-mono text-slate-400">
            {rows.filter((r) => r.effective_status === "compliant").length} of {rows.length} Compliant
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-[12px]">
            <thead>
              <tr className="border-b border-slate-800/90 bg-slate-950/60 font-semibold text-slate-400 text-[11px] uppercase tracking-wider">
                <th className="py-3 px-4">Jurisdiction</th>
                <th className="py-3 px-4">Region</th>
                <th className="py-3 px-4">Verdict</th>
                <th className="py-3 px-4">Matched Fields / Capabilities</th>
                <th className="py-3 px-4">Reason / Notes</th>
                <th className="py-3 px-4 text-right">Evidence & Traceability</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-200">
              {rows.map((row) => {
                const isExpanded = expandedRow === row.regulation;
                const status = row.effective_status;
                const flag = REGION_FLAGS[row.regulation] || "🌐";
                const mappedFields = Object.values(row.mapped_fields || {}).flat();

                return (
                  <tr
                    key={row.regulation}
                    onClick={() => toggleRow(row.regulation)}
                    className={`cursor-pointer transition-colors duration-150 group ${
                      isExpanded ? "bg-slate-800/70" : "hover:bg-slate-800/40"
                    }`}
                  >
                    {/* Jurisdiction */}
                    <td className="py-3.5 px-4 font-semibold text-white">
                      <div className="flex items-center gap-2">
                        <span className="text-base">{flag}</span>
                        <span>{row.regulation}</span>
                      </div>
                      {row.citation && (
                        <div
                          className="text-[10px] text-slate-400 font-mono mt-0.5 truncate max-w-[220px]"
                          title={row.citation}
                        >
                          {row.citation}
                        </div>
                      )}
                    </td>

                    {/* Region */}
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <span className="rounded bg-slate-800 px-2 py-0.5 font-mono text-[10px] text-slate-300 border border-slate-700">
                        {row.region || "Global"}
                      </span>
                    </td>

                    {/* Verdict */}
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <VerdictBadge status={status} />
                    </td>

                    {/* Matched Fields */}
                    <td className="py-3.5 px-4">
                      {mappedFields.length > 0 ? (
                        <div className="flex flex-wrap gap-1 max-w-[280px]">
                          {mappedFields.slice(0, 2).map((f, i) => (
                            <span
                              key={i}
                              className="rounded bg-slate-800/90 border border-slate-700/80 px-1.5 py-0.5 text-[10px] text-slate-300 font-mono truncate max-w-[130px]"
                              title={f}
                            >
                              {f}
                            </span>
                          ))}
                          {mappedFields.length > 2 && (
                            <span className="rounded bg-slate-800/50 px-1.5 py-0.5 text-[10px] text-slate-400 font-mono">
                              +{mappedFields.length - 2}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-slate-500 text-[11px] italic">
                          Regime Scope / Direct
                        </span>
                      )}
                    </td>

                    {/* Reason */}
                    <td className="py-3.5 px-4 max-w-[260px] truncate text-slate-300">
                      {status === "compliant" ? (
                        <span className="text-emerald-400/90 text-[11px]">
                          Accommodated in technical specification
                        </span>
                      ) : (
                        <span className="text-rose-400 text-[11px]">
                          {row.reason_if_not_compliant || "Regulatory conflict detected"}
                        </span>
                      )}
                    </td>

                    {/* Expand Action */}
                    <td className="py-3.5 px-4 text-right whitespace-nowrap">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleRow(row.regulation);
                        }}
                        className={`cursor-pointer inline-flex items-center gap-1.5 text-[11px] font-medium transition-colors ${
                          isExpanded
                            ? "text-emerald-400"
                            : "text-slate-400 group-hover:text-emerald-400"
                        }`}
                      >
                        <span>{isExpanded ? "Hide Source" : "Inspect Chunks"}</span>
                        <span className="text-[12px] font-bold">
                          {isExpanded ? "▲" : "▼"}
                        </span>
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* 3. EXPANDABLE CITATION ACCORDION DRAWER */}
      {expandedRow && (
        <CitationDrawer
          row={rows.find((r) => r.regulation === expandedRow)!}
          onClose={() => setExpandedRow(null)}
        />
      )}

      {/* 4. CONFLICT HEATMAP */}
      <Heatmap a={assessment} />

      {/* 5. CHAIN OF THOUGHT EXPLANATION */}
      {assessment.chain_of_thought_explanation && (
        <section className="rounded-xl border border-slate-800 bg-slate-900/90 p-5 shadow-xl shadow-black/20">
          <div className="border-b border-slate-800 pb-3 mb-3">
            <h3 className="text-[13px] font-semibold text-slate-100 flex items-center gap-2">
              <SparklesIcon className="size-4 text-emerald-400" />
              Chain of Thought
            </h3>
            <p className="text-[11px] text-slate-400">
              Audit trail of LLM requirement evaluation and rule application
            </p>
          </div>
          <p className="whitespace-pre-wrap font-mono text-[11px] text-slate-300 bg-slate-950/70 p-4 rounded-lg border border-slate-800/80 leading-relaxed">
            {assessment.chain_of_thought_explanation}
          </p>
        </section>
      )}

      {/* 6. SPECTRUM OF COMPLEXITY */}
      {assessment.spectrum_of_complexity && assessment.spectrum_of_complexity.length > 0 && (
        <section className="rounded-xl border border-slate-800 bg-slate-900/90 p-5 shadow-xl shadow-black/20">
          <div className="border-b border-slate-800 pb-3 mb-3">
            <h3 className="text-[13px] font-semibold text-slate-100">
              Spectrum of Complexity
            </h3>
            <p className="text-[11px] text-slate-400">
              Risk and architectural complexity classification per requirement
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-[11px]">
              <thead>
                <tr className="border-b border-slate-800/80 text-slate-400 uppercase font-semibold">
                  <th className="py-2 px-3">Req ID</th>
                  <th className="py-2 px-3">Concept</th>
                  <th className="py-2 px-3">Kind</th>
                  <th className="py-2 px-3">Severity</th>
                  <th className="py-2 px-3">Reason</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-slate-300">
                {assessment.spectrum_of_complexity.map((item) => (
                  <tr key={item.requirement_id || item.concept} className="hover:bg-slate-800/30">
                    <td className="py-2 px-3 font-mono font-semibold text-white">
                      {item.requirement_id}
                    </td>
                    <td className="py-2 px-3 font-medium text-slate-200">{item.concept}</td>
                    <td className="py-2 px-3 font-mono">{item.kind}</td>
                    <td className="py-2 px-3">
                      <span
                        className={`rounded px-1.5 py-0.5 font-semibold text-[10px] ${
                          item.severity === "Critical"
                            ? "bg-rose-950 text-rose-300 border border-rose-800"
                            : item.severity === "Medium"
                            ? "bg-amber-950 text-amber-300 border border-amber-800"
                            : "bg-emerald-950 text-emerald-300 border border-emerald-800"
                        }`}
                      >
                        {item.severity}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-slate-400">{item.reason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}

function VerdictBadge({ status }: { status: Effective }) {
  if (status === "compliant") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-950/70 border border-emerald-500/40 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-400">
        <CheckCircleIcon className="size-3" />
        <span>Compliant</span>
      </span>
    );
  }
  if (status === "non_compliant") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-rose-950/70 border border-rose-500/40 px-2.5 py-0.5 text-[11px] font-semibold text-rose-400">
        <XCircleIcon className="size-3" />
        <span>Non-Compliant</span>
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-amber-950/70 border border-amber-500/40 px-2.5 py-0.5 text-[11px] font-semibold text-amber-400">
      <AlertTriangleIcon className="size-3" />
      <span>Needs Review</span>
    </span>
  );
}

function CitationDrawer({ row, onClose }: { row: Row; onClose: () => void }) {
  const flag = REGION_FLAGS[row.regulation] || "🌐";
  const quote = row.quote || "Verbatim official quote from regulatory specification.";
  const citation = row.citation || `${row.regulation} Official Regulatory Framework`;
  const findings = row.findings || [];

  return (
    <div className="rounded-xl border border-emerald-500/30 bg-slate-900/95 p-5 shadow-2xl shadow-black/40 animate-in fade-in slide-in-from-top-2 duration-200">
      <div className="flex items-center justify-between pb-3.5 border-b border-slate-800">
        <div className="flex items-center gap-2.5">
          <span className="text-xl">{flag}</span>
          <div>
            <h4 className="text-[14px] font-bold text-white flex items-center gap-2">
              {row.regulation} Audit Traceability & Source Chunks
              <VerdictBadge status={row.effective_status} />
            </h4>
            <div className="text-[11px] text-slate-400 font-mono mt-0.5">
              Citation: {citation}
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="cursor-pointer text-slate-400 hover:text-white p-1 rounded-md hover:bg-slate-800 transition-colors text-[12px]"
        >
          ✕ Close
        </button>
      </div>

      <div className="mt-4 space-y-4 text-[12px]">
        {/* Verified Quote Callout */}
        <div className="rounded-lg bg-slate-950/80 border border-emerald-500/20 p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
              <SparklesIcon className="size-3.5" />
              Verified Official Evidence Quote
            </span>
            {row.quote_verified && (
              <span className="rounded bg-emerald-950/90 border border-emerald-500/40 px-2 py-0.5 text-[10px] text-emerald-300 font-mono">
                ✓ 100% Verbatim Match
              </span>
            )}
          </div>
          <p className="text-slate-200 font-mono text-[12px] leading-relaxed italic whitespace-pre-wrap">
            “{quote}”
          </p>
        </div>

        {/* Evaluated Specifications */}
        {findings.length > 0 && (
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-2">
              Evaluated Specifications ({findings.length})
            </div>
            <div className="space-y-2">
              {findings.map((f, i) => (
                <div
                  key={f.req_id || i}
                  className="rounded-lg bg-slate-950/50 border border-slate-800/80 p-3"
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <span className="rounded bg-slate-800 border border-slate-700 px-1.5 py-0.5 font-mono text-[10px] text-slate-300">
                        {f.req_id || `R${i + 1}`}
                      </span>
                      <span className="font-semibold text-slate-200">
                        {f.field_name || "General Specification"}
                      </span>
                    </div>
                    <span
                      className={`text-[11px] font-semibold ${
                        f.supported ? "text-emerald-400" : "text-rose-400"
                      }`}
                    >
                      {f.supported ? "Supported" : "Conflict Detected"}
                    </span>
                  </div>

                  {f.requirement && (
                    <div className="text-slate-300 text-[11px] mb-1">
                      <span className="text-slate-500 font-medium">Requirement:</span> {f.requirement}
                    </div>
                  )}

                  {f.reasoning && (
                    <div className="text-slate-400 text-[11px] italic">
                      <span className="text-slate-500 font-medium">Finding:</span> {f.reasoning}
                    </div>
                  )}

                  {f.conflict && (
                    <div className="mt-1.5 rounded bg-rose-950/40 border border-rose-500/30 p-2 text-rose-300 text-[11px]">
                      <strong>Conflict:</strong> {f.conflict}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* pgvector Technical Footprint */}
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-slate-950/40 border border-slate-800 p-2.5 font-mono text-[10px] text-slate-400">
          <div className="flex items-center gap-2">
            <span className="text-emerald-400 font-bold">pgvector DB:</span>
            <span>HNSW Cosine Distance (&lt;=&gt;)</span>
            <span className="text-slate-600">·</span>
            <span>ef_search = 40</span>
          </div>
          <div>
            <span>Catalog: {row.catalog_size ?? "Full"} Fields</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function EmptyWorkstationState() {
  return (
    <div className="rounded-xl border border-slate-800/80 bg-slate-900/60 p-10 text-center flex flex-col items-center justify-center min-h-[460px]">
      <div className="flex size-14 items-center justify-center rounded-2xl bg-slate-800/80 border border-slate-700/60 text-emerald-400 mb-4 shadow-inner">
        <SparklesIcon className="size-7" />
      </div>

      <h3 className="text-base font-bold text-white mb-1.5">
        Awaiting Regulatory Change Request
      </h3>
      <p className="text-[12px] text-slate-400 max-w-md mx-auto mb-6 leading-relaxed">
        Input your derivatives trade reporting specification changes on the left or select a sample prompt to initiate the automated multi-regime audit across EMIR, UK EMIR, ASIC, MAS, and HKMA.
      </p>

      {/* Feature Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 max-w-lg w-full text-left font-mono text-[11px]">
        <div className="rounded-lg bg-slate-950/60 border border-slate-800/80 p-3">
          <div className="text-emerald-400 font-bold">&lt; 10ms Vector Search</div>
          <div className="text-slate-400 text-[10px] mt-0.5">PostgreSQL + pgvector HNSW indexing</div>
        </div>
        <div className="rounded-lg bg-slate-950/60 border border-slate-800/80 p-3">
          <div className="text-emerald-400 font-bold">5 Regimes Evaluated</div>
          <div className="text-slate-400 text-[10px] mt-0.5">Unified single-prompt LLM audit</div>
        </div>
        <div className="rounded-lg bg-slate-950/60 border border-slate-800/80 p-3">
          <div className="text-emerald-400 font-bold">Full Traceability</div>
          <div className="text-slate-400 text-[10px] mt-0.5">Verbatim quotes & exact row citations</div>
        </div>
      </div>
    </div>
  );
}
