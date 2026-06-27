import { useEffect, useState, useCallback } from "react";
import { api } from "../api";
import { FilterBar } from "../components/FilterBar";
import { JobCard } from "../components/JobCard";
import { StatsBar } from "../components/StatsBar";

const TABS = ["All", "Priority", "Applied"];

export function Dashboard() {
  const [jobs, setJobs] = useState([]);
  const [tab, setTab] = useState("All");
  const [filters, setFilters] = useState({});
  const [loading, setLoading] = useState(false);

  const fetchJobs = useCallback(async () => {
    setLoading(true);
    const params = { ...filters };
    if (tab === "Priority") params.is_priority = true;
    if (tab === "Applied") params.status = "applied";
    try {
      const data = await api.getJobs(params);
      setJobs(data);
    } finally {
      setLoading(false);
    }
  }, [tab, filters]);

  useEffect(() => { fetchJobs(); }, [fetchJobs]);

  function handleUpdate(updated) {
    setJobs((prev) => prev.map((j) => (j.id === updated.id ? updated : j)));
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      <h1 className="text-2xl font-bold text-slate-800 mb-4">JobRadar</h1>

      <StatsBar onTrigger={fetchJobs} />

      {/* Tab bar */}
      <div className="flex gap-1 mb-4">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
              tab === t ? "bg-indigo-600 text-white" : "bg-white text-slate-600 border hover:border-indigo-400"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Filters — only on All tab */}
      {tab === "All" && <FilterBar filters={filters} onChange={setFilters} />}

      {/* Job list */}
      {loading ? (
        <p className="text-center text-slate-400 mt-8">Loading…</p>
      ) : jobs.length === 0 ? (
        <div className="text-center text-slate-400 mt-12">
          <p className="text-4xl mb-2">🔍</p>
          <p>No jobs found. Hit "Search now" to kick off a search.</p>
        </div>
      ) : (
        <div>
          <p className="text-xs text-slate-400 mb-2">{jobs.length} jobs</p>
          {jobs.map((job) => (
            <JobCard key={job.id} job={job} onUpdate={handleUpdate} />
          ))}
        </div>
      )}
    </div>
  );
}
