import { ApiError } from "../api";

export function ErrorBox({ error }: { error: unknown }) {
  const e = error instanceof ApiError ? error : new ApiError(0, "unexpected", "Something went wrong.");
  return (
    <div role="alert" className="mt-3 rounded border border-no-line bg-no-bg px-3 py-2 text-no-ink">
      <div className="font-semibold">{e.message}</div>
      <div className="mt-0.5 font-mono text-[11px] opacity-80">
        {e.code}
        {e.status ? ` · HTTP ${e.status}` : ""}
        {e.requestId ? ` · request ${e.requestId}` : ""}
      </div>
    </div>
  );
}
