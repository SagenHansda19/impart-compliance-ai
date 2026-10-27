import { useState, type FormEvent, type KeyboardEvent } from "react";
import { ArrowPathIcon, SparklesIcon, TrashIcon } from "./Icons";

const SAMPLES = [
  {
    id: "cr1",
    label: "CR 1: Package ID 20-char",
    text: "The regulation must accommodate package identifiers up to 20 characters long.",
  },
  {
    id: "cr6",
    label: "CR 6: Separate IM/VM Margins",
    text: "We are introducing separate collateral portfolios for initial margin and variation margin for all OTC derivative transactions. Kindly verify if our current reporting format can accommodate separate initial and variation margin collateral portfolio codes across all regimes.",
  },
  {
    id: "cr8",
    label: "CR 8: Delegated Reporting",
    text: "Under the EMIR Refit framework, financial counterparties (FCs) are legally liable for reporting over-the-counter (OTC) derivative contracts on behalf of themselves and non-financial counterparty minus (NFC-) clients. It is called mandatory delegated reporting. Some banks also provide voluntary delegated reporting service for their clients even though they are not liable to report on behalf of their clients as per the regulation. As a global bank, we need to be able to support both mandatory and voluntary delegated reporting functionalities.",
  },
  {
    id: "cr17",
    label: "CR 17: Bond Connect FX Spot",
    text: "Implement support for reporting foreign exchange conversion activities and repo operations under the Bond Connect scheme. These transactions are treated as OTC derivatives with product description BONDCONNECT.",
  },
  {
    id: "cr21",
    label: "CR 21: Package Identifier 35-char",
    text: "Package ids will be built to be exactly 35 characters long. Kindly check whether our trade reporting pipeline can safely send this field across all five regulators.",
  },
];

const JURISDICTIONS = [
  { code: "EMIR", flag: "🇪🇺", label: "EMIR", region: "EMEA" },
  { code: "UKEMIR", flag: "🇬🇧", label: "UK EMIR", region: "EMEA" },
  { code: "ASIC", flag: "🇦🇺", label: "ASIC", region: "APAC" },
  { code: "MAS", flag: "🇸🇬", label: "MAS", region: "APAC" },
  { code: "HKMA", flag: "🇭🇰", label: "HKMA", region: "APAC" },
];

interface InputWorkbenchProps {
  busy: boolean;
  onSubmit: (text: string) => void;
  selectedRegs: string[];
  onToggleReg: (code: string) => void;
  onSelectAllRegs: () => void;
}

export function InputWorkbench({
  busy,
  onSubmit,
  selectedRegs,
  onToggleReg,
  onSelectAllRegs,
}: InputWorkbenchProps) {
  const [text, setText] = useState("");

  const handleSubmit = (e?: FormEvent) => {
    e?.preventDefault();
    if (busy) return;
    onSubmit(text);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const loadSample = (sampleText: string) => {
    setText(sampleText);
  };

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/90 shadow-xl shadow-black/20 flex flex-col h-full overflow-hidden">
      {/* Workbench Header */}
      <div className="border-b border-slate-800/80 px-5 py-3.5 bg-slate-900/50 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex size-6 items-center justify-center rounded-md bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
            <SparklesIcon className="size-3.5" />
          </div>
          <div>
            <h2 className="text-[13px] font-semibold text-slate-100">
              Change Request Workbench
            </h2>
            <p className="text-[11px] text-slate-400">
              Input business, technical, or lifecycle changes in plain English
            </p>
          </div>
        </div>
        {text && (
          <button
            type="button"
            onClick={() => setText("")}
            className="text-[11px] text-slate-400 hover:text-rose-400 flex items-center gap-1 cursor-pointer transition-colors"
            title="Clear input"
          >
            <TrashIcon className="size-3" />
            <span>Clear</span>
          </button>
        )}
      </div>

      <div className="p-5 flex-1 flex flex-col gap-4">
        {/* Sample Prompt Auto-Fill Chips */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">
              Quick Test Cases & Prompts
            </span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {SAMPLES.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => loadSample(s.text)}
                disabled={busy}
                className="cursor-pointer rounded-md bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700/70 px-2 py-1 text-[11px] text-slate-300 hover:text-white transition-all duration-150 disabled:opacity-50"
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        {/* Change Request Input Box */}
        <div className="flex-1 flex flex-col min-h-[180px]">
          <label htmlFor="cr-input" className="sr-only">
            Type the change request
          </label>
          <div className="relative flex-1 flex flex-col">
            <textarea
              id="cr-input"
              aria-label="Type the change request"
              rows={8}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={busy}
              placeholder="Type the change request in plain English or specification format... (Press Enter to submit, Shift+Enter for newline)"
              className="w-full flex-1 rounded-lg border border-slate-700/80 bg-slate-950/80 p-3.5 text-[13px] font-sans text-slate-100 placeholder:text-slate-500 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 focus:outline-none transition-all resize-none shadow-inner leading-relaxed"
            />
            <div className="absolute bottom-2.5 right-3 flex items-center gap-2 text-[10px] text-slate-500 font-mono pointer-events-none">
              <span>{text.length} chars</span>
              <span>·</span>
              <span>Enter to assess · Shift+Enter for newline</span>
            </div>
          </div>
        </div>

        {/* Regulatory Jurisdiction Selector Pills */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">
              Target Jurisdictions
            </span>
            <button
              type="button"
              onClick={onSelectAllRegs}
              className="text-[10px] text-emerald-400 hover:text-emerald-300 font-medium cursor-pointer"
            >
              Select All (5)
            </button>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {JURISDICTIONS.map((j) => {
              const isSelected = selectedRegs.includes(j.code);
              return (
                <button
                  key={j.code}
                  type="button"
                  onClick={() => onToggleReg(j.code)}
                  className={`cursor-pointer rounded-lg border p-2 flex items-center justify-between text-left transition-all duration-150 ${
                    isSelected
                      ? "border-emerald-500/40 bg-emerald-950/30 text-emerald-300 shadow-xs ring-1 ring-emerald-500/20"
                      : "border-slate-800 bg-slate-950/40 text-slate-400 hover:border-slate-700 hover:text-slate-200"
                  }`}
                >
                  <div className="flex items-center gap-1.5">
                    <span className="text-[13px]">{j.flag}</span>
                    <span className="text-[11px] font-semibold">{j.label}</span>
                  </div>
                  <span
                    className={`size-2 rounded-full ${
                      isSelected ? "bg-emerald-400" : "bg-slate-700"
                    }`}
                  />
                </button>
              );
            })}
          </div>
        </div>

        {/* Primary Action Button */}
        <div className="pt-2">
          <button
            type="button"
            onClick={() => handleSubmit()}
            disabled={busy}
            className="w-full cursor-pointer flex items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:from-slate-800 disabled:to-slate-800 disabled:text-slate-500 disabled:cursor-not-allowed px-4 py-3 text-[13px] font-semibold text-white shadow-lg shadow-emerald-950/40 transition-all duration-200 active:scale-[0.99]"
          >
            {busy ? (
              <>
                <ArrowPathIcon className="size-4 animate-spin" />
                <span>Auditing Multi-Regime Compliance...</span>
              </>
            ) : (
              <>
                <SparklesIcon className="size-4" />
                <span>Assess impact</span>
              </>
            )}
          </button>
          <p className="mt-2 text-center text-[11px] text-slate-500">
            Powered by Unified Multi-Regime LLM & pgvector Dense HNSW Search (&lt;10ms)
          </p>
        </div>
      </div>
    </div>
  );
}
