import { useEffect } from "react";
import { SparklesIcon, DocumentTextIcon, CpuChipIcon, GlobeAltIcon } from "./Icons";

interface DocsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function DocsModal({ isOpen, onClose }: DocsModalProps) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (isOpen) {
      window.addEventListener("keydown", handleKeyDown);
      return () => window.removeEventListener("keydown", handleKeyDown);
    }
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="docs-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-3xl max-h-[85vh] flex flex-col rounded-2xl border dark:border-slate-800 border-slate-200 dark:bg-slate-900 bg-white shadow-2xl overflow-hidden text-slate-800 dark:text-slate-100 animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b dark:border-slate-800 border-slate-200 dark:bg-slate-950/60 bg-slate-50/80">
          <div className="flex items-center gap-2.5">
            <div className="flex size-7 items-center justify-center rounded-lg bg-emerald-600 text-white font-bold text-xs shadow-xs">
              <SparklesIcon className="size-4" />
            </div>
            <div>
              <h2 id="docs-modal-title" className="text-sm font-bold tracking-tight dark:text-white text-slate-900">
                IMPART AI — System Documentation & Engine Architecture
              </h2>
              <div className="text-[11px] dark:text-slate-400 text-slate-500 font-mono">
                Cross-Border Derivatives Regulatory Compliance Engine
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="cursor-pointer dark:text-slate-400 text-slate-500 hover:text-white dark:hover:bg-slate-800 hover:bg-slate-200 p-1.5 rounded-lg transition-colors text-xs"
            aria-label="Close modal"
          >
            ✕
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6 text-[13px] leading-relaxed">
          {/* Section 1: Overview */}
          <section className="space-y-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 flex items-center gap-2">
              <GlobeAltIcon className="size-4" />
              Supported Regulatory Frameworks
            </h3>
            <p className="dark:text-slate-300 text-slate-600">
              IMPART continuously indexes and cross-validates OTC derivatives reporting rulebooks across 5 jurisdictions with 13 official database catalogs:
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
              <div className="p-3 rounded-xl border dark:border-slate-800 border-slate-200 dark:bg-slate-950/60 bg-slate-50">
                <div className="font-bold text-xs dark:text-white text-slate-900 flex items-center gap-1.5">
                  <span>🇪🇺</span> <span>EMIR / EMIR Refit (ESMA)</span>
                </div>
                <div className="text-[11px] dark:text-slate-400 text-slate-500 mt-1 font-mono">
                  3,175 legal chunks · 203 field specs · 215 validation rules
                </div>
              </div>

              <div className="p-3 rounded-xl border dark:border-slate-800 border-slate-200 dark:bg-slate-950/60 bg-slate-50">
                <div className="font-bold text-xs dark:text-white text-slate-900 flex items-center gap-1.5">
                  <span>🇬🇧</span> <span>UK EMIR (FCA / Bank of England)</span>
                </div>
                <div className="text-[11px] dark:text-slate-400 text-slate-500 mt-1 font-mono">
                  381 legal chunks · 205 field specs · 408 validation rules
                </div>
              </div>

              <div className="p-3 rounded-xl border dark:border-slate-800 border-slate-200 dark:bg-slate-950/60 bg-slate-50">
                <div className="font-bold text-xs dark:text-white text-slate-900 flex items-center gap-1.5">
                  <span>🇦🇺</span> <span>ASIC Derivative Transaction Rules</span>
                </div>
                <div className="text-[11px] dark:text-slate-400 text-slate-500 mt-1 font-mono">
                  1,004 legal chunks · 226 field specs · 164 validation rules
                </div>
              </div>

              <div className="p-3 rounded-xl border dark:border-slate-800 border-slate-200 dark:bg-slate-950/60 bg-slate-50">
                <div className="font-bold text-xs dark:text-white text-slate-900 flex items-center gap-1.5">
                  <span>🇸🇬</span> <span>MAS SFA 04-N12 / 04-N14</span>
                </div>
                <div className="text-[11px] dark:text-slate-400 text-slate-500 mt-1 font-mono">
                  1,032 legal chunks · 217 field specs
                </div>
              </div>

              <div className="p-3 rounded-xl border dark:border-slate-800 border-slate-200 dark:bg-slate-950/60 bg-slate-50 sm:col-span-2">
                <div className="font-bold text-xs dark:text-white text-slate-900 flex items-center gap-1.5">
                  <span>🇭🇰</span> <span>HKMA / SFC OTC Reporting Standards</span>
                </div>
                <div className="text-[11px] dark:text-slate-400 text-slate-500 mt-1 font-mono">
                  507 legal chunks · 496 field specs
                </div>
              </div>
            </div>
          </section>

          {/* Section 2: Retrieval & Decomposition Engine */}
          <section className="space-y-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 flex items-center gap-2">
              <CpuChipIcon className="size-4" />
              Engine Pipeline & pgvector Provenance
            </h3>
            <p className="dark:text-slate-300 text-slate-600">
              When an enterprise Change Request (CR) is evaluated:
            </p>
            <ol className="list-decimal pl-5 space-y-1 dark:text-slate-300 text-slate-600 text-[12px]">
              <li>
                <strong>Atomic Decomposition:</strong> The model extracts discrete regulatory assertions (<code className="px-1 py-0.5 rounded bg-slate-200 dark:bg-slate-800 font-mono text-[11px]">R1, R2...</code>) and maps concepts like timestamps, identifiers, and collateral tiers.
              </li>
              <li>
                <strong>Multi-Regime Vector Retrieval:</strong> Sub-10ms PostgreSQL 16 + pgvector cosine similarity search locates exact field specs and legal clauses across all jurisdictions simultaneously.
              </li>
              <li>
                <strong>Multi-Model Fallback:</strong> Automatic retry with exponential backoff and rotation between high-accuracy models (OpenAI GPT-OSS, Qwen, DeepSeek, LLaMA) prevents rate limit interruptions.
              </li>
              <li>
                <strong>Verbatim Citation Extraction:</strong> Verbatim text quotes are matched against official Excel and PDF rulebooks with verified source rows.
              </li>
            </ol>
          </section>

          {/* Section 3: Usage & Shortcuts */}
          <section className="space-y-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 flex items-center gap-2">
              <DocumentTextIcon className="size-4" />
              Keyboard Shortcuts & Interaction Guide
            </h3>
            <div className="space-y-1.5 text-[12px] font-mono dark:text-slate-300 text-slate-600">
              <div className="flex items-center justify-between p-2 rounded-lg dark:bg-slate-950/50 bg-slate-100 border dark:border-slate-800/80 border-slate-200">
                <span>Submit Change Request</span>
                <kbd className="px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-800 font-bold text-xs">Enter</kbd>
              </div>
              <div className="flex items-center justify-between p-2 rounded-lg dark:bg-slate-950/50 bg-slate-100 border dark:border-slate-800/80 border-slate-200">
                <span>Insert Newline in Textarea</span>
                <kbd className="px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-800 font-bold text-xs">Shift + Enter</kbd>
              </div>
              <div className="flex items-center justify-between p-2 rounded-lg dark:bg-slate-950/50 bg-slate-100 border dark:border-slate-800/80 border-slate-200">
                <span>Close Drawer / Modal</span>
                <kbd className="px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-800 font-bold text-xs">Esc</kbd>
              </div>
            </div>
          </section>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t dark:border-slate-800 border-slate-200 dark:bg-slate-950/80 bg-slate-50 flex items-center justify-between text-xs">
          <span className="dark:text-slate-500 text-slate-400 font-mono text-[11px]">
            IMPART Engine v2.0 · Decision Support System
          </span>
          <button
            type="button"
            onClick={onClose}
            className="cursor-pointer rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white px-3.5 py-1.5 font-semibold transition-colors"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}
