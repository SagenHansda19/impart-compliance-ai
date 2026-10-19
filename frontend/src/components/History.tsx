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

  const load = useCallback(async (offset: number, reset: boolean) => {
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
  }, [overall]);

  useEffect(() => { void load(0, true); }, [load]);

  return (
    <section aria-label="History" className="rounded border border-line bg-white p-3">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-[13px] font-semibold">History <span className="font-normal text-sub">({total})</span></h2>
        <label className="text-[12px] text-sub">
          Show{" "}
          <select value={overall} onChange={(e) => setOverall(e.target.value)} className="rounded border border-line bg-white px-1 py-0.5 text-ink">
            {FILTERS.map((f) => <option key={f} value={f}>{f || "All"}</option>)}
          </select>
        </label>
      </div>
      {error ? <ErrorBox error={error} /> : null}
      {!loading && !error && items.length === 0 && <p className="text-[12px] text-sub">Nothing here yet. Assess a change request first.</p>}
      <ul className="divide-y divide-line">
        {items.map((s) => (
          <li key={s.id}>
            <button type="button" onClick={() => onOpen(s.id)} className="block w-full px-1 py-2 text-left hover:bg-page">
              <div className="flex items-center justify-between gap-2">
                <span className="truncate text-[12px]">{s.cr_preview}</span>
                <OverallBadge value={s.status === "needs_clarification" ? "Needs Review" : s.overall_conclusion} />
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-1 text-[11px] text-sub">
                <span>{new Date(s.created_at).toLocaleString()}</span>
                {s.status !== "assessed" && <span className="rounded border border-line px-1">{s.status.replace(/_/g, " ")}</span>}
                {s.parent_assessment_id && <span className="rounded border border-line px-1">re-run</span>}
                {Object.entries(s.results).map(([reg, st]) => <RegChip key={reg} reg={reg} status={st} />)}
              </div>
            </button>
          </li>
        ))}
      </ul>
      {loading && <p role="status" className="py-2 text-[12px] text-sub">Loading...</p>}
      {!loading && items.length < total && (
        <button type="button" onClick={() => void load(items.length, false)} className="mt-2 rounded border border-line px-3 py-1 text-[12px] hover:bg-page">Load more</button>
      )}
    </section>
  );
}
