import { useCallback, useEffect, useState } from "react";
import { listAssessments } from "../api";
import type { Summary } from "../types";
import { ErrorBox } from "./ErrorBox";
import { OverallBadge, RegChip } from "./Badges";

const FILTERS = ["", "Do Not Proceed", "Needs Review", "Proceed"];

export function History({ onOpen }: { onOpen: (id: string) => void }) {
  const [items, setItems] = useState<Summary[]>([]);
  const [total, setTotal] = useState(0);
  const [overall, setOverall] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);

  const load = useCallback(
    async (offset: number, reset: boolean) => {
      setLoading(true);
      setError(null);
      try {
        const p = await listAssessments({ overall: overall || undefined, offset });
        setItems((cur) => (reset ? p.items : [...cur, ...p.items]));
        setTotal(p.total);
      } catch (e) {
        setError(e);
      } finally {
        setLoading(false);
      }
    },
    [overall]
  );

  useEffect(() => {
    void load(0, true);
  }, [load]);

  return (
    <section
      aria-label="Audit History"
      className="rounded-2xl border dark:border-slate-800/80 border-slate-200/80 dark:bg-slate-900/40 bg-white/70 backdrop-blur-md p-5 sm:p-6 shadow-2xl"
    >
      <div className="mb-4 flex items-center justify-between pb-3 border-b dark:border-slate-800 border-slate-200">
        <div>
          <h2 className="text-[14px] font-bold dark:text-white text-slate-900 flex items-center gap-2">
            Audit Assessment History
            <span className="rounded-full dark:bg-slate-800 bg-slate-100 px-2 py-0.5 font-mono text-[11px] dark:text-slate-400 text-slate-600">
              {total} total
            </span>
          </h2>
          <p className="text-[11px] dark:text-slate-400 text-slate-500 mt-0.5">
            Historical regulatory change evaluations and cross-border audit trails
          </p>
        </div>

        <label className="text-[12px] dark:text-slate-400 text-slate-600 flex items-center gap-2">
          <span>Filter:</span>
          <select
            value={overall}
            onChange={(e) => setOverall(e.target.value)}
            className="cursor-pointer rounded-lg border dark:border-slate-700 border-slate-300 dark:bg-slate-800/80 bg-slate-50 px-2.5 py-1 dark:text-slate-200 text-slate-800 text-[12px] focus:outline-none focus:border-emerald-500"
          >
            {FILTERS.map((f) => (
              <option key={f} value={f}>
                {f || "All Verdicts"}
              </option>
            ))}
          </select>
        </label>
      </div>

      {error ? <ErrorBox error={error} /> : null}

      {!loading && !error && items.length === 0 && (
        <div className="py-12 text-center text-[12px] dark:text-slate-500 text-slate-400">
          No audit records found. Run an evaluation from the workstation first.
        </div>
      )}

      <ul className="divide-y dark:divide-slate-800/60 divide-slate-200">
        {items.map((s) => (
          <li key={s.id}>
            <button
              type="button"
              onClick={() => onOpen(s.id)}
              className="cursor-pointer block w-full px-3 py-3 text-left hover:dark:bg-slate-800/50 hover:bg-slate-50 rounded-lg transition-colors group"
            >
              <div className="flex items-center justify-between gap-4">
                <span className="truncate text-[13px] font-medium dark:text-slate-200 text-slate-800 group-hover:text-emerald-500 transition-colors">
                  {s.cr_preview}
                </span>
                <OverallBadge
                  value={
                    s.status === "needs_clarification"
                      ? "Needs Review"
                      : s.overall_conclusion
                  }
                />
              </div>

              <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] dark:text-slate-400 text-slate-500">
                <span className="font-mono dark:text-slate-500 text-slate-400">
                  {new Date(s.created_at).toLocaleString()}
                </span>
                {s.status !== "assessed" && (
                  <span className="rounded dark:bg-slate-800 bg-slate-100 border dark:border-slate-700 border-slate-200 px-1.5 py-0.2 font-mono text-[10px]">
                    {s.status.replace(/_/g, " ")}
                  </span>
                )}
                {s.parent_assessment_id && (
                  <span className="rounded dark:bg-emerald-950/60 bg-emerald-50 border dark:border-emerald-500/30 border-emerald-300 px-1.5 py-0.2 font-mono text-[10px] dark:text-emerald-300 text-emerald-700">
                    re-run
                  </span>
                )}
                <div className="flex items-center gap-1 ml-auto">
                  {Object.entries(s.results).map(([reg, st]) => (
                    <RegChip key={reg} reg={reg} status={st} />
                  ))}
                </div>
              </div>
            </button>
          </li>
        ))}
      </ul>

      {loading && (
        <div role="status" className="py-6 text-center text-[12px] dark:text-slate-500 text-slate-400 font-mono">
          Loading audit records...
        </div>
      )}

      {!loading && items.length < total && (
        <div className="pt-4 text-center">
          <button
            type="button"
            onClick={() => void load(items.length, false)}
            className="cursor-pointer rounded-lg border dark:border-slate-700 border-slate-300 dark:bg-slate-800 bg-slate-100 px-4 py-1.5 text-[12px] font-medium dark:text-slate-200 text-slate-800 hover:dark:bg-slate-700 hover:bg-slate-200 transition-colors"
          >
            Load more records
          </button>
        </div>
      )}
    </section>
  );
}
