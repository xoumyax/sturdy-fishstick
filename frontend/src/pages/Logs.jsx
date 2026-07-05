import { useEffect, useState } from "react";
import { api } from "../api";

const KIND_META = {
  scan:           { label: "Daily Scan",      icon: "🔍", color: "#097C87" },
  careers_crawl:  { label: "Career Crawl",    icon: "🏢", color: "#1A8C72" },
  phd_crawl:      { label: "PhD Crawl",       icon: "🎓", color: "#6366f1" },
  linkedin_crawl: { label: "LinkedIn Crawl",  icon: "💼", color: "#0077b5" },
  scoring:        { label: "AI Scoring",      icon: "⭐", color: "#d97706" },
  discovery:      { label: "Discovery",       icon: "🧭", color: "#a07010" },
};

const STATUS_STYLE = {
  started:   { label: "running",   bg: "#dbeafe", color: "#1d4ed8" },
  completed: { label: "done",      bg: "#d1fae5", color: "#047857" },
  failed:    { label: "failed",    bg: "#fee2e2", color: "#b91c1c" },
};

function timeAgo(iso) {
  const diff = (Date.now() - new Date(iso + (iso.endsWith("Z") ? "" : "Z")).getTime()) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function SummaryChip({ label, value, accent, pulse }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm px-4 py-3 flex items-center gap-3">
      <div
        className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${pulse ? "animate-pulse" : ""}`}
        style={{ background: accent }}
      />
      <div>
        <p className="text-lg font-bold text-slate-800 leading-none">{value}</p>
        <p className="text-[11px] text-slate-400 mt-1">{label}</p>
      </div>
    </div>
  );
}

export function Logs() {
  const [data, setData] = useState(null);

  useEffect(() => {
    const tick = () => api.getLogs().then(setData).catch(() => {});
    tick();
    const id = setInterval(tick, 10000);
    return () => clearInterval(id);
  }, []);

  const ongoing = data?.ongoing || [];
  const scoringActive = ongoing.includes("scoring");

  return (
    <div className="px-4 sm:px-6 lg:px-10 py-6 max-w-4xl mx-auto w-full">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100 tracking-tight">Logs</h1>
        <p className="text-sm text-slate-400 mt-0.5">
          Live activity — crawls, scans, and AI scoring · refreshes every 10s
        </p>
      </div>

      {/* Live summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <SummaryChip
          label={scoringActive ? "scoring now — jobs left" : "jobs awaiting score"}
          value={data?.pending_scores ?? "–"}
          accent={scoringActive ? "#d97706" : "#94a3b8"}
          pulse={scoringActive}
        />
        <SummaryChip label="PhD positions scored" value={data?.phd_scored ?? "–"} accent="#6366f1" />
        <SummaryChip
          label="Serper credits today"
          value={data ? `${data.serper_today}/${data.serper_cap}` : "–"}
          accent={data && data.serper_today >= data.serper_cap ? "#b91c1c" : "#1A8C72"}
        />
        <SummaryChip
          label="tasks running"
          value={ongoing.length}
          accent={ongoing.length ? "#1d4ed8" : "#94a3b8"}
          pulse={ongoing.length > 0}
        />
      </div>

      {/* Ongoing banner */}
      {ongoing.length > 0 && (
        <div className="mb-4 flex flex-wrap gap-2">
          {ongoing.map((k) => {
            const m = KIND_META[k] || { label: k, icon: "⚙️", color: "#64748b" };
            return (
              <span key={k} className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-xl animate-pulse"
                style={{ background: m.color + "15", color: m.color, border: `1px solid ${m.color}33` }}>
                {m.icon} {m.label} in progress…
              </span>
            );
          })}
        </div>
      )}

      {/* Event feed */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm divide-y divide-slate-100">
        {!data ? (
          <p className="text-sm text-slate-400 p-5">Loading…</p>
        ) : data.events.length === 0 ? (
          <p className="text-sm text-slate-400 p-5">No activity yet — trigger a scan or crawl from the Dashboard.</p>
        ) : (
          data.events.map((e, i) => {
            const m = KIND_META[e.kind] || { label: e.kind, icon: "⚙️", color: "#64748b" };
            const st = STATUS_STYLE[e.status] || STATUS_STYLE.completed;
            const isOngoing = e.status === "started" && ongoing.includes(e.kind) &&
              data.events.findIndex((x) => x.kind === e.kind) === i;
            return (
              <div key={`${e.ts}-${i}`} className="flex items-start gap-3 px-4 py-3">
                <div className="w-8 h-8 rounded-xl flex items-center justify-center text-sm flex-shrink-0 mt-0.5"
                  style={{ background: m.color + "15" }}>
                  {m.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-semibold text-slate-700">{m.label}</p>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${isOngoing ? "animate-pulse" : ""}`}
                      style={{ background: st.bg, color: st.color }}>
                      {isOngoing ? "running" : st.label}
                    </span>
                    <span className="text-[11px] text-slate-400 ml-auto flex-shrink-0">{timeAgo(e.ts)}</span>
                  </div>
                  {e.detail && (
                    <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{e.detail}</p>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
