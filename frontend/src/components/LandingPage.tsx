import { ShieldCheckIcon, SparklesIcon, CheckCircleIcon } from "./Icons";

interface LandingPageProps {
  onLaunch: () => void;
}

export function LandingPage({ onLaunch }: LandingPageProps) {
  return (
    <div className="min-h-screen bg-[#090d16] text-slate-100 flex flex-col font-sans selection:bg-emerald-500/30 selection:text-emerald-200">
      {/* Top Navbar */}
      <nav className="sticky top-0 z-50 border-b border-slate-800/80 bg-slate-900/80 backdrop-blur-md">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex size-9 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-700 text-white shadow-lg shadow-emerald-500/20 ring-1 ring-emerald-400/30">
              <SparklesIcon className="size-5" />
            </div>
            <div>
              <span className="text-base font-bold tracking-tight text-white">IMPART</span>
              <span className="ml-2 rounded-full border border-slate-700 bg-slate-800/80 px-2 py-0.5 text-[10px] font-mono text-slate-300">
                AI Compliance Co-Pilot
              </span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="hidden sm:flex items-center gap-2 rounded-full border border-slate-800 bg-slate-950/60 px-3 py-1 text-[11px] text-slate-400">
              <span className="relative flex size-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex size-2 rounded-full bg-emerald-500"></span>
              </span>
              <span>All Systems Operational</span>
            </div>

            <button
              type="button"
              onClick={onLaunch}
              className="cursor-pointer inline-flex items-center gap-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 px-4 py-2 text-[12px] font-semibold text-white shadow-md shadow-emerald-950/40 transition-all duration-150 active:scale-95"
            >
              <span>Launch Workspace</span>
              <span>&rarr;</span>
            </button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <main className="flex-1">
        <section className="relative overflow-hidden px-6 pt-20 pb-24 lg:pt-28 lg:pb-32">
          {/* Subtle glow background */}
          <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 size-[600px] rounded-full bg-emerald-500/10 blur-[140px] pointer-events-none"></div>

          <div className="mx-auto max-w-4xl text-center relative z-10">
            {/* Pill Tag */}
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-950/40 px-3.5 py-1 text-[11px] font-medium text-emerald-300 shadow-inner mb-6">
              <ShieldCheckIcon className="size-3.5" />
              <span>Enterprise Regulatory Intelligence Engine</span>
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-white leading-tight">
              Evaluate cross-border derivatives compliance in{" "}
              <span className="bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400 bg-clip-text text-transparent">
                seconds
              </span>
              .
            </h1>

            <p className="mt-6 text-base sm:text-lg text-slate-400 max-w-2xl mx-auto leading-relaxed">
              Automate multi-regime Change Request compliance audits across{" "}
              <strong className="text-slate-200 font-semibold">EMIR</strong>,{" "}
              <strong className="text-slate-200 font-semibold">UK EMIR</strong>,{" "}
              <strong className="text-slate-200 font-semibold">ASIC</strong>,{" "}
              <strong className="text-slate-200 font-semibold">MAS</strong>, and{" "}
              <strong className="text-slate-200 font-semibold">HKMA</strong>. Pinned to 8,500+ official clauses with 100% audit-verifiable citations.
            </p>

            {/* CTA Group */}
            <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
              <button
                type="button"
                onClick={onLaunch}
                className="w-full sm:w-auto cursor-pointer inline-flex items-center justify-center gap-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 px-6 py-3.5 text-sm font-semibold text-white shadow-xl shadow-emerald-950/40 transition-all duration-200 active:scale-95"
              >
                <SparklesIcon className="size-4" />
                <span>Launch Compliance Workspace</span>
                <span>&rarr;</span>
              </button>

              <div className="text-[12px] text-slate-500 flex items-center gap-2">
                <span>Free evaluation environment</span>
                <span>·</span>
                <span>No setup required</span>
              </div>
            </div>

            {/* Jurisdiction Badges Strip */}
            <div className="mt-14 pt-8 border-t border-slate-800/80 flex flex-wrap items-center justify-center gap-2 sm:gap-3 text-[12px] font-mono text-slate-400">
              <span className="text-slate-500 font-sans text-[11px] uppercase tracking-wider mr-1">
                Active Regimes:
              </span>
              <span className="rounded-lg border border-slate-800 bg-slate-900/90 px-3 py-1.5 text-slate-300">
                🇪🇺 European Union (EMIR Refit)
              </span>
              <span className="rounded-lg border border-slate-800 bg-slate-900/90 px-3 py-1.5 text-slate-300">
                🇬🇧 United Kingdom (UK EMIR)
              </span>
              <span className="rounded-lg border border-slate-800 bg-slate-900/90 px-3 py-1.5 text-slate-300">
                🇦🇺 Australia (ASIC 2024)
              </span>
              <span className="rounded-lg border border-slate-800 bg-slate-900/90 px-3 py-1.5 text-slate-300">
                🇸🇬 Singapore (MAS)
              </span>
              <span className="rounded-lg border border-slate-800 bg-slate-900/90 px-3 py-1.5 text-slate-300">
                🇭🇰 Hong Kong (HKMA)
              </span>
            </div>
          </div>
        </section>

        {/* Core Value Pillars Grid */}
        <section className="px-6 py-16 border-t border-slate-800/60 bg-slate-950/40">
          <div className="mx-auto max-w-6xl">
            <div className="text-center max-w-xl mx-auto mb-12">
              <h2 className="text-2xl font-bold text-white tracking-tight">
                Architected for RegTech & Global Derivatives Operations
              </h2>
              <p className="mt-2 text-sm text-slate-400">
                Purpose-built AI pipeline replacing weeks of manual legal review with instant technical audits.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Feature 1 */}
              <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6 shadow-lg shadow-black/20 flex flex-col justify-between">
                <div>
                  <div className="flex size-10 items-center justify-center rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 mb-4">
                    <SparklesIcon className="size-5" />
                  </div>
                  <h3 className="text-base font-semibold text-white">
                    Unified Multi-Regime Engine
                  </h3>
                  <p className="mt-2 text-[13px] text-slate-400 leading-relaxed">
                    Evaluates trade lifecycle changes across EMEA and APAC jurisdictions in a single unified prompt. Decomposes plain-English requirements into checkable technical specs automatically.
                  </p>
                </div>
                <div className="mt-6 pt-4 border-t border-slate-800 text-[11px] font-mono text-emerald-400 flex items-center gap-1.5">
                  <CheckCircleIcon className="size-3.5" />
                  <span>5 jurisdictions in &lt; 4 seconds</span>
                </div>
              </div>

              {/* Feature 2 */}
              <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6 shadow-lg shadow-black/20 flex flex-col justify-between">
                <div>
                  <div className="flex size-10 items-center justify-center rounded-xl bg-teal-500/10 border border-teal-500/20 text-teal-400 mb-4">
                    <ShieldCheckIcon className="size-5" />
                  </div>
                  <h3 className="text-base font-semibold text-white">
                    Sub-10ms Dense Vector Search
                  </h3>
                  <p className="mt-2 text-[13px] text-slate-400 leading-relaxed">
                    PostgreSQL 16 + pgvector with tuned HNSW indexing queries 8,500+ official regulatory clauses, field specification matrices, and validation rules in under 10 milliseconds.
                  </p>
                </div>
                <div className="mt-6 pt-4 border-t border-slate-800 text-[11px] font-mono text-teal-400 flex items-center gap-1.5">
                  <CheckCircleIcon className="size-3.5" />
                  <span>ef_search = 40 · 1.18ms latency</span>
                </div>
              </div>

              {/* Feature 3 */}
              <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6 shadow-lg shadow-black/20 flex flex-col justify-between">
                <div>
                  <div className="flex size-10 items-center justify-center rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 mb-4">
                    <ShieldCheckIcon className="size-5" />
                  </div>
                  <h3 className="text-base font-semibold text-white">
                    100% Audit-Grade Traceability
                  </h3>
                  <p className="mt-2 text-[13px] text-slate-400 leading-relaxed">
                    No black-box hallucinations. Every verdict includes verbatim legal quotes, official document names, sheet references, and exact specification row citations for risk officers.
                  </p>
                </div>
                <div className="mt-6 pt-4 border-t border-slate-800 text-[11px] font-mono text-cyan-400 flex items-center gap-1.5">
                  <CheckCircleIcon className="size-3.5" />
                  <span>Verbatim verified quotes</span>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Clean Minimalist Footer */}
      <footer className="border-t border-slate-800/80 bg-slate-950 py-6 text-[12px] text-slate-500">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-6">
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-400">IMPART AI</span>
            <span>—</span>
            <span>Enterprise Regulatory Compliance Evaluation Co-pilot</span>
          </div>
          <div className="text-[11px] text-slate-500">
            Decision-support co-pilot. Results are AI-generated and require qualified compliance verification.
          </div>
        </div>
      </footer>
    </div>
  );
}
