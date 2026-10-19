import type { Assessment, Effective } from "../types";

export const STATUS_LABEL: Record<Effective, string> = { compliant: "Compliant", non_compliant: "Non-compliant", needs_review: "Needs review" };
export const CONCLUSION_FOR: Record<Effective, string> = { compliant: "Proceed", non_compliant: "Do Not Proceed", needs_review: "Needs Review" };

export function statusClasses(s: Effective) {
  return s === "non_compliant"
    ? "bg-no-bg text-no-ink border-no-line"
    : s === "compliant"
      ? "bg-yes-bg text-yes-ink border-yes-line"
      : "bg-rev-bg text-rev-ink border-rev-line";
}

export function OverallBadge({ value }: { value: Assessment["overall_conclusion"] | string | null }) {
  if (!value) return <span className="rounded border border-line px-1.5 py-0.5 text-[11px] text-sub">No result</span>;
  const cls = value === "Do Not Proceed" ? "bg-no-bg text-no-ink border-no-line" : value === "Proceed" ? "bg-yes-bg text-yes-ink border-yes-line" : "bg-rev-bg text-rev-ink border-rev-line";
  return <span className={`rounded border px-1.5 py-0.5 text-[11px] font-semibold ${cls}`}>{value}</span>;
}

export function RegChip({ reg, status }: { reg: string; status: Effective }) {
  return <span className={`rounded border px-1.5 py-0.5 font-mono text-[10px] ${statusClasses(status)}`} title={STATUS_LABEL[status]}>{reg}</span>;
}
