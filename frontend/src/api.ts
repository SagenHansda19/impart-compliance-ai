import type { Assessment, HistoryPage } from "./types";

const BASE = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? "/api";
const TIMEOUT_MS = 200_000; // the model can take a while (backend allows up to MODEL_TIMEOUT_S = 180 s)

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details: Record<string, unknown> = {},
    public requestId?: string | null,
  ) {
    super(message);
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${BASE}${path}`, {
      ...init,
      signal: ctrl.signal,
      headers: { Accept: "application/json", ...(init.body ? { "Content-Type": "application/json" } : {}) },
    });
    const body = await res.json().catch(() => null);
    if (!res.ok) {
      // backend error shape: {"error": {"code","message","details"}, "request_id"}
      const e = body?.error;
      throw new ApiError(res.status, e?.code ?? `http_${res.status}`, e?.message ?? res.statusText ?? "Request failed", e?.details ?? {}, body?.request_id);
    }
    return body as T;
  } catch (e) {
    if (e instanceof ApiError) throw e;
    if (e instanceof DOMException && e.name === "AbortError") throw new ApiError(0, "timeout", "The request took too long. Please try again.");
    throw new ApiError(0, "network", "Cannot reach the backend. Check that it is running.");
  } finally {
    clearTimeout(timer);
  }
}

export const submitCr = (crText: string) => request<Assessment>("/assessments", { method: "POST", body: JSON.stringify({ cr_text: crText }) });
export const getAssessment = (id: string) => request<Assessment>(`/assessments/${encodeURIComponent(id)}`);
export const reassess = (id: string) => request<Assessment>(`/assessments/${encodeURIComponent(id)}/reassess`, { method: "POST" });
export const listAssessments = (opts: { overall?: string; limit?: number; offset?: number } = {}) => {
  const p = new URLSearchParams();
  if (opts.overall) p.set("overall", opts.overall);
  p.set("limit", String(opts.limit ?? 20));
  p.set("offset", String(opts.offset ?? 0));
  return request<HistoryPage>(`/assessments?${p}`);
};
