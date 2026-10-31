import { useCallback, useEffect, useState } from "react";
import { getAssessment, reassess, submitCr } from "./api";
import { Sidebar } from "./components/Sidebar";
import { LandingPage } from "./components/LandingPage";
import { ChatInputBar } from "./components/ChatInputBar";
import { AuditResultsTabs } from "./components/AuditResultsTabs";
import { AuditDrawer } from "./components/AuditDrawer";
import { ReasoningState } from "./components/ReasoningState";
import { History } from "./components/History";
import { ErrorBox } from "./components/ErrorBox";
import { DocsModal } from "./components/DocsModal";
import { SunIcon, MoonIcon } from "./components/Icons";
import { applyTheme, getInitialTheme, type Theme } from "./theme";
import type { Assessment, Row } from "./types";

type Route = { name: "landing" } | { name: "assess" } | { name: "history" } | { name: "item"; id: string };

function parseRoute(hash: string): Route {
  if (hash.startsWith("#/landing")) return { name: "landing" };
  if (hash.startsWith("#/history")) return { name: "history" };
  const m = hash.match(/^#\/a\/(.+)$/);
  return m ? { name: "item", id: decodeURIComponent(m[1]) } : { name: "assess" };
}

const ALL_REGS = ["EMIR", "UKEMIR", "ASIC", "MAS", "HKMA"];

export default function App() {
  const [route, setRoute] = useState<Route>(() => parseRoute(window.location.hash));
  const [result, setResult] = useState<Assessment | null>(null);
  const [item, setItem] = useState<Assessment | null>(null);
  const [submittedPrompt, setSubmittedPrompt] = useState<string | null>(null);
  const [reasoningSeconds, setReasoningSeconds] = useState<number>(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [selectedRegs, setSelectedRegs] = useState<string[]>(ALL_REGS);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [activeDrawerRow, setActiveDrawerRow] = useState<Row | null>(null);
  const [isDocsOpen, setIsDocsOpen] = useState(false);
  const [theme, setTheme] = useState<Theme>(() => getInitialTheme());

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  const toggleTheme = () => setTheme((t) => (t === "dark" ? "light" : "dark"));

  useEffect(() => {
    const handleHash = () => setRoute(parseRoute(window.location.hash));
    window.addEventListener("hashchange", handleHash);
    return () => window.removeEventListener("hashchange", handleHash);
  }, []);

  const navigateTo = (hash: string) => {
    window.location.hash = hash;
    setRoute(parseRoute(hash));
  };

  useEffect(() => {
    if (route.name !== "item") return;
    let active = true;
    setItem(null);
    setError(null);
    getAssessment(route.id)
      .then((a) => active && setItem(a))
      .catch((e) => active && setError(e));
    return () => {
      active = false;
    };
  }, [route]);

  const handleAssess = useCallback(async (text: string) => {
    setSubmittedPrompt(text);
    setBusy(true);
    setError(null);
    const start = performance.now();
    try {
      const res = await submitCr(text);
      setResult(res);
      setReasoningSeconds(+((performance.now() - start) / 1000).toFixed(1));
    } catch (e) {
      setResult(null);
      setError(e);
      setReasoningSeconds(+((performance.now() - start) / 1000).toFixed(1));
    } finally {
      setBusy(false);
    }
  }, []);

  const handleReassess = useCallback(
    async (current: Assessment, setter: (a: Assessment) => void) => {
      setBusy(true);
      setError(null);
      try {
        const next = await reassess(current.id);
        setter(next);
      } catch (e) {
        setError(e);
      } finally {
        setBusy(false);
      }
    },
    []
  );

  const toggleReg = (code: string) => {
    setSelectedRegs((cur) =>
      cur.includes(code)
        ? cur.length > 1
          ? cur.filter((c) => c !== code)
          : cur
        : [...cur, code]
    );
  };

  const handleNewAssessment = () => {
    setSubmittedPrompt(null);
    setResult(null);
    setError(null);
    navigateTo("#/");
  };

  // If on landing page route, render the standalone SaaS Landing Page
  if (route.name === "landing") {
    return <LandingPage onLaunch={() => navigateTo("#/")} />;
  }

  const activeAssessment = route.name === "item" ? item : result;
  const filteredRows = (activeAssessment?.compliance_table || []).filter((r) =>
    selectedRegs.includes(r.regulation)
  );

  return (
    <div className="flex h-screen w-full overflow-hidden dark:bg-[#090d16] bg-slate-100 dark:text-slate-100 text-slate-800 font-sans selection:bg-emerald-500/30 selection:text-emerald-500 transition-colors duration-150">
      {/* 1. CHATGPT-STYLE COLLAPSIBLE SIDEBAR */}
      <Sidebar
        activeRoute={route.name}
        onNavigate={navigateTo}
        onNewAssessment={handleNewAssessment}
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
        onOpenDocs={() => setIsDocsOpen(true)}
        theme={theme}
        onToggleTheme={toggleTheme}
      />

      {/* 2. MAIN APPLICATION WORKSPACE */}
      <div className="flex-1 min-w-0 flex flex-col h-full overflow-hidden relative">
        {/* Minimalist Top App Bar */}
        <header className="border-b dark:border-slate-800/80 border-slate-200 dark:bg-slate-950/60 bg-white/80 backdrop-blur-md px-6 py-3 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            {isSidebarCollapsed && (
              <button
                type="button"
                onClick={() => setIsSidebarCollapsed(false)}
                className="cursor-pointer dark:text-slate-400 text-slate-600 hover:dark:text-white hover:text-slate-900 p-1.5 rounded-lg hover:dark:bg-slate-800 hover:bg-slate-200 transition-colors text-sm font-bold flex items-center justify-center size-8"
                title="Expand sidebar"
                aria-label="Expand sidebar"
              >
                ☰
              </button>
            )}
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-bold dark:text-white text-slate-900 tracking-tight">
                IMPART AI
              </h1>
              <span className="dark:text-slate-600 text-slate-400">/</span>
              <span className="text-[12px] dark:text-slate-400 text-slate-600 font-medium">
                {route.name === "history"
                  ? "Audit History"
                  : route.name === "item"
                  ? `Assessment ${item?.id.slice(0, 8) || ""}`
                  : "Compliance Co-Pilot"}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => navigateTo("#/history")}
              className={`cursor-pointer rounded-lg px-3 py-1 text-[12px] font-medium transition-colors ${
                route.name === "history"
                  ? "dark:bg-slate-800 bg-slate-200 dark:text-white text-slate-900 font-semibold"
                  : "dark:text-slate-400 text-slate-600 hover:dark:text-white hover:text-slate-900 hover:dark:bg-slate-800/60 hover:bg-slate-200/60"
              }`}
            >
              History
            </button>
            <button
              type="button"
              onClick={() => setIsDocsOpen(true)}
              className="cursor-pointer text-[12px] dark:text-slate-400 text-slate-600 hover:text-emerald-500 dark:hover:text-emerald-400 transition-colors"
            >
              Docs & Overview
            </button>
            <button
              type="button"
              onClick={toggleTheme}
              className="cursor-pointer p-1.5 rounded-lg hover:dark:bg-slate-800 hover:bg-slate-200 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
              title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
              aria-label="Toggle theme"
            >
              {theme === "dark" ? (
                <SunIcon className="size-4 text-amber-400" />
              ) : (
                <MoonIcon className="size-4 text-slate-600" />
              )}
            </button>
          </div>
        </header>

        {/* Scrollable Center Content Area */}
        <div className="flex-1 overflow-y-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6 min-w-0">
          {/* HISTORY VIEW */}
          {route.name === "history" && (
            <div className="max-w-[1400px] mx-auto w-full py-2">
              <History onOpen={(id) => navigateTo(`#/a/${encodeURIComponent(id)}`)} />
            </div>
          )}

          {/* ITEM DETAIL VIEW */}
          {route.name === "item" && (
            <div className="max-w-[1400px] mx-auto w-full space-y-6 pb-20">
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => navigateTo("#/history")}
                  className="cursor-pointer inline-flex items-center gap-1.5 text-[12px] font-medium text-emerald-600 dark:text-emerald-400 hover:underline transition-colors"
                >
                  &larr; Back to audit history
                </button>
              </div>

              {error ? <ErrorBox error={error} /> : null}

              {item && (
                <>
                  <section className="rounded-lg border dark:border-slate-800/90 border-slate-200/90 dark:bg-slate-950/70 bg-white/90 backdrop-blur-md p-4 shadow-xs">
                    <div className="text-[10px] font-bold uppercase tracking-wider dark:text-slate-400 text-slate-500 mb-1.5 font-mono">
                      Evaluated Change Request
                    </div>
                    <p className="font-mono text-xs dark:text-slate-200 text-slate-800 dark:bg-slate-900/60 bg-slate-50 p-3.5 rounded-md border dark:border-slate-800/70 border-slate-200/80 leading-relaxed">
                      {item.change_request.text}
                    </p>
                  </section>

                  <AuditResultsTabs
                    assessment={item}
                    filteredRows={filteredRows}
                    onInspectDrawer={(r) => setActiveDrawerRow(r)}
                    onReassess={() =>
                      handleReassess(item, (updated) =>
                        navigateTo(`#/a/${encodeURIComponent(updated.id)}`)
                      )
                    }
                    busy={busy}
                  />
                </>
              )}
            </div>
          )}

          {/* MAIN CHAT / AUDIT WORKSPACE */}
          {route.name === "assess" && (
            <div className="max-w-[1400px] mx-auto w-full space-y-5 pb-24">
              {/* Error banner if present */}
              {error ? <ErrorBox error={error} /> : null}

              {/* 1. QUERY BUILDER PROMPT BUBBLE (Right-aligned Command Execution Box) */}
              {(submittedPrompt || result?.change_request?.text) && (
                <div className="flex justify-end animate-in fade-in duration-150">
                  <div className="max-w-2xl rounded-lg px-4 py-3 dark:bg-slate-900/95 bg-white/95 border dark:border-slate-800/90 border-slate-200/90 backdrop-blur-md shadow-xs">
                    <div className="text-[10px] font-semibold uppercase tracking-wider dark:text-emerald-400 text-emerald-700 mb-1 flex items-center justify-end gap-1.5 font-mono">
                      <span className="size-1.5 rounded-full bg-emerald-500 inline-block" />
                      <span>Change Request Specification</span>
                    </div>
                    <p className="text-[13px] dark:text-slate-100 text-slate-800 leading-relaxed font-sans select-text">
                      {submittedPrompt || result?.change_request?.text}
                    </p>
                  </div>
                </div>
              )}

              {/* 2. CHATGPT-STYLE COLLAPSIBLE "THINKING MODE" STATE */}
              {(busy || (result && submittedPrompt)) && (
                <ReasoningState
                  busy={busy}
                  elapsedSeconds={reasoningSeconds}
                  initiallyOpen={busy}
                />
              )}

              {/* 3. Ambiguous Clarification State */}
              {result && result.status === "needs_clarification" && (
                <div className="rounded-lg border border-amber-500/40 bg-amber-950/30 backdrop-blur-md p-5 shadow-xs text-slate-100">
                  <h3 className="text-sm font-bold text-amber-300 font-mono">
                    Clarification Required
                  </h3>
                  <p className="mt-1.5 text-[13px] text-slate-200 font-medium">
                    {result.clarification_prompt || "Which field should change?"}
                  </p>
                  <p className="mt-2.5 text-[10px] text-slate-400 font-mono">
                    Please provide more details in the query input below to complete the audit.
                  </p>
                </div>
              )}

              {/* 4. Progressive Disclosure Audit Results */}
              {result && result.status !== "needs_clarification" && (
                <div className="animate-in fade-in duration-150">
                  <AuditResultsTabs
                    assessment={result}
                    filteredRows={filteredRows}
                    onInspectDrawer={(r) => setActiveDrawerRow(r)}
                    onReassess={() => handleReassess(result, setResult)}
                    busy={busy}
                  />
                </div>
              )}
            </div>
          )}
        </div>

        {/* 3. CONVERSATIONAL FLOATING INPUT BOX (Aligned cleanly with content grid) */}
        {route.name === "assess" && (
          <div className="shrink-0 px-4 sm:px-6 lg:px-8 pb-4 max-w-[1400px] mx-auto w-full">
            <ChatInputBar
              busy={busy}
              onSubmit={handleAssess}
              selectedRegs={selectedRegs}
              onToggleReg={toggleReg}
              isInitialCentered={!result && !busy}
            />
          </div>
        )}
      </div>

      {/* 4. SLIDE-OVER AUDIT EVIDENCE DRAWER */}
      <AuditDrawer
        row={activeDrawerRow}
        onClose={() => setActiveDrawerRow(null)}
      />

      {/* 5. DOCUMENTATION & SYSTEM OVERVIEW MODAL */}
      <DocsModal
        isOpen={isDocsOpen}
        onClose={() => setIsDocsOpen(false)}
      />
    </div>
  );
}
