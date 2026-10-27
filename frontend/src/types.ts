// Shapes returned by the backend (GET/POST /api/assessments...). The model's own fields keep the model's names.
export type Effective = "compliant" | "non_compliant" | "needs_review";

export interface Finding {
  req_id?: string;
  covered?: boolean;
  field_name?: string;
  conflict?: string | null;
  spec_constraint?: string;
  evidence_quote?: string;
  reasoning?: string;
  supported?: boolean;
  requirement?: string;
  citation?: string;
}

export interface Row {
  regulation: string;
  region: string | null;
  compliant: string;
  effective_status: Effective;
  reason_if_not_compliant: string | null;
  citation: string | null;
  quote: string | null;
  quote_verified: boolean | null;
  sources_disagree: boolean;
  votes: Record<string, number> | null;
  findings: Finding[] | null;
  flags: string[];
  mapped_fields?: Record<string, string[]> | null;
  catalog_size?: number | null;
  source_values?: string | null;
  vote_errors?: unknown[] | null;
}

export interface RegionHeat {
  affected_regulations?: string[];
  non_compliant?: string[];
  risk_status?: string;
  conflict_breakdown?: Record<string, number>;
}

export interface Requirement {
  id?: string;
  kind?: string;
  concept?: string;
  requirement?: string;
  required_max_length?: number | null;
  search_queries?: string[];
}

export interface SpectrumItem {
  requirement_id?: string;
  concept?: string;
  kind?: string;
  severity?: string;
  reason?: string;
  required_max_length?: number | null;
}

export interface Assessment {
  id: string;
  cr_id: string;
  parent_assessment_id: string | null;
  status: string; // assessed | needs_clarification | model_error | invalid_model_output | pending
  overall_conclusion: "Proceed" | "Do Not Proceed" | "Needs Review" | null;
  risk_score: number | null;
  warnings: string[];
  disclaimer: string;
  change_request: { text: string; source_type: string; original_filename: string | null };
  model: { mode: string; label: string; latency_ms: number | null; disclaimer?: string | null };
  cr_metadata: { summary?: string; is_ambiguous?: boolean; clarification_prompt?: string | null; requirements?: Requirement[] } | null;
  clarification_prompt: string | null;
  source_discrepancies: unknown[];
  chain_of_thought_explanation: string | null;
  compliance_table: Row[];
  conflict_heatmap: Record<string, RegionHeat> | null;
  spectrum_of_complexity: SpectrumItem[] | null;
  error: { code: string; message: string } | null;
  created_at: string;
  completed_at: string | null;
}

export interface Summary {
  id: string;
  cr_id: string;
  cr_preview: string;
  source_type: string;
  status: string;
  overall_conclusion: Assessment["overall_conclusion"];
  risk_score: number | null;
  results: Record<string, Effective>;
  parent_assessment_id: string | null;
  created_at: string;
}

export interface HistoryPage {
  items: Summary[];
  total: number;
  limit: number;
  offset: number;
}
