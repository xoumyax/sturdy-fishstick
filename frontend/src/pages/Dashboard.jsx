import { useCallback, useEffect, useState } from "react";
import { api } from "../api";
import { CollectionBin } from "../components/CollectionBin";
import { FilterBar } from "../components/FilterBar";
import { JobCard } from "../components/JobCard";
import { StatsBar } from "../components/StatsBar";
import { TrendCharts } from "../components/TrendCharts";

const COUNTRY_FLAGS = {
  "United States": "🇺🇸", "India": "🇮🇳", "Taiwan": "🇹🇼",
  "Germany": "🇩🇪", "Canada": "🇨🇦", "United Kingdom": "🇬🇧",
  "Remote": "🌐", "Other": "🌍", "Singapore": "🇸🇬",
  "Japan": "🇯🇵", "Australia": "🇦🇺", "France": "🇫🇷",
  "Netherlands": "🇳🇱", "Sweden": "🇸🇪", "Switzerland": "🇨🇭",
  "South Korea": "🇰🇷", "China": "🇨🇳", "Hong Kong": "🇭🇰",
};

const COUNTRY_GRADIENTS = [
  "linear-gradient(135deg, #23CED9, #097C87)",
  "linear-gradient(135deg, #FCA47C, #FF7F6B)",
  "linear-gradient(135deg, #A1CCA6, #1A8C72)",
  "linear-gradient(135deg, #F9D779, #FCA47C)",
  "linear-gradient(135deg, #097C87, #1A8C72)",
  "linear-gradient(135deg, #FFB89A, #FCA47C)",
  "linear-gradient(135deg, #B8EDD6, #A1CCA6)",
  "linear-gradient(135deg, #23CED9, #1A8C72)",
];

function CountryCard({ country, total, priority, applied, active, gradient, onClick }) {
  const flag = COUNTRY_FLAGS[country] || "🌍";
  return (
    <button
      onClick={onClick}
      className={`relative rounded-2xl p-4 text-left overflow-hidden transition-all duration-200 w-full ${
        active
          ? "ring-3 ring-offset-2 scale-[1.03] shadow-xl"
          : "bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 hover:scale-[1.02] hover:shadow-lg shadow-sm"
      }`}
      style={active ? { background: gradient } : {}}
    >
      {/* Decorative blob */}
      <div
        className="absolute -right-3 -bottom-3 w-16 h-16 rounded-full opacity-10"
        style={{ background: active ? "white" : "#23CED9" }}
      />
      <div className="flex items-start justify-between mb-2">
        <span className="text-2xl">{flag}</span>
        {priority > 0 && (
          <span
            className="text-[9px] font-bold px-1.5 py-0.5 rounded-full"
            style={{
              background: active ? "rgba(255,255,255,0.25)" : "#FCA47C22",
              color: active ? "white" : "#c05020",
            }}
          >
            {priority} ★
          </span>
        )}
      </div>
      <p className={`text-2xl font-bold leading-none mb-1 ${active ? "text-white" : "text-slate-800"}`}>
        {total}
      </p>
      <p className={`text-xs font-semibold truncate ${active ? "text-white/85" : "text-slate-600"}`}>
        {country}
      </p>
      {applied > 0 && (
        <p className={`text-[10px] mt-0.5 ${active ? "text-white/60" : "text-slate-400"}`}>
          {applied} applied
        </p>
      )}
    </button>
  );
}

const VIEWS = ["Jobs", "Trends"];

const PANEL_TABS = [
  {
    key: "linkedin",
    label: "LinkedIn",
    color: "#0077b5",
    icon: (
      <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor">
        <path d="M16 8a6 6 0 016 6v7h-4v-7a2 2 0 00-2-2 2 2 0 00-2 2v7h-4v-7a6 6 0 016-6zM2 9h4v12H2z"/>
        <circle cx="4" cy="4" r="2"/>
      </svg>
    ),
  },
  {
    key: "careers",
    label: "Careers",
    color: "#097C87",
    icon: (
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v2"/>
      </svg>
    ),
  },
  {
    key: "phd",
    label: "PhD",
    color: "#6366f1",
    icon: (
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/>
      </svg>
    ),
  },
];

