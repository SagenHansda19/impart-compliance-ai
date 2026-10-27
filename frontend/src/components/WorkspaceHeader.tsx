import { SparklesIcon, CheckCircleIcon } from "./Icons";

interface WorkspaceHeaderProps {
  activeTab: "assess" | "history";
  onTabChange: (tab: "assess" | "history") => void;
  latencyMs?: number | null;
  totalAssessed?: number;
}

export function WorkspaceHeader({
  activeTab,
  onTabChange,
  latencyMs,
  totalAssessed,
}: WorkspaceHeaderProps) {
  return (
    <header className="sticky top-0 z-40 border-b border-slate-800/80 bg-slate-900/90 backdrop-blur-md">
      <div className="mx-auto flex w-full max-w-[1700px] items-center justify-between gap-4 px-4 sm:px-6 lg:px-8 py-3">
        {/* Left: Branding & Enterprise Tag */}
        <div className="flex items-center gap-3.5">
          <div className="relative flex size-9 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-500 to-teal-700 text-white shadow-md shadow-emerald-500/20 ring-1 ring-emerald-400/30">
            <SparklesIcon className="size-5" />
            <span className="absolute -top-1 -right-1 flex size-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex size-2.5 rounded-full bg-emerald-500"></span>
            </span>
          </div>

          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-[15px] font-bold tracking-tight text-white flex items-center gap-2">
                IMPART
                <span className="text-[12px] font-normal text-slate-400">
                  Compliance Co-Pilot
                </span>
              </h1>
              <span className="inline-flex items-center rounded-full bg-emerald-950/80 border border-emerald-500/30 px-2 py-0.5 font-mono text-[10px] font-medium text-emerald-300">
                BNP-MUM Team 25
              </span>
              <span className="hidden md:inline-flex items-center rounded-full bg-slate-800 border border-slate-700 px-2 py-0.5 font-mono text-[10px] text-slate-300">
                B2B RegTech v2.4
              </span>
            </div>
            <div className="text-[11px] text-slate-400 flex items-center gap-2 mt-0.5">
              <span>Cross-Border Derivatives Impact Assessment</span>
              <span className="text-slate-600">·</span>
              <span className="font-mono text-slate-400">EMIR · UK EMIR · ASIC · MAS · HKMA</span>
            </div>
          </div>
        </div>

        {/* Center/Right: Live System Health & Stats */}
        <div className="hidden xl:flex items-center gap-3 text-[11px]">
          {/* Live DB Badge */}
          <div className="flex items-center gap-1.5 rounded-md bg-slate-800/80 border border-slate-700/60 px-2.5 py-1 text-slate-300">
            <span className="relative flex size-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex size-2 rounded-full bg-emerald-500"></span>
            </span>
            <span className="font-medium text-slate-200">pgvector RAG</span>
            <span className="text-emerald-400 font-mono font-semibold">&lt; 10ms</span>
          </div>

          {/* Clauses Indexed */}
          <div className="flex items-center gap-1.5 rounded-md bg-slate-800/80 border border-slate-700/60 px-2.5 py-1 text-slate-300">
            <CheckCircleIcon className="size-3.5 text-emerald-400" />
            <span>8,500+ Clauses</span>
          </div>

          {/* Optional Model Latency */}
          {latencyMs !== undefined && latencyMs !== null && (
            <div className="flex items-center gap-1.5 rounded-md bg-emerald-950/40 border border-emerald-500/30 px-2.5 py-1 text-emerald-300 font-mono">
              <span>⏱ Latency: {latencyMs} ms</span>
            </div>
          )}
        </div>

        {/* Right: Workstation Nav */}
        <nav className="flex items-center gap-1.5 bg-slate-950/60 p-1 rounded-lg border border-slate-800">
          <button
            type="button"
            onClick={() => onTabChange("assess")}
            className={`cursor-pointer rounded-md px-3.5 py-1.5 text-[12px] font-semibold transition-all duration-150 ${
              activeTab === "assess"
                ? "bg-emerald-600 text-white shadow-sm shadow-emerald-900/40"
                : "text-slate-400 hover:bg-slate-800 hover:text-slate-200"
            }`}
          >
            Workstation
          </button>
          <button
            type="button"
            onClick={() => onTabChange("history")}
            className={`cursor-pointer rounded-md px-3.5 py-1.5 text-[12px] font-semibold transition-all duration-150 flex items-center gap-1.5 ${
              activeTab === "history"
                ? "bg-emerald-600 text-white shadow-sm shadow-emerald-900/40"
                : "text-slate-400 hover:bg-slate-800 hover:text-slate-200"
            }`}
          >
            <span>History</span>
            {totalAssessed !== undefined && totalAssessed > 0 && (
              <span className="rounded-full bg-slate-800 px-1.5 py-0.2 text-[10px] text-slate-300 font-mono">
                {totalAssessed}
              </span>
            )}
          </button>
        </nav>
      </div>
    </header>
  );
}
