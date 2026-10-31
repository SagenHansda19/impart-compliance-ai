import { useEffect } from "react";
import type { Row } from "../types";
import { SparklesIcon, CheckCircleIcon, XCircleIcon, AlertTriangleIcon } from "./Icons";
import { CitationBadge } from "./CitationBadge";

interface AuditDrawerProps {
  row: Row | null;
  onClose: () => void;
}

const REGION_FLAGS: Record<string, string> = {
  EMIR: "🇪🇺",
  UKEMIR: "🇬🇧",
  ASIC: "🇦🇺",
  MAS: "🇸🇬",
  HKMA: "🇭🇰",
};

export function AuditDrawer({ row, onClose }: AuditDrawerProps) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  if (!row) return null;

  const flag = REGION_FLAGS[row.regulation] || "🌐";
  const quote = row.quote || "Verbatim official quote from regulatory specification.";
  const citation = row.citation || `${row.regulation} Official Regulatory Framework`;
  const findings = row.findings || [];
  const status = row.effective_status;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-black/60 backdrop-blur-xs flex justify-end animate-in fade-in duration-200">
      {/* Backdrop click to close */}
      <div className="absolute inset-0" onClick={onClose} aria-hidden="true" />

      {/* Slide-over panel */}
      <div className="relative w-full max-w-xl dark:bg-slate-950 bg-white border-l dark:border-slate-800/80 border-slate-200/80 shadow-2xl p-6 overflow-y-auto flex flex-col justify-between z-10 animate-in slide-in-from-right duration-250">
        <div className="space-y-6">
          {/* Header */}
          <div className="flex items-start justify-between pb-4 border-b dark:border-slate-800/80 border-slate-200">
            <div className="flex items-center gap-3">
              <span className="text-2xl">{flag}</span>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-bold dark:text-white text-slate-900">{row.regulation}</h3>
                  <StatusBadge status={status} />
                </div>
                <div className="text-[11px] dark:text-slate-400 text-slate-500 font-mono mt-0.5">
                  Audit Traceability & Official pgvector Source Chunks
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="cursor-pointer dark:text-slate-400 text-slate-500 hover:dark:text-white hover:text-slate-900 p-2 rounded-lg hover:dark:bg-slate-900 hover:bg-slate-100 transition-colors text-sm"
              title="Close drawer (Esc)"
              aria-label="Close drawer"
            >
              ✕
            </button>
          </div>

          {/* Rulebook Citation */}
          <div className="rounded-xl dark:bg-slate-900/60 bg-slate-50 border dark:border-slate-800/80 border-slate-200/80 p-4">
            <div className="flex items-center justify-between mb-1.5">
              <div className="text-[10px] font-semibold uppercase tracking-wider dark:text-slate-400 text-slate-500">
                Official Rulebook Citation
              </div>
              <CitationBadge citation={citation} snippet={quote} regulation={row.regulation} />
            </div>
            <div className="text-[13px] font-mono font-medium dark:text-emerald-400 text-emerald-700">
              {citation}
            </div>
          </div>

          {/* Verbatim Legal Evidence Quote */}
          <div className="rounded-xl dark:bg-slate-900/40 bg-slate-100/60 border dark:border-slate-800/80 border-slate-200 p-5 space-y-2">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] font-bold uppercase tracking-wider dark:text-emerald-400 text-emerald-700 flex items-center gap-1.5 font-sans">
                <SparklesIcon className="size-3.5" />
                Verified Legal Evidence Quote
              </span>
              {row.quote_verified && (
                <span className="rounded dark:bg-emerald-500/10 bg-emerald-100 border dark:border-emerald-500/30 border-emerald-300 px-2 py-0.5 text-[10px] dark:text-emerald-300 text-emerald-800 font-mono font-medium">
                  ✓ 100% Verbatim Match
                </span>
              )}
            </div>
            <blockquote className="dark:text-slate-200 text-slate-800 font-mono text-[12px] leading-relaxed italic whitespace-pre-wrap pl-3 border-l-2 border-emerald-500/60">
              “{quote}”
            </blockquote>
          </div>

          {/* Evaluated Requirements Breakdown */}
          {findings.length > 0 && (
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wider dark:text-slate-400 text-slate-500 mb-3">
                Evaluated Specifications ({findings.length})
              </div>
              <div className="space-y-3">
                {findings.map((f, i) => (
                  <div
                    key={f.req_id || i}
                    className="rounded-xl dark:bg-slate-900/40 bg-slate-50 border dark:border-slate-800/80 border-slate-200/80 p-4 space-y-2 text-[12px]"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="rounded dark:bg-slate-800 bg-slate-200 border dark:border-slate-700 border-slate-300 px-2 py-0.5 font-mono text-[10px] dark:text-slate-200 text-slate-800 font-bold">
                          {f.req_id || `R${i + 1}`}
                        </span>
                        <span className="font-semibold dark:text-slate-200 text-slate-800">
                          {f.field_name || "General Specification"}
                        </span>
                      </div>
                      <span
                        className={`text-[11px] font-semibold ${
                          f.supported
                            ? "dark:text-emerald-400 text-emerald-600"
                            : "dark:text-rose-400 text-rose-600"
                        }`}
                      >
                        {f.supported ? "Supported" : "Conflict"}
                      </span>
                    </div>

                    {f.requirement && (
                      <div className="dark:text-slate-300 text-slate-700 text-[11px]">
                        <span className="dark:text-slate-500 text-slate-400 font-medium">Requirement:</span> {f.requirement}
                      </div>
                    )}

                    {f.reasoning && (
                      <div className="dark:text-slate-400 text-slate-600 text-[11px] italic">
                        <span className="dark:text-slate-500 text-slate-400 font-medium">Finding:</span> {f.reasoning}
                      </div>
                    )}

                    {f.conflict && (
                      <div className="rounded-lg dark:bg-rose-950/40 bg-rose-50 border dark:border-rose-500/30 border-rose-300 p-2.5 dark:text-rose-300 text-rose-700 text-[11px]">
                        <strong>Conflict:</strong> {f.conflict}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* pgvector Technical Footprint */}
          <div className="rounded-xl dark:bg-slate-900/40 bg-slate-50 border dark:border-slate-800/80 border-slate-200/80 p-3.5 font-mono text-[11px] dark:text-slate-400 text-slate-600 space-y-1">
            <div className="flex items-center justify-between">
              <span>Vector Similarity:</span>
              <span className="dark:text-slate-200 text-slate-800">BAAI/bge-base-en-v1.5</span>
            </div>
            <div className="flex items-center justify-between">
              <span>PostgreSQL Index:</span>
              <span className="dark:text-emerald-400 text-emerald-600 font-semibold">HNSW Cosine (&lt;=&gt;) · ef=40</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Catalog Scope:</span>
              <span>{row.catalog_size ?? "Full Catalog"} Fields</span>
            </div>
          </div>
        </div>

        {/* Footer Close Button */}
        <div className="pt-6 mt-6 border-t dark:border-slate-800 border-slate-200 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="cursor-pointer rounded-xl dark:bg-slate-800 bg-slate-100 hover:dark:bg-slate-700 hover:bg-slate-200 px-5 py-2 text-[12px] font-semibold dark:text-white text-slate-800 border dark:border-transparent border-slate-200 transition-colors"
          >
            Close Audit Drawer
          </button>
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: Row["effective_status"] }) {
  if (status === "compliant") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full dark:bg-emerald-950/80 bg-emerald-50 dark:border-emerald-500/40 border-emerald-300 px-2.5 py-0.5 text-[11px] font-semibold dark:text-emerald-400 text-emerald-700">
        <CheckCircleIcon className="size-3" />
        <span>Compliant</span>
      </span>
    );
  }
  if (status === "non_compliant") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full dark:bg-rose-950/80 bg-rose-50 dark:border-rose-500/40 border-rose-300 px-2.5 py-0.5 text-[11px] font-semibold dark:text-rose-400 text-rose-700">
        <XCircleIcon className="size-3" />
        <span>Non-Compliant</span>
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full dark:bg-amber-950/80 bg-amber-50 dark:border-amber-500/40 border-amber-300 px-2.5 py-0.5 text-[11px] font-semibold dark:text-amber-400 text-amber-700">
      <AlertTriangleIcon className="size-3" />
      <span>Needs Review</span>
    </span>
  );
}
