import { useEffect, useState } from "react";
import { api } from "../api";

function MiniJobCard({ job, accent }) {
  return (
    <a
      href={job.url}
      target="_blank"
      rel="noopener noreferrer"
      className="block rounded-xl px-3 py-2.5 hover:bg-slate-50 transition-colors border border-slate-100 group"
    >
      <div className="flex items-start gap-2">
        <div
          className="w-7 h-7 rounded-lg flex items-center justify-center text-[11px] font-bold flex-shrink-0 mt-0.5"
          style={{ background: accent + "22", color: accent }}
        >
          {(job.company || job.title || "?")[0]?.toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold text-slate-800 leading-snug truncate group-hover:opacity-80 transition-opacity">
            {job.title}
          </p>
          <p className="text-[10px] text-slate-500 truncate mt-0.5">{job.company || "—"}</p>
          <div className="flex items-center gap-1.5 mt-1 flex-wrap">
            {job.country && (
              <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-500">
                {job.country}
              </span>
            )}
            {job.match_score != null && (
              <span
                className="text-[9px] px-1.5 py-0.5 rounded-full font-bold"
                style={{
                  background: job.match_score >= 7 ? "#1A8C7222" : "#94a3b822",
                  color: job.match_score >= 7 ? "#1A8C72" : "#64748b",
                }}
              >
                {job.match_score}/10
              </span>
            )}
          </div>
        </div>
      </div>
    </a>
  );
}

function CompanySection({ company, jobs, accent }) {
  return (
    <div className="mb-6 last:mb-0">
      <div className="flex items-center gap-2 mb-2">
        <div
          className="w-7 h-7 rounded-xl flex items-center justify-center text-[11px] font-bold text-white flex-shrink-0"
          style={{ background: accent }}
        >
          {company[0]?.toUpperCase()}
        </div>
        <p className="text-sm font-bold text-slate-800">{company}</p>
        <span className="text-[10px] text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
          {jobs.length} {jobs.length === 1 ? "position" : "positions"}
        </span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 pl-9">
        {jobs.map((job) => (
          <MiniJobCard key={job.id} job={job} accent={accent} />
        ))}
      </div>
    </div>
  );
}

function ExpandedModal({ jobs, onClose, label, accent, accentDark, headerIcon }) {
  const grouped = jobs.reduce((acc, j) => {
    const co = j.company || "Unknown";
    (acc[co] = acc[co] || []).push(j);
    return acc;
  }, {});

  const sorted = Object.entries(grouped).sort(([, a], [, b]) => {
    const topA = Math.max(...a.map((j) => j.match_score ?? -1));
    const topB = Math.max(...b.map((j) => j.match_score ?? -1));
    return topB - topA || b.length - a.length;
  });

  return (
    <div
      className="fixed inset-0 bg-black/50 z-[70] flex items-center justify-center p-6 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-3xl shadow-2xl flex flex-col overflow-hidden"
        style={{ width: "min(1000px, 95vw)", maxHeight: "88vh" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="flex items-center gap-3 px-6 py-4 flex-shrink-0"
          style={{ background: `linear-gradient(135deg, ${accent}, ${accentDark})` }}
        >
          {headerIcon("white")}
          <p className="text-white font-bold flex-1">All {label} Listings</p>
          <span className="text-white/60 text-sm">
            {jobs.length} positions · {sorted.length} {sorted.length === 1 ? "company" : "companies"}
          </span>
          <button
            onClick={onClose}
            className="text-white/70 hover:text-white px-3 py-1.5 rounded-xl hover:bg-white/20 transition-colors text-sm"
          >
            Close
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 min-h-0">
          {sorted.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 text-slate-400 text-sm">
              <p>No listings yet.</p>
              <p className="text-xs mt-1 opacity-70">Run a crawl from the Dashboard.</p>
            </div>
          ) : (
            sorted.map(([company, compJobs]) => (
              <CompanySection key={company} company={company} jobs={compJobs} accent={accent} />
            ))
          )}
        </div>
      </div>
    </div>
  );
}

export function FloatingJobPanel({ label, sources, accent, accentDark, headerIcon, chatOpen, toggleBottom }) {
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(false);

  const rightOffset = chatOpen ? 406 : 16;

  useEffect(() => {
    if (!open || jobs.length > 0) return;
    setLoading(true);
    Promise.all(sources.map((src) => api.getJobs({ source: src, score_min: 0 })))
      .then((results) => {
        const merged = results
          .flat()
          .sort((a, b) => (b.match_score ?? -1) - (a.match_score ?? -1));
        setJobs(merged);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [open]);

  const panelBottom = toggleBottom + 42;

  return (
    <>
      {/* Toggle badge */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="fixed flex items-center gap-1.5 rounded-2xl px-3 py-2 shadow-lg hover:scale-105"
        style={{
          right: rightOffset,
          bottom: toggleBottom,
          zIndex: 50,
          background: open ? accent : "white",
          border: `1.5px solid ${accent}44`,
          color: open ? "white" : accent,
          transition: "right 0.3s ease, background 0.15s, transform 0.15s",
        }}
        title={label}
      >
        {headerIcon(open ? "white" : accent)}
        <span className="text-[11px] font-bold">{label}</span>
        {jobs.length > 0 && !open && (
          <span
            className="text-[9px] font-bold px-1.5 py-0.5 rounded-full"
            style={{ background: accent + "22", color: accent }}
          >
            {jobs.length}
          </span>
        )}
        {jobs.length === 0 && !open && <span className="text-[9px] opacity-60">feed</span>}
      </button>

      {/* Mini panel */}
      {open && (
        <div
          className="fixed flex flex-col rounded-3xl overflow-hidden"
          style={{
            right: rightOffset,
            bottom: panelBottom,
            width: 284,
            maxHeight: 380,
            zIndex: 50,
            background: "white",
            border: `1.5px solid ${accent}2e`,
            boxShadow: `0 8px 40px rgba(0,0,0,0.14), 0 2px 8px ${accent}1a`,
            transition: "right 0.3s ease",
          }}
        >
          {/* Header */}
          <div
            className="flex items-center gap-2 px-4 py-3 flex-shrink-0"
            style={{ background: `linear-gradient(135deg, ${accent}, ${accentDark})` }}
          >
            {headerIcon("white")}
            <p className="text-white font-bold text-sm flex-1">{label} Feed</p>
            <span className="text-white/60 text-[10px]">{jobs.length} found</span>
            <button
              onClick={(e) => { e.stopPropagation(); setExpanded(true); }}
              title="Expand all"
              className="text-white/60 hover:text-white w-6 h-6 flex items-center justify-center rounded-lg hover:bg-white/20 transition-colors"
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
              </svg>
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); setOpen(false); }}
              className="text-white/60 hover:text-white w-5 h-5 flex items-center justify-center rounded-lg hover:bg-white/20 transition-colors"
            >
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>

          {/* Job list */}
          <div className="flex-1 overflow-y-auto px-2 py-2 space-y-1 min-h-0">
            {loading ? (
              <div className="flex items-center justify-center h-24 text-slate-400 text-xs">
                <svg className="animate-spin mr-2" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 12a9 9 0 11-6.22-8.56" />
                </svg>
                Loading…
              </div>
            ) : jobs.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-24 text-slate-400 text-xs text-center px-4">
                <p>No listings yet.</p>
                <p className="mt-1 opacity-70">Run a crawl from the Dashboard.</p>
              </div>
            ) : (
              jobs.slice(0, 20).map((job) => <MiniJobCard key={job.id} job={job} accent={accent} />)
            )}
          </div>

          {/* Footer */}
          <div className="px-4 py-2 border-t border-slate-100 flex-shrink-0 flex items-center justify-between">
            <p className="text-[9px] text-slate-400">
              {jobs.length > 20 ? `Showing 20 of ${jobs.length}` : `${jobs.length} listings`} · by score
            </p>
            {jobs.length > 20 && (
              <button
                onClick={() => setExpanded(true)}
                className="text-[10px] font-semibold"
                style={{ color: accent }}
              >
                See all →
              </button>
            )}
          </div>
        </div>
      )}

      {/* Expanded company-grouped modal */}
      {expanded && (
        <ExpandedModal
          jobs={jobs}
          onClose={() => setExpanded(false)}
          label={label}
          accent={accent}
          accentDark={accentDark}
          headerIcon={headerIcon}
        />
      )}
    </>
  );
}
