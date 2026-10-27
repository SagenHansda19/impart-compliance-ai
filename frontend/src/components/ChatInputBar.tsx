import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { ArrowPathIcon, SparklesIcon } from "./Icons";

interface ChatInputBarProps {
  busy: boolean;
  onSubmit: (text: string) => void;
  selectedRegs: string[];
  onToggleReg: (code: string) => void;
  isInitialCentered?: boolean;
}

const NATURAL_SUGGESTIONS = [
  {
    label: "Package Identifier 35-char limit",
    text: "Package ids will be built to be exactly 35 characters long. Kindly check whether our trade reporting pipeline can safely send this field across all five regulators.",
  },
  {
    label: "Separate IM & VM margin portfolio codes",
    text: "We are introducing separate collateral portfolios for initial margin and variation margin for all OTC derivative transactions. Kindly verify if our current reporting format can accommodate separate initial and variation margin collateral portfolio codes across all regimes.",
  },
  {
    label: "Delegated reporting under EMIR Refit",
    text: "Under the EMIR Refit framework, financial counterparties (FCs) are legally liable for reporting over-the-counter (OTC) derivative contracts on behalf of themselves and non-financial counterparty minus (NFC-) clients. It is called mandatory delegated reporting. Some banks also provide voluntary delegated reporting service for their clients even though they are not liable to report on behalf of their clients as per the regulation. As a global bank, we need to be able to support both mandatory and voluntary delegated reporting functionalities.",
  },
  {
    label: "Bond Connect FX Spot reporting",
    text: "Implement support for reporting foreign exchange conversion activities and repo operations under the Bond Connect scheme. These transactions are treated as OTC derivatives with product description BONDCONNECT.",
  },
];

const JURISDICTIONS = [
  { code: "EMIR", flag: "🇪🇺", label: "EMIR" },
  { code: "UKEMIR", flag: "🇬🇧", label: "UK EMIR" },
  { code: "ASIC", flag: "🇦🇺", label: "ASIC" },
  { code: "MAS", flag: "🇸🇬", label: "MAS" },
  { code: "HKMA", flag: "🇭🇰", label: "HKMA" },
];

export function ChatInputBar({
  busy,
  onSubmit,
  selectedRegs,
  onToggleReg,
  isInitialCentered = false,
}: ChatInputBarProps) {
  const [text, setText] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(
        textareaRef.current.scrollHeight,
        180
      )}px`;
    }
  }, [text]);

  const handleSubmit = (e?: FormEvent) => {
    e?.preventDefault();
    if (busy) return;
    const submitted = text.trim();
    setText("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
    onSubmit(submitted);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div
      className={`w-full max-w-6xl mx-auto transition-all duration-300 ${
        isInitialCentered ? "py-4" : "sticky bottom-4 z-20"
      }`}
    >
      {/* Suggestions when empty and centered */}
      {isInitialCentered && !text && (
        <div className="mb-6 text-center">
          <div className="flex size-12 items-center justify-center rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 dark:text-emerald-400 mx-auto mb-3 shadow-inner">
            <SparklesIcon className="size-6" />
          </div>
          <h2 className="text-xl font-bold dark:text-white text-slate-900 tracking-tight">
            What regulatory change are you evaluating?
          </h2>
          <p className="mt-1.5 text-[13px] dark:text-slate-400 text-slate-600 max-w-md mx-auto">
            Enter proposed business or technical changes in plain English. The AI engine cross-checks 5 jurisdictions simultaneously.
          </p>

          <div className="mt-6 flex flex-wrap justify-center gap-2 max-w-2xl mx-auto">
            {NATURAL_SUGGESTIONS.map((s) => (
              <button
                key={s.label}
                type="button"
                onClick={() => setText(s.text)}
                className="cursor-pointer rounded-xl border dark:border-slate-800 border-slate-200 dark:bg-slate-900/80 bg-white hover:dark:bg-slate-800/90 hover:bg-slate-50 hover:dark:border-slate-700 hover:border-slate-300 px-3 py-2 text-[12px] dark:text-slate-300 text-slate-700 hover:dark:text-white hover:text-slate-900 transition-all duration-150 text-left shadow-sm"
              >
                <span>💡 {s.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Fluid Glassmorphic Input Container */}
      <form
        onSubmit={handleSubmit}
        className="rounded-2xl border dark:border-slate-800/80 border-slate-200/80 dark:bg-slate-900/40 bg-white/70 backdrop-blur-md shadow-2xl p-3.5 outline-none focus:outline-none transition-none"
      >
        <div className="relative flex items-end gap-2">
          <textarea
            ref={textareaRef}
            id="cr-input"
            aria-label="Type the change request"
            rows={isInitialCentered ? 3 : 2}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={busy}
            placeholder="Type the change request in plain English... (Press Enter to submit, Shift+Enter for newline)"
            className="w-full resize-none bg-transparent px-1.5 py-1 text-[13px] dark:text-slate-100 text-slate-900 dark:placeholder:text-slate-500 placeholder:text-slate-400 focus:outline-none focus:ring-0 outline-none border-none leading-relaxed max-h-[180px] overflow-y-auto"
          />

          <button
            type="submit"
            disabled={busy}
            className="cursor-pointer shrink-0 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-200 dark:disabled:bg-slate-800 disabled:text-slate-400 dark:disabled:text-slate-500 text-white px-3.5 py-2 flex items-center justify-center transition-colors active:scale-95 focus:outline-none focus:ring-0 outline-none"
            title="Assess impact (Enter)"
            aria-label="Assess impact"
          >
            {busy ? (
              <ArrowPathIcon className="size-4 animate-spin" />
            ) : (
              <span className="text-xs font-semibold flex items-center gap-1.5">
                <span>Assess impact</span>
                <span>↑</span>
              </span>
            )}
          </button>
        </div>

        {/* Bottom Controls Bar: Jurisdiction Selector */}
        <div className="mt-2.5 pt-2 border-t dark:border-slate-800/80 border-slate-200/80 flex flex-wrap items-center justify-between gap-2 text-[11px] dark:text-slate-400 text-slate-500">
          <div className="flex items-center gap-1.5">
            <span className="dark:text-slate-500 text-slate-400 mr-1">Regimes:</span>
            {JURISDICTIONS.map((j) => {
              const active = selectedRegs.includes(j.code);
              return (
                <button
                  key={j.code}
                  type="button"
                  onClick={() => onToggleReg(j.code)}
                  className={`cursor-pointer rounded-md px-2 py-0.5 font-medium transition-colors focus:outline-none focus:ring-0 outline-none ${
                    active
                      ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 font-semibold"
                      : "dark:bg-slate-800/40 bg-slate-100 dark:text-slate-400 text-slate-600 border dark:border-slate-800 border-slate-200 hover:dark:text-slate-200 hover:text-slate-900"
                  }`}
                >
                  <span className="mr-1">{j.flag}</span>
                  <span>{j.label}</span>
                </button>
              );
            })}
          </div>

          <div className="text-[10px] text-slate-500 font-mono hidden sm:inline-block">
            <span>Enter to send · Shift+Enter for newline</span>
          </div>
        </div>
      </form>
    </div>
  );
}
