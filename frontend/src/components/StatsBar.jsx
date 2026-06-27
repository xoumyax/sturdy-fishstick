import { useEffect, useState } from "react";
import { api } from "../api";

function timeAgo(iso) {
  if (!iso) return "never";
  const diff = (Date.now() - new Date(iso + "Z").getTime()) / 1000;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export function StatsBar({ onTrigger }) {
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
    setTimeout(() => {
      setTriggering(false);
      onTrigger?.();
    }, 2000);
  }

  return (
    <div className="flex flex-wrap items-center gap-4 bg-indigo-600 text-white px-5 py-3 rounded-xl mb-4 shadow">
      <Stat label="New today" value={stats?.new_today ?? "–"} />
      <Stat label="Priority" value={stats?.priority_matches ?? "–"} />
      <Stat label="Applied" value={stats?.applied ?? "–"} />
      <Stat label="Last run" value={stats ? timeAgo(stats.last_run) : "–"} />
      <div className="ml-auto flex gap-2">
        <a
          href={api.exportCsvUrl()}
          download="jobradar_export.csv"
          className="text-sm px-3 py-1.5 bg-indigo-500 text-white rounded-lg hover:bg-indigo-400 transition-colors"
        >
          Export CSV
        </a>
        <button
          onClick={handleTrigger}
          disabled={triggering}
          className="text-sm px-4 py-1.5 bg-white text-indigo-700 font-semibold rounded-lg disabled:opacity-60 hover:bg-indigo-50 transition-colors"
        >
          {triggering ? "Searching…" : "Search now"}
        </button>
      </div>
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div className="text-sm">
      <span className="opacity-70">{label}: </span>
      <span className="font-bold">{value}</span>
    </div>
  );
}
