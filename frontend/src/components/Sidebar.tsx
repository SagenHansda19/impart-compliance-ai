import { useEffect, useState } from "react";
import { listAssessments } from "../api";
import type { Summary } from "../types";
import { SparklesIcon, SunIcon, MoonIcon } from "./Icons";

interface SidebarProps {
  activeRoute: string;
  onNavigate: (route: string) => void;
  onNewAssessment: () => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  onOpenDocs: () => void;
  theme: "dark" | "light";
  onToggleTheme: () => void;
}

export function Sidebar({
  activeRoute,
  onNavigate,
  onNewAssessment,
  isCollapsed,
  onToggleCollapse,
  onOpenDocs,
  theme,
  onToggleTheme,
}: SidebarProps) {
  const [recents, setRecents] = useState<Summary[]>([]);
  const [showStatusModal, setShowStatusModal] = useState(false);

  useEffect(() => {
    if (activeRoute !== "history") return;
    let alive = true;
    listAssessments({ limit: 8 })
      .then((p) => {
        if (alive && p && Array.isArray(p.items)) setRecents(p.items);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [activeRoute]);

  // When collapsed, return null so App header cleanly renders the single top-left toggle button
  if (isCollapsed) {
    return null;
  }

  return (
    <aside
      aria-label="Sidebar navigation"
      className="w-72 border-r dark:border-slate-800/80 border-slate-200 dark:bg-[#090d16] bg-slate-50/95 flex flex-col justify-between shrink-0 select-none z-30 transition-all duration-200 h-full"
    >
      {/* Top Header & Actions */}
      <div className="p-4 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5 text-left">
            <div className="flex size-7 items-center justify-center rounded-lg bg-emerald-600 text-white font-bold text-xs shadow-xs">
              <SparklesIcon className="size-4" />
            </div>
            <div>
              <div className="text-[14px] font-bold dark:text-white text-slate-900 tracking-tight leading-none">
                IMPART AI
              </div>
              <div className="text-[10px] dark:text-slate-500 text-slate-400 font-mono mt-0.5">
                Compliance Co-Pilot
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={onToggleTheme}
              className="cursor-pointer dark:text-slate-400 text-slate-500 hover:dark:text-white hover:text-slate-900 p-1.5 rounded-lg hover:dark:bg-slate-800/80 hover:bg-slate-200 transition-colors"
              title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
              aria-label="Toggle theme"
            >
              {theme === "dark" ? <SunIcon className="size-4 text-amber-400" /> : <MoonIcon className="size-4 text-slate-600" />}
            </button>

            <button
              type="button"
              onClick={onToggleCollapse}
              className="cursor-pointer dark:text-slate-400 text-slate-500 hover:dark:text-white hover:text-slate-900 p-1.5 rounded-lg hover:dark:bg-slate-800/80 hover:bg-slate-200 transition-colors text-xs font-mono"
              title="Collapse sidebar"
              aria-label="Collapse sidebar"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Primary New Audit CTA */}
        <button
          type="button"
          onClick={onNewAssessment}
          className="w-full cursor-pointer flex items-center justify-center gap-2 rounded-md dark:bg-slate-900 bg-white hover:dark:bg-slate-800 hover:bg-slate-100 border dark:border-slate-800 border-slate-300 px-3 py-2 text-xs font-semibold dark:text-white text-slate-900 shadow-2xs transition-all duration-150 active:scale-[0.98] group font-mono"
        >
          <span className="text-emerald-500 font-bold text-sm leading-none group-hover:scale-110 transition-transform">
            +
          </span>
          <span>New Assessment</span>
        </button>

        {/* Workspace Navigation Links */}
        <div className="flex flex-col gap-1 text-[12px] pt-1">
          <button
            type="button"
            onClick={() => onNavigate("#/")}
            className={`cursor-pointer w-full flex items-center gap-2.5 px-3 py-1.5 rounded-md text-left transition-colors font-medium ${
              activeRoute === "assess"
                ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-300 font-semibold border border-emerald-500/20"
                : "dark:text-slate-400 text-slate-600 hover:dark:bg-slate-900 hover:bg-slate-200/70 hover:dark:text-slate-200 hover:text-slate-900"
            }`}
          >
            <span>💬</span>
            <span>Workspace</span>
          </button>

          <button
            type="button"
            onClick={() => onNavigate("#/history")}
            className={`cursor-pointer w-full flex items-center gap-2.5 px-3 py-1.5 rounded-md text-left transition-colors font-medium ${
              activeRoute === "history"
                ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-300 font-semibold border border-emerald-500/20"
                : "dark:text-slate-400 text-slate-600 hover:dark:bg-slate-900 hover:bg-slate-200/70 hover:dark:text-slate-200 hover:text-slate-900"
            }`}
          >
            <span>📜</span>
            <span>Audit History</span>
          </button>

          <button
            type="button"
            onClick={onOpenDocs}
            className="cursor-pointer w-full flex items-center gap-2.5 px-3 py-1.5 rounded-md text-left dark:text-slate-400 text-slate-600 hover:dark:bg-slate-900 hover:bg-slate-200/70 hover:dark:text-slate-200 hover:text-slate-900 transition-colors font-medium"
          >
            <span>🌐</span>
            <span>Overview & Docs</span>
          </button>
        </div>
      </div>

      {/* Middle: Recent Assessments */}
      <div className="flex-1 overflow-y-auto px-4 py-2 border-t dark:border-slate-800/80 border-slate-200">
        <div className="text-[10px] font-semibold uppercase tracking-wider dark:text-slate-500 text-slate-400 mb-2 px-1 font-mono">
          Recent Evaluations
        </div>
        {(!recents || recents.length === 0) ? (
          <div className="text-[11px] dark:text-slate-600 text-slate-400 px-1 py-4 italic font-mono">
            No previous audits recorded.
          </div>
        ) : (
          <div className="space-y-1">
            {recents.map((r) => {
              const isProceed = r.overall_conclusion === "Proceed";
              const isDoNot = r.overall_conclusion === "Do Not Proceed";
              return (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => onNavigate(`#/a/${encodeURIComponent(r.id)}`)}
                  className="w-full text-left p-2 rounded-md hover:dark:bg-slate-900 hover:bg-slate-200/60 text-[11px] dark:text-slate-300 text-slate-700 transition-colors group flex items-start gap-2"
                >
                  <span
                    className={`size-2 rounded-full mt-1 shrink-0 ${
                      isProceed
                        ? "bg-emerald-500"
                        : isDoNot
                        ? "bg-rose-500"
                        : "bg-amber-500"
                    }`}
                  />
                  <div className="flex-1 truncate">
                    <div className="truncate font-medium dark:text-slate-200 text-slate-800 group-hover:text-emerald-500 transition-colors">
                      CR: {r.cr_preview}
                    </div>
                    <div className="text-[10px] dark:text-slate-500 text-slate-400 font-mono mt-0.5 tabular-nums">
                      {new Date(r.created_at).toLocaleDateString([], {
                        month: "short",
                        day: "numeric",
                      })}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Bottom: Subtle System Health & Status Popover */}
      <div className="p-3.5 border-t dark:border-slate-800/80 border-slate-200 dark:bg-slate-950 bg-slate-100/60">
        <button
          type="button"
          onClick={() => setShowStatusModal(!showStatusModal)}
          className="cursor-pointer w-full flex items-center justify-between rounded-md border dark:border-slate-800/80 border-slate-300 dark:bg-slate-900/60 bg-white px-2.5 py-1.5 text-[11px] dark:text-slate-400 text-slate-600 hover:dark:text-slate-200 hover:text-slate-900 transition-colors shadow-2xs font-mono"
        >
          <div className="flex items-center gap-2">
            <span className="relative flex size-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex size-2 rounded-full bg-emerald-500"></span>
            </span>
            <span>Engine Status</span>
          </div>
          <span className="text-[10px] text-emerald-500 font-mono font-semibold">Online</span>
        </button>

        {showStatusModal && (
          <div className="mt-2 rounded-md border dark:border-slate-800 border-slate-200 dark:bg-slate-900 bg-white p-3 text-[10px] dark:text-slate-300 text-slate-700 font-mono space-y-1.5 shadow-xl animate-in fade-in duration-150 tabular-nums">
            <div className="flex items-center justify-between dark:text-slate-400 text-slate-500">
              <span>Retrieval DB:</span>
              <span className="text-emerald-500 font-semibold">PostgreSQL 16 + pgvector</span>
            </div>
            <div className="flex items-center justify-between dark:text-slate-400 text-slate-500">
              <span>HNSW Latency:</span>
              <span className="text-emerald-500">&lt; 10ms (ef=40)</span>
            </div>
            <div className="flex items-center justify-between dark:text-slate-400 text-slate-500">
              <span>Indexed Clauses:</span>
              <span>8,500+ Official Rows</span>
            </div>
            <div className="flex items-center justify-between dark:text-slate-400 text-slate-500">
              <span>Active Regimes:</span>
              <span>EMIR, UK, ASIC, MAS, HKMA</span>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}
