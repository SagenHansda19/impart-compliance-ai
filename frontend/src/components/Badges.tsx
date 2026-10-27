import type { Assessment, Effective } from "../types";

export const STATUS_LABEL: Record<Effective, string> = {
  compliant: "Compliant",
  non_compliant: "Non-compliant",
  needs_review: "Needs review",
};

export const CONCLUSION_FOR: Record<Effective, string> = {
  compliant: "Proceed",
  non_compliant: "Do Not Proceed",
  needs_review: "Needs Review",
};

export function statusClasses(s: Effective) {
  return s === "non_compliant"
    ? "dark:bg-rose-950/70 bg-rose-50 dark:text-rose-300 text-rose-700 dark:border-rose-500/40 border-rose-300"
    : s === "compliant"
    ? "dark:bg-emerald-950/70 bg-emerald-50 dark:text-emerald-300 text-emerald-700 dark:border-emerald-500/40 border-emerald-300"
    : "dark:bg-amber-950/70 bg-amber-50 dark:text-amber-300 text-amber-700 dark:border-amber-500/40 border-amber-300";
}

export function OverallBadge({
  value,
}: {
  value: Assessment["overall_conclusion"] | string | null;
}) {
  if (!value) {
    return (
      <span className="rounded border dark:border-slate-700 border-slate-300 dark:bg-slate-800/80 bg-slate-100 px-2 py-0.5 text-[11px] dark:text-slate-400 text-slate-600">
        No result
      </span>
    );
  }

  const cls =
    value === "Do Not Proceed"
      ? "dark:bg-rose-950/80 bg-rose-50 dark:text-rose-300 text-rose-700 dark:border-rose-500/40 border-rose-300 shadow-xs"
      : value === "Proceed"
      ? "dark:bg-emerald-950/80 bg-emerald-50 dark:text-emerald-300 text-emerald-700 dark:border-emerald-500/40 border-emerald-300 shadow-xs"
      : "dark:bg-amber-950/80 bg-amber-50 dark:text-amber-300 text-amber-700 dark:border-amber-500/40 border-amber-300 shadow-xs";

  return (
    <span className={`rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${cls}`}>
      {value}
    </span>
  );
}

export function RegChip({ reg, status }: { reg: string; status: Effective }) {
  return (
    <span
      className={`rounded border px-1.5 py-0.5 font-mono text-[10px] font-semibold ${statusClasses(
        status
      )}`}
      title={STATUS_LABEL[status]}
    >
      {reg}
    </span>
  );
}
