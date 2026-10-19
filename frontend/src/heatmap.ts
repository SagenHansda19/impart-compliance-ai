import type { Assessment, Effective, Row } from "./types";

/** 0 = not affected (grey); 1-3 = affected, light -> dark red. */
export type Level = 0 | 1 | 2 | 3;

export interface RegCell {
  regulation: string;
  status: Effective;
  conflicting: number; // requirements that conflict with this regulation
  total: number; // requirements checked against it
  level: Level;
}

export interface RegionCell {
  region: string;
  riskStatus: string; // the model's own label, shown as-is
  regulations: RegCell[];
  breakdown: Record<string, number>;
  level: Level;
  conflictingRegs: number;
  review: boolean;
}

export function tier(conflicting: number, total: number): Level {
  if (conflicting <= 0 || total <= 0) return 0;
  const r = conflicting / total;
  return r <= 1 / 3 ? 1 : r <= 2 / 3 ? 2 : 3;
}

/** Severity of one regulation = share of the CR's requirements that conflict with it. */
export function regCell(row: Row): RegCell {
  const findings = row.findings ?? [];
  const isConflict = (f: (typeof findings)[number]) => (typeof f.conflict === "string" && f.conflict.trim() !== "") || f.supported === false;
  let conflicting = findings.filter(isConflict).length;
  let total = findings.length;
  if (row.effective_status === "non_compliant" && conflicting === 0) {
    conflicting = 1; // the model said "No" without a flagged finding: still a conflict, count it
    total = Math.max(total, 1);
  }
  if (row.effective_status !== "non_compliant") conflicting = 0;
  return { regulation: row.regulation, status: row.effective_status, conflicting, total, level: tier(conflicting, total) };
}

/** Region tiles come from the model's own `conflict_heatmap`; regulation cells from our table rows. */
export function buildHeatmap(a: Pick<Assessment, "conflict_heatmap" | "compliance_table">): RegionCell[] {
  const hm = a.conflict_heatmap ?? {};
  const byReg = new Map(a.compliance_table.map((r) => [r.regulation, regCell(r)]));
  return Object.entries(hm).map(([region, v]) => {
    const names = [...new Set([...(v.affected_regulations ?? []), ...(v.non_compliant ?? [])])];
    const regulations = names.map((n) => byReg.get(n) ?? { regulation: n, status: "needs_review" as Effective, conflicting: 0, total: 0, level: 0 as Level });
    const conflictingRegs = regulations.filter((r) => r.status === "non_compliant").length;
    return {
      region,
      riskStatus: v.risk_status ?? "Unknown",
      regulations,
      breakdown: v.conflict_breakdown ?? {},
      conflictingRegs,
      level: tier(conflictingRegs, regulations.length),
      review: regulations.some((r) => r.status === "needs_review"),
    };
  });
}
