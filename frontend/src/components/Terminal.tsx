import { useEffect, useRef, useState } from "react";
import { DocumentTextIcon, SparklesIcon } from "./Icons";

interface Props {
  busy: boolean;
  onSubmit: (text: string) => void;
  hasResult?: boolean;
}

const SAMPLE_CRS = [
  {
    title: "Event Timestamp Format",
    regimes: "EMIR · ASIC · MAS",
    description: "Update the event timestamp reporting field to capture exact date and time in UTC format YYYY-MM-DDThh:mm:ss.sssZ.",
    text: "The booking system will produce event timestamps in ISO 8601 UTC format YYYY-MM-DDThh:mm:ss.sssZ across all derivative trade events.",
  },
  {
    title: "Swap Price Decimal Precision",
    regimes: "EMIR Refit · UK EMIR",
    description: "Extend price field representation to 10 decimal places for OTC interest rate and credit derivatives.",
    text: "The booking system will produce swap contract prices to 10 decimal places across OTC interest rate and credit derivatives.",
  },
  {
    title: "Collateral Portfolio Identifier",
    regimes: "ESMA · Technical Standards",
    description: "Set collateral portfolio code to an alphanumeric identifier of 52 characters for uncleared transactions.",
    text: "Set collateral portfolio code to an alphanumeric identifier of 52 characters for all uncleared OTC transactions.",
  },
  {
    title: "UPI Product Identifier (CDE)",
    regimes: "Global CDE · ISO 20022",
    description: "Mandate Unique Product Identifier (UPI) populated with 12-character ANPA code for commodity derivatives.",
    text: "Add Unique Product Identifier (UPI) reporting field populated with 12-character ANPA code for all commodity derivatives.",
  },
];

const REGULATORY_FRAMEWORKS = [
  {
    flag: "🇪🇺",
    code: "EMIR",
    name: "European Union",
    authority: "ESMA Refit",
    focus: "ISO 20022 XML, CDE alignment, and dual-sided OTC reporting rules.",
  },
  {
    flag: "🇬🇧",
    code: "UK EMIR",
    name: "United Kingdom",
    authority: "FCA / Bank of England",
    focus: "UK validation rules, technical standards, and post-Brexit tolerances.",
  },
  {
    flag: "🇦🇺",
    code: "ASIC",
    name: "Australia",
    authority: "ASIC Rules 2024",
    focus: "Part 2.2 derivative transaction rules and lifecycle reporting guidance.",
  },
  {
    flag: "🇸🇬",
    code: "MAS",
    name: "Singapore",
    authority: "Monetary Authority (MAS)",
    focus: "Securities and Futures (Reporting of Derivatives Contracts) Regulations.",
  },
  {
    flag: "🇭🇰",
    code: "HKMA",
    name: "Hong Kong",
    authority: "HKMA / SFC",
    focus: "OTC derivatives trade repository specifications and validation tables.",
  },
];

