import { useEffect, useState } from "react";
import { api } from "../api";

function timeAgo(iso) {
  if (!iso) return "never";
  const diff = (Date.now() - new Date(iso + "Z").getTime()) / 1000;
  if (diff < 60)    return "just now";
  if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function MetricCard({ label, value, sub, gradient, textColor, iconBg, icon, onClick, active }) {
  return (
    <button
      onClick={onClick}
      className={`relative rounded-2xl p-3 sm:p-5 flex items-center gap-3 sm:gap-4 text-left w-full transition-all duration-200 overflow-hidden group ${
        active ? "ring-2 ring-white/60 scale-[1.02] shadow-xl" : "hover:scale-[1.01] hover:shadow-lg shadow-md"
      }`}
      style={{ background: gradient, color: textColor }}
    >
      {/* Decorative circle */}
      <div className="absolute -right-4 -top-4 w-24 h-24 rounded-full opacity-10 group-hover:opacity-15 transition-opacity" style={{ background: "white" }} />
      <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${iconBg}`}>
        {icon}
      </div>
      <div className="relative z-10">
        <p className="text-2xl font-bold leading-none tracking-tight">{value}</p>
        <p className="text-sm font-semibold mt-0.5 opacity-90">{label}</p>
        {sub && <p className="text-[10px] mt-0.5 opacity-60">{sub}</p>}
      </div>
    </button>
  );
}

export function StatsBar({ onFilter, activeFilter }) {
  const [stats, setStats] = useState(null);
  const [triggering, setTriggering] = useState(false);

  useEffect(() => {
    api.getStats().then(setStats).catch(() => {});
    const id = setInterval(() => api.getStats().then(setStats).catch(() => {}), 30000);
    return () => clearInterval(id);
  }, []);

  async function handleTrigger() {
    setTriggering(true);
    await api.triggerSearch().catch(() => {});
    setTimeout(() => { setTriggering(false); onFilter?.({ score_min: 6 }); }, 2000);
  }

  return (
    <div className="mb-8">
      {/* Page header */}
      <div className="flex flex-wrap items-start justify-between gap-3 mb-5">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Dashboard</h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Last scan: <span className="text-slate-500 font-medium">{stats ? timeAgo(stats.last_run) : "–"}</span>
          </p>
        </div>
        <div className="flex gap-2.5 flex-wrap">
          <a
            href={api.exportCsvUrl()}
            download="sturdy_fishstick_export.csv"
            className="inline-flex items-center gap-1.5 text-sm px-4 py-2 bg-white border border-slate-200 text-slate-600 rounded-xl hover:border-slate-300 hover:shadow-sm transition-all"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
              <polyline points="7 10 12 15 17 10"/>
              <line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
            Export
          </a>
          <button
            onClick={handleTrigger}
            disabled={triggering}
            className="inline-flex items-center gap-1.5 text-sm px-5 py-2 font-semibold rounded-xl disabled:opacity-60 transition-all shadow-sm text-white"
            style={{ background: "linear-gradient(135deg, #097C87, #1A8C72)" }}
          >
            {triggering ? (
              <>
                <svg className="animate-spin" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 12a9 9 0 11-6.22-8.56"/></svg>
                Scanning…
              </>
            ) : (
              <>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                Scan now
              </>
            )}
          </button>
        </div>
      </div>

      {/* Metric cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <MetricCard
          label="New today"
          value={stats?.new_today ?? "–"}
          sub="since midnight"
          gradient="linear-gradient(135deg, #23CED9 0%, #097C87 100%)"
          textColor="white"
          iconBg="bg-white/20"
          icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round"><path d="M12 5v14M5 12l7-7 7 7"/></svg>}
          onClick={() => onFilter?.({ score_min: 0 }, "new_today")}
          active={activeFilter === "new_today"}
        />
        <MetricCard
          label="Priority matches"
          value={stats?.priority_matches ?? "–"}
          sub="high score"
          gradient="linear-gradient(135deg, #FCA47C 0%, #FF7F6B 100%)"
          textColor="white"
          iconBg="bg-white/25"
          icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>}
          onClick={() => onFilter?.({ is_priority: true, score_min: 0 }, "priority")}
          active={activeFilter === "priority"}
        />
        <MetricCard
          label="Applications"
          value={stats?.applied ?? "–"}
          sub="tracked"
          gradient="linear-gradient(135deg, #A1CCA6 0%, #1A8C72 100%)"
          textColor="white"
          iconBg="bg-white/25"
          icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round"><path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2z"/><polyline points="22 6 12 13 2 6"/></svg>}
          onClick={() => onFilter?.({ status: "applied", score_min: 0 }, "applied")}
          active={activeFilter === "applied"}
        />
        <MetricCard
          label="Total indexed"
          value={stats?.total_jobs ?? "–"}
          sub="all time"
          gradient="linear-gradient(135deg, #F9D779 0%, #FCA47C 100%)"
          textColor="#7c4a00"
          iconBg="bg-black/10"
          icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#7c4a00" strokeWidth="2.2" strokeLinecap="round"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4.03 3-9 3S3 13.66 3 12"/><path d="M3 5v14c0 1.66 4.03 3 9 3s9-1.34 9-3V5"/></svg>}
          onClick={() => onFilter?.({ score_min: 0 }, "total")}
          active={activeFilter === "total"}
        />
      </div>
    </div>
  );
}