export function Dashboard({ onChat, panelVis, onShowPanel }) {
  const [jobs, setJobs] = useState([]);
  const [view, setView] = useState("Jobs");
  const [filters, setFilters] = useState({ score_min: 6 });
  const [activeFilter, setActiveFilter] = useState(null); // which metric card is active
  const [loading, setLoading] = useState(false);
  const [config, setConfig] = useState(null);
  const [trends, setTrends] = useState(null);
  const [activeCountry, setActiveCountry] = useState(null);
  const [crawlMsg, setCrawlMsg] = useState(null);

  useEffect(() => {
    api.getConfig().then(setConfig).catch(() => {});
    api.getTrends().then(setTrends).catch(() => {});
  }, []);

  const fetchJobs = useCallback(async () => {
    if (view === "Trends") return;
    setLoading(true);
    const params = { ...filters };
    if (activeCountry) params.country = activeCountry;
    try {
      const data = await api.getJobs(params);
      setJobs(data);
    } finally { setLoading(false); }
  }, [view, filters, activeCountry]);

  useEffect(() => { fetchJobs(); }, [fetchJobs]);

  function handleUpdate(updated) {
    setJobs((prev) => prev.map((j) => (j.id === updated.id ? updated : j)));
  }

  function handleDelete(id) {
    setJobs((prev) => prev.filter((j) => j.id !== id));
  }

  function handleMetricFilter(newFilters, filterId) {
    setActiveFilter((prev) => prev === filterId ? null : filterId);
    if (activeFilter === filterId) {
      setFilters({ score_min: 6 });
    } else {
      setFilters(newFilters);
    }
    setActiveCountry(null);
  }

  const countries = (trends?.countries || []).filter((c) => c.total > 0);
  const multiLocation = config?.profile?.location_preference?.length > 1;
  const showCountryCards = multiLocation && countries.length > 0;

  async function triggerCrawl(fn, label) {
    try {
      await fn();
      setCrawlMsg(`${label} started — results will appear shortly`);
      setTimeout(() => setCrawlMsg(null), 4000);
    } catch {
      setCrawlMsg("Failed to start crawl");
      setTimeout(() => setCrawlMsg(null), 3000);
    }
  }

  return (
    <div className="px-4 sm:px-6 lg:px-10 py-6 max-w-6xl mx-auto w-full">
      <StatsBar
        onFilter={(f, id) => handleMetricFilter(f, id)}
        activeFilter={activeFilter}
      />

      {/* View switcher */}
      <div className="flex gap-1 mb-6 p-1 w-fit rounded-xl" style={{ background: "rgba(9,124,135,0.08)" }}>
        {VIEWS.map((v) => (
          <button
            key={v}
            onClick={() => setView(v)}
            className="px-5 py-1.5 text-sm font-medium rounded-lg transition-all duration-150"
            style={
              view === v
                ? { background: "white", color: "#097C87", boxShadow: "0 1px 4px rgba(0,0,0,0.1)", fontWeight: 600 }
                : { color: "#5d8a8f" }
            }
          >
            {v}
          </button>
        ))}
      </div>

      {view === "Trends" ? (
        <TrendCharts />
      ) : (
        <>
          {/* Crawl buttons + hidden panel tabs */}
          <div className="flex items-center gap-2 mb-5 flex-wrap">
            <button
              onClick={() => triggerCrawl(api.crawlCareers, "Career crawl")}
              className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-xl transition-all hover:scale-[1.02]"
              style={{ background: "linear-gradient(135deg,#097C87,#1A8C72)", color: "white" }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
              Crawl Careers
            </button>
            <button
              onClick={() => triggerCrawl(api.crawlPhd, "PhD crawl")}
              className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-xl transition-all hover:scale-[1.02]"
              style={{ background: "linear-gradient(135deg,#6366f1,#8b5cf6)", color: "white" }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/></svg>
              Crawl PhD
            </button>

            {/* Hidden panel restore tabs */}
            {panelVis && PANEL_TABS.some((t) => !panelVis[t.key]) && (
              <div className="h-4 w-px bg-slate-200 mx-0.5" />
            )}
            {panelVis && PANEL_TABS.filter((t) => !panelVis[t.key]).map((tab) => (
              <button
                key={tab.key}
                onClick={() => onShowPanel?.(tab.key)}
                className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-xl transition-all hover:scale-[1.02]"
                style={{
                  border: `1.5px solid ${tab.color}55`,
                  color: tab.color,
                  background: tab.color + "0d",
                }}
                title={`Show ${tab.label} feed`}
              >
                {tab.icon}
                {tab.label} Feed
              </button>
            ))}

            {crawlMsg && (
              <span className="text-xs text-slate-500 ml-1 animate-pulse">{crawlMsg}</span>
            )}
          </div>

          {/* Country filter cards */}
          {showCountryCards && (
            <div className="mb-7">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">By Region</p>
                {activeCountry && (
                  <button
                    onClick={() => setActiveCountry(null)}
                    className="text-xs text-brand-dark font-medium hover:underline flex items-center gap-1"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                    Clear
                  </button>
                )}
              </div>
              <div className="overflow-x-auto pb-2" style={{ scrollbarWidth: "thin", scrollbarColor: "#b8ebd8 transparent" }}>
                <div className="flex gap-3 pr-8" style={{ width: "max-content" }}>
                  {countries.map((c, i) => (
                    <div key={c.country} style={{ width: 130, flexShrink: 0 }}>
                      <CountryCard
                        country={c.country}
                        total={c.total}
                        priority={c.priority}
                        applied={c.applied}
                        gradient={COUNTRY_GRADIENTS[i % COUNTRY_GRADIENTS.length]}
                        active={activeCountry === c.country}
                        onClick={() => {
                          setActiveCountry(activeCountry === c.country ? null : c.country);
                          setActiveFilter(null);
                        }}
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Collection Bin */}
          <CollectionBin />

          {/* Filter bar */}
          <FilterBar filters={filters} onChange={(f) => { setFilters(f); setActiveFilter(null); }} />

          {/* Job list */}
          {loading ? (
            <div className="flex items-center justify-center h-48">
              <div className="flex items-center gap-3 text-slate-400">
                <svg className="animate-spin" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12a9 9 0 11-6.22-8.56"/></svg>
                Loading…
              </div>
            </div>
          ) : jobs.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-slate-400">
              <span className="text-5xl mb-4">🐟</span>
              <p className="text-sm font-medium">No jobs match your current filters.</p>
              <button
                onClick={() => { setFilters({ score_min: 6 }); setActiveFilter(null); setActiveCountry(null); }}
                className="mt-3 text-xs text-brand-dark font-semibold hover:underline"
              >
                Reset filters
              </button>
            </div>
          ) : (
            <div>
              <p className="text-xs text-slate-400 mb-3 font-medium">
                {jobs.length} jobs{activeCountry ? ` · ${COUNTRY_FLAGS[activeCountry] || ""} ${activeCountry}` : ""}
              </p>
              <div className="xl:grid xl:grid-cols-2 xl:gap-3">
                {jobs.map((job) => <JobCard key={job.id} job={job} onUpdate={handleUpdate} onChat={onChat} onDelete={handleDelete} />)}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
