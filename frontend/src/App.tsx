import { useCallback, useEffect, useState } from "react";
import { getAssessment, reassess, submitCr } from "./api";
import { ErrorBox } from "./components/ErrorBox";
import { History } from "./components/History";
import { Result } from "./components/Result";
import { Terminal } from "./components/Terminal";
import { SparklesIcon } from "./components/Icons";
import type { Assessment } from "./types";

type Route = { name: "assess" } | { name: "history" } | { name: "item"; id: string };

function parse(hash: string): Route {
  if (hash.startsWith("#/history")) return { name: "history" };
  const m = hash.match(/^#\/a\/(.+)$/);
  return m ? { name: "item", id: decodeURIComponent(m[1]) } : { name: "assess" };
}

export default function App() {
  const [route, setRoute] = useState<Route>(() => parse(window.location.hash));
  const [result, setResult] = useState<Assessment | null>(null); // latest assessment on the Assess page
  const [item, setItem] = useState<Assessment | null>(null); // assessment opened from History
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    const on = () => setRoute(parse(window.location.hash));
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);

  const go = (h: string) => {
    window.location.hash = h;
  };

  useEffect(() => {
    if (route.name !== "item") return;
    let alive = true;
    setItem(null);
    setError(null);
    getAssessment(route.id)
      .then((a) => alive && setItem(a))
      .catch((e) => alive && setError(e));
    return () => {
      alive = false;
    };
  }, [route]);

  const assess = useCallback(async (text: string) => {
    setBusy(true);
    setError(null);
    try {
      setResult(await submitCr(text));
    } catch (e) {
      setResult(null);
      setError(e);
    } finally {
      setBusy(false);
    }
  }, []);

  const again = useCallback(async (a: Assessment, setter: (x: Assessment) => void) => {
    setBusy(true);
    setError(null);
    try {
      setter(await reassess(a.id));
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }, []);

  const tab = (name: "assess" | "history", label: string) => {
    const isActive =
      route.name === name || (name === "history" && route.name === "item");
    const targetHash = name === "assess" ? "#/" : "#/history";

    return (
      <button
        type="button"
        onClick={() => go(targetHash)}
        aria-current={isActive ? "page" : undefined}
        className={`cursor-pointer rounded-md px-3.5 py-1.5 text-[12px] font-semibold transition-all duration-150 ${
          isActive
            ? "bg-slate-900 text-white shadow-xs"
            : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
        }`}
      >
        {label}
      </button>
    );
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] flex flex-col font-sans text-slate-900">
      {/* Soft, Harmonious Enterprise Header (No harsh contrast slab) */}
      <header className="sticky top-0 z-40 border-b border-slate-200/90 bg-white/95 backdrop-blur-sm shadow-2xs">
        <div className="mx-auto flex w-full max-w-[1500px] items-center justify-between gap-4 px-6 lg:px-8 py-3">
          <div className="flex items-center gap-3">
            <div className="flex size-7 items-center justify-center rounded-md bg-emerald-600 font-bold text-white shadow-xs">
              <SparklesIcon className="size-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-[14px] font-bold tracking-tight text-slate-900">
                  IMPART - Regulatory Change Request Compliance Co-pilot
                </h1>
                <span className="hidden sm:inline-block rounded bg-emerald-50 border border-emerald-200 px-1.5 py-0.2 font-mono text-[9px] font-semibold text-emerald-800">
                  BNP-MUM Team 25
                </span>
              </div>
              <div className="text-[11px] text-slate-500">
                Cross-Border Derivatives Impact Assessment · EMIR · UK EMIR · ASIC · MAS · HKMA
              </div>
            </div>
          </div>

          <nav className="flex items-center gap-1.5" aria-label="Main">
            {tab("assess", "Assess")}
            {tab("history", "History")}
          </nav>
        </div>
      </header>

      {/* Spacious Main Area */}
      <main className="mx-auto w-full max-w-[1500px] flex-1 space-y-6 px-6 lg:px-8 py-6">
        {route.name === "assess" && (
          <>
            <Terminal busy={busy} onSubmit={assess} hasResult={!!result} />
            {error ? <ErrorBox error={error} /> : null}
            {result && (
              <Result
                a={result}
                busy={busy}
                onReassess={() => again(result, setResult)}
              />
            )}
          </>
        )}

        {route.name === "history" && (
          <History onOpen={(id) => go(`#/a/${encodeURIComponent(id)}`)} />
        )}

        {route.name === "item" && (
          <div className="space-y-5">
            <button
              type="button"
              onClick={() => go("#/history")}
              className="inline-flex cursor-pointer items-center gap-1.5 text-[12px] font-medium text-emerald-700 hover:text-emerald-800 hover:underline"
            >
              &larr; Back to assessment history
            </button>
            {error ? <ErrorBox error={error} /> : null}
            {!item && !error && (
              <p role="status" className="py-6 text-[12px] text-slate-500">
                Loading assessment details...
              </p>
            )}
            {item && (
              <>
                <section className="rounded-xl border border-slate-200/90 bg-white p-5 shadow-xs">
                  <div className="flex items-center justify-between border-b border-slate-200/70 pb-2.5">
                    <h2 className="text-[13px] font-semibold text-slate-900">Change Request Specification</h2>
                    <span className="font-mono text-[11px] text-slate-500">
                      {new Date(item.created_at).toLocaleString()}
                    </span>
                  </div>
                  <p className="mt-3 whitespace-pre-wrap font-mono text-[12px] text-slate-800 bg-slate-50/80 p-3.5 rounded-lg border border-slate-200">
                    {item.change_request.text}
                  </p>
                </section>
                <Result
                  a={item}
                  busy={busy}
                  onReassess={() => again(item, (n) => go(`#/a/${encodeURIComponent(n.id)}`))}
                />
              </>
            )}
          </div>
        )}
      </main>

      {/* Clean Footer */}
      <footer className="mt-auto border-t border-slate-200 bg-white py-4 text-[11px] text-slate-500">
        <div className="mx-auto flex w-full max-w-[1500px] flex-wrap items-center justify-between gap-3 px-6 lg:px-8">
          <div>
            <strong>IMPART</strong> — Decision-support regulatory co-pilot. Results are AI-generated and require qualified compliance verification.
          </div>
          <div className="font-mono text-[10px] text-slate-400">
            BNP Paribas Hackathon 2026 · Team 25
          </div>
        </div>
      </footer>
    </div>
  );
}