/** Professional Change Request Terminal: type the change request, press Enter or click Assess impact. */
export function Terminal({ busy, onSubmit, hasResult = false }: Props) {
  const [text, setText] = useState("");
  const last = useRef("");
  const ta = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = ta.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 220)}px`;
  }, [text]);

  const run = () => {
    if (busy) return;
    last.current = text;
    onSubmit(text);
  };

  const loadSample = (sampleText: string) => {
    setText(sampleText);
    if (ta.current) {
      ta.current.focus();
    }
  };

  return (
    <div className="space-y-6">
      <section aria-label="Change request" className="rounded-xl border border-slate-200/90 bg-white p-5 shadow-xs">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex size-7 items-center justify-center rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200/60">
              <DocumentTextIcon className="size-4" />
            </div>
            <div>
              <h2 className="text-[14px] font-semibold text-slate-900">Change Request Specification</h2>
              <p className="text-[11px] text-slate-500">
                Enter business, architectural, or technical changes in plain English or specification format.
              </p>
            </div>
          </div>
          <span className="hidden sm:inline-block rounded-md bg-slate-100 px-2 py-0.5 font-mono text-[11px] text-slate-600">
            Shift+Enter for newline
          </span>
        </div>

        {/* Modern, high-trust editor card (Not harsh neon green) */}
        <div className="rounded-lg border border-slate-800 bg-slate-950 p-4 font-mono text-[13px] text-slate-100 shadow-md focus-within:ring-2 focus-within:ring-emerald-500 focus-within:border-emerald-500 transition-all duration-200">
          <div className="flex gap-3">
            <span aria-hidden className="select-none pt-0.5 font-bold text-slate-500">cr&gt;</span>
            <textarea
              ref={ta}
              value={text}
              rows={3}
              autoFocus
              spellCheck={false}
              aria-label="Type the change request and press Enter"
              placeholder="Describe the proposed change (e.g. 'The booking system will produce swap contract prices to 10 decimal places')..."
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  run();
                } else if (e.key === "ArrowUp" && text === "" && last.current) {
                  e.preventDefault();
                  setText(last.current);
                }
              }}
              className="min-h-[4.5rem] w-full resize-none bg-transparent leading-relaxed text-slate-100 caret-emerald-400 outline-none focus-visible:outline-none placeholder:text-slate-500"
            />
          </div>

          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-slate-800/80 pt-2.5 text-[11px]">
            <div>
              {busy ? (
                <span role="status" className="flex items-center gap-2 font-sans font-medium text-emerald-400">
                  <span className="size-2 animate-ping rounded-full bg-emerald-400" />
                  <span className="animate-pulse">Assessing against 5 regulatory regimes...</span>
                </span>
              ) : (
                <span className="font-sans text-slate-400">
                  Press Enter or click Assess impact to begin automated multi-regime audit
                </span>
              )}
            </div>

            <div className="flex items-center gap-3">
              <span className="font-mono text-[10px] text-slate-500">{text.length} characters</span>
              <button
                type="button"
                onClick={run}
                disabled={busy}
                className="inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-md bg-emerald-600 px-4 py-1.5 font-sans text-[12px] font-semibold text-white shadow-xs hover:bg-emerald-700 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 transition-all duration-150"
              >
                {busy ? (
                  <span>Evaluating...</span>
                ) : (
                  <>
                    <SparklesIcon className="size-3.5" />
                    <span>Assess impact</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Helpful Workspace Content when no result is displayed (Fills the empty space below!) */}
      {!hasResult && (
        <div className="space-y-6">
          {/* Sample Change Requests */}
          <section className="rounded-xl border border-slate-200/90 bg-white p-5 shadow-xs">
            <div className="mb-3.5 flex items-center justify-between">
              <div>
                <h3 className="text-[13px] font-semibold text-slate-900">Try Sample Change Requests</h3>
                <p className="text-[11px] text-slate-500">
                  Select a test case to pre-fill the specification and verify cross-border compliance.
                </p>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {SAMPLE_CRS.map((sample, idx) => (
                <div
                  key={idx}
                  onClick={() => loadSample(sample.text)}
                  className="group flex flex-col justify-between cursor-pointer rounded-lg border border-slate-200 bg-slate-50/50 p-3.5 hover:border-emerald-500/50 hover:bg-emerald-50/30 hover:shadow-2xs active:scale-[0.99] transition-all"
                >
                  <div>
                    <div className="flex items-center justify-between gap-1">
                      <span className="font-semibold text-[12px] text-slate-900 group-hover:text-emerald-800 transition-colors">
                        {sample.title}
                      </span>
                    </div>
                    <span className="mt-1 inline-block rounded bg-slate-200/70 px-1.5 py-0.2 font-mono text-[9px] text-slate-700">
                      {sample.regimes}
                    </span>
                    <p className="mt-2 text-[11px] text-slate-600 leading-snug">
                      {sample.description}
                    </p>
                  </div>
                  <div className="mt-3 pt-2 border-t border-slate-200/60 text-[10px] font-semibold text-emerald-700 group-hover:underline">
                    Load into prompt &rarr;
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Supported Regulatory Frameworks */}
          <section className="rounded-xl border border-slate-200/90 bg-white p-5 shadow-xs">
            <h3 className="text-[13px] font-semibold text-slate-900 mb-1">
              Active Regulatory Rulebooks in Knowledge Base
            </h3>
            <p className="text-[11px] text-slate-500 mb-3.5">
              Continuously ground evaluations against ingested PDF technical standards, validation tables, and code lists.
            </p>

            <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
              {REGULATORY_FRAMEWORKS.map((reg) => (
                <div key={reg.code} className="rounded-lg border border-slate-200 bg-slate-50/30 p-3 text-left">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xl">{reg.flag}</span>
                    <span className="font-mono font-bold text-[12px] text-slate-900">{reg.code}</span>
                  </div>
                  <div className="mt-0.5 text-[10px] font-medium text-emerald-800">{reg.authority}</div>
                  <p className="mt-1.5 text-[10px] text-slate-600 leading-snug">{reg.focus}</p>
                </div>
              ))}
            </div>
          </section>

          {/* How It Works 3-Step Process */}
          <section className="rounded-xl border border-slate-200/90 bg-slate-50/80 p-5 shadow-xs">
            <h3 className="text-[13px] font-semibold text-slate-900 mb-3">
              Automated Compliance Workflow
            </h3>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-lg border border-slate-200 bg-white p-3.5">
                <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] font-bold text-slate-700">01</span>
                <h4 className="mt-2 text-[12px] font-semibold text-slate-900">Atomic Decomposition</h4>
                <p className="mt-1 text-[11px] text-slate-600">
                  Breaks complex business requirements into verifiable technical constraints and identifies any ambiguity.
                </p>
              </div>

              <div className="rounded-lg border border-slate-200 bg-white p-3.5">
                <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] font-bold text-slate-700">02</span>
                <h4 className="mt-2 text-[12px] font-semibold text-slate-900">Hybrid pgvector Retrieval</h4>
                <p className="mt-1 text-[11px] text-slate-600">
                  Combines 768-dim dense embeddings with PostgreSQL full-text search, reranked by cross-encoder models.
                </p>
              </div>

              <div className="rounded-lg border border-slate-200 bg-white p-3.5">
                <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] font-bold text-slate-700">03</span>
                <h4 className="mt-2 text-[12px] font-semibold text-slate-900">Consensus & Rule Verification</h4>
                <p className="mt-1 text-[11px] text-slate-600">
                  Multi-vote LLM judge evaluates regulatory compliance with direct citations; Python engine enforces numeric constraints.
                </p>
              </div>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
