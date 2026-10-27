import { useState, useRef, useEffect } from "react";
import { DocumentTextIcon, CopyIcon, SparklesIcon } from "./Icons";

export interface CitationBadgeProps {
  citation: string;
  snippet?: string | null;
  regulation?: string;
  className?: string;
  onClickInspect?: () => void;
}

/**
 * Format a raw citation into a sleek [Doc : Locator] badge pill
 * Examples:
 * - "emir_field_specifications.xlsx, Sheet: Field Specifications, Row 174" -> "[EMIR Specs : Row 174]"
 * - "ASIC Derivative Transaction Rules 2024, Rule 2.2.1" -> "[ASIC Reg 2024 : Rule 2.2.1]"
 * - "Regulation (EU) 2019/834 (EMIR REFIT), Article 9" -> "[EMIR REFIT : Art 9]"
 */
export function formatCitationPill(citation: string): string {
  if (!citation) return "";
  const trimmed = citation.trim();

  // If already bracketed like [ASIC Reg 2024 : Row 23], return as-is
  if (trimmed.startsWith("[") && trimmed.endsWith("]")) return trimmed;

  // Match Excel sheet/row pattern: "emir_field_specifications.xlsx, Sheet: ..., Row 174"
  const excelMatch = trimmed.match(
    /^([^,]+?)(?:\.xlsx|\.csv|\.pdf|\.docx)?(?:,\s*Sheet:\s*[^,]+)?,\s*(Row\s*\d+|Field\s*[\d\.]+|Art(?:icle)?\s*[\d\.]+|Rule\s*[\d\.]+|Section\s*[\d\.]+)/i
  );
  if (excelMatch) {
    const rawDoc = excelMatch[1].trim();
    const loc = excelMatch[2].trim();
    const docClean = rawDoc
      .replace(/_field_specifications/i, " Specs")
      .replace(/_/g, " ")
      .replace(/\b([a-z])/g, (c) => c.toUpperCase());
    return `[${docClean} : ${loc}]`;
  }

  // Match general comma or colon separation: "ASIC Reg 2024, Rule 2.2.1"
  const commaMatch = trimmed.match(/^([^,:]+)[,:](?:\s*Sheet:[^,]+,)?\s*(.+)$/i);
  if (commaMatch) {
    const doc = commaMatch[1]
      .replace(/\.xlsx|\.pdf|\.docx/gi, "")
      .replace(/_/g, " ")
      .trim();
    const loc = commaMatch[2].replace(/Sheet:\s*[^,]+,\s*/i, "").trim();
    return `[${doc} : ${loc}]`;
  }

  return `[${trimmed}]`;
}

export function CitationBadge({
  citation,
  snippet,
  regulation,
  className = "",
  onClickInspect,
}: CitationBadgeProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [copied, setCopied] = useState(false);
  const containerRef = useRef<HTMLSpanElement>(null);

  const pillText = formatCitationPill(citation);
  const showPopover = isOpen || isHovered;

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isOpen]);

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const textToCopy = snippet ? `${citation}\n\n“${snippet}”` : citation;
    try {
      await navigator.clipboard.writeText(textToCopy);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  };

  if (!citation) return null;

  return (
    <span
      ref={containerRef}
      className={`relative inline-block align-middle ${className}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Sleek inline badge pill */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
        aria-haspopup="dialog"
        aria-expanded={showPopover}
        className="group cursor-pointer inline-flex items-center gap-1.5 bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-750 border border-slate-700/50 hover:border-emerald-500/40 px-2 py-0.5 rounded text-xs font-mono transition-all duration-150 shadow-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
        title="Click to view verbatim pgvector snippet"
      >
        <DocumentTextIcon className="size-3 text-emerald-400 group-hover:scale-110 transition-transform shrink-0" />
        <span className="font-semibold tracking-tight">{pillText}</span>
        {/* Full citation included in DOM for test assertions & screen readers */}
        <span className="sr-only">{citation}</span>
      </button>

      {/* Floating Tooltip / Modal Popover */}
      {showPopover && (
        <div
          role="dialog"
          aria-label="Citation Details"
          className="absolute z-50 bottom-full left-0 mb-2 w-80 sm:w-96 rounded-xl border border-slate-700/80 bg-slate-900/98 p-4 shadow-2xl shadow-black/80 backdrop-blur-md text-left text-slate-200 text-xs animate-in fade-in zoom-in-95 duration-150"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Popover Header */}
          <div className="flex items-center justify-between pb-2.5 border-b border-slate-800">
            <div className="flex items-center gap-1.5 font-bold text-white text-[12px]">
              <SparklesIcon className="size-3.5 text-emerald-400" />
              <span>pgvector Verbatim Chunk</span>
              {regulation && (
                <span className="rounded bg-slate-800 border border-slate-700 px-1.5 py-0.2 font-mono text-[10px] text-slate-300 ml-1">
                  {regulation}
                </span>
              )}
            </div>

            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                setIsHovered(false);
              }}
              className="cursor-pointer text-slate-400 hover:text-white p-1 rounded hover:bg-slate-800 transition-colors text-xs"
              title="Close popover"
            >
              ✕
            </button>
          </div>

          {/* Exact Verbatim Snippet from pgvector */}
          <div className="my-3">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1 flex items-center justify-between">
              <span>Verified Rulebook Excerpt</span>
              {snippet && (
                <span className="text-[10px] text-emerald-400 font-mono">
                  ✓ Vector Match
                </span>
              )}
            </div>
            {snippet ? (
              <blockquote className="rounded-lg bg-slate-950/80 border-l-2 border-emerald-500/60 p-2.5 font-mono text-[11px] text-slate-200 leading-relaxed italic max-h-48 overflow-y-auto whitespace-pre-wrap">
                “{snippet}”
              </blockquote>
            ) : (
              <div className="rounded-lg bg-slate-950/60 p-2.5 font-mono text-[11px] text-slate-400 italic">
                Exact text segment linked at {pillText}. Open Audit Drawer for chunk decomposition.
              </div>
            )}
          </div>

          {/* Full Official Source Citation Path */}
          <div className="pt-2 border-t border-slate-800/80">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-0.5">
              Official Source Path
            </div>
            <div className="font-mono text-[11px] text-slate-300 break-words bg-slate-950/50 p-1.5 rounded border border-slate-800/60 select-all">
              {citation}
            </div>
          </div>

          {/* Popover Actions */}
          <div className="mt-3 flex items-center justify-between pt-2 border-t border-slate-800/60 text-[11px]">
            <button
              type="button"
              onClick={handleCopy}
              className="cursor-pointer inline-flex items-center gap-1.5 rounded-lg bg-slate-800 hover:bg-slate-750 border border-slate-700 px-2.5 py-1 text-slate-300 hover:text-white transition-colors"
            >
              <CopyIcon className="size-3" />
              <span>{copied ? "Copied!" : "Copy Snippet"}</span>
            </button>

            {onClickInspect && (
              <button
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  setIsHovered(false);
                  onClickInspect();
                }}
                className="cursor-pointer inline-flex items-center gap-1 text-emerald-400 hover:text-emerald-300 font-medium transition-colors"
              >
                <span>Deep Audit</span>
                <span>&rarr;</span>
              </button>
            )}
          </div>
        </div>
      )}
    </span>
  );
}
