import { ApiError } from "../api";
import { AlertTriangleIcon } from "./Icons";

export function ErrorBox({ error }: { error: unknown }) {
  const e =
    error instanceof ApiError
      ? error
      : new ApiError(0, "unexpected", "An unexpected evaluation error occurred.");

  return (
    <div
      role="alert"
      className="rounded-xl border border-rose-500/40 bg-rose-950/40 p-4 text-rose-200 shadow-lg shadow-rose-950/20"
    >
      <div className="flex items-start gap-3">
        <AlertTriangleIcon className="size-5 text-rose-400 shrink-0 mt-0.5" />
        <div className="flex-1">
          <div className="font-semibold text-white text-[13px]">{e.message}</div>
          <div className="mt-1 font-mono text-[11px] text-rose-300/80 flex flex-wrap gap-2">
            <span className="rounded bg-rose-950 px-1.5 py-0.5 border border-rose-800">
              {e.code}
            </span>
            {e.status ? (
              <span className="rounded bg-rose-950 px-1.5 py-0.5 border border-rose-800">
                HTTP {e.status}
              </span>
            ) : null}
            {e.requestId ? (
              <span className="rounded bg-rose-950 px-1.5 py-0.5 border border-rose-800">
                request {e.requestId}
              </span>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
