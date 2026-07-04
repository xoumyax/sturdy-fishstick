import { useEffect, useState } from "react";
import { api } from "../api";

const LI_BLUE = "#0077b5";

function MiniJobCard({ job }) {
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
          style={{ background: LI_BLUE + "22", color: LI_BLUE }}
        >
          {(job.company || job.title || "?")[0]?.toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold text-slate-800 leading-snug truncate group-hover:text-[#0077b5] transition-colors">
            {job.title}
          </p>
          <p className="text-[10px] text-slate-500 truncate mt-0.5">
            {job.company || "—"}
          </p>
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
            {job.source === "linkedin_direct" && (
              <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-600 font-medium">✓ Direct</span>
            )}
          </div>
        </div>
      </div>
    </a>
  );
}

function ExpandedModal({ jobs, onClose }) {
  return (
    <div className="fixed inset-0 bg-black/50 z-[70] flex items-center justify-center p-6 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-white rounded-3xl shadow-2xl flex flex-col overflow-hidden"
        style={{ width: "min(900px, 95vw)", maxHeight: "85vh" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 px-6 py-4 flex-shrink-0"
          style={{ background: `linear-gradient(135deg, ${LI_BLUE}, #004b77)` }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="white">
            <path d="M16 8a6 6 0 016 6v7h-4v-7a2 2 0 00-2-2 2 2 0 00-2 2v7h-4v-7a6 6 0 016-6zM2 9h4v12H2z"/>
            <circle cx="4" cy="4" r="2"/>
          </svg>
          <p className="text-white font-bold flex-1">All LinkedIn Listings</p>
          <span className="text-white/60 text-sm">{jobs.length} jobs</span>
          <button onClick={onClose} className="text-white/70 hover:text-white px-3 py-1.5 rounded-xl hover:bg-white/20 transition-colors text-sm">
            Close
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 min-h-0">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {jobs.map((job) => <MiniJobCard key={job.id} job={job} />)}
          </div>
        </div>
      </div>
    </div>
  );
}

function PostCard({ job }) {
  return (
    <a
      href={job.url}
      target="_blank"
      rel="noopener noreferrer"
      className="block rounded-xl px-3 py-2.5 hover:bg-slate-50 transition-colors border border-slate-100 group"
    >
      <div className="flex items-start gap-2">
        <div
          className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
          style={{ background: LI_BLUE + "18", color: LI_BLUE }}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
          </svg>
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold text-slate-800 leading-snug group-hover:text-[#0077b5] transition-colors line-clamp-2">
            {job.title}
          </p>
          {job.description && (
            <p className="text-[10px] text-slate-500 mt-0.5 line-clamp-2">{job.description}</p>
          )}
        </div>
      </div>
    </a>
  );
}

export function LinkedInPanel({ chatOpen, onHide, mode = "careers" }) {
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [tab, setTab] = useState("listings"); // listings | posts
  const [jobs, setJobs] = useState([]);
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [loadedFor, setLoadedFor] = useState(null); // which mode the data belongs to

  const rightOffset = chatOpen ? 406 : 16;

  function load() {
    setLoading(true);
    Promise.all([
      api.getJobs({ source: "linkedin", mode, kind: "listing", score_min: 0 }),
      api.getJobs({ source: "linkedin_direct", mode, score_min: 0 }),
      api.getJobs({ source: "linkedin", mode, kind: "post", score_min: 0 }),
    ])
      .then(([li, lid, po]) => {
        const merged = [...li, ...lid].sort(
          (a, b) => (b.match_score ?? -1) - (a.match_score ?? -1)
        );
        setJobs(merged);
        setPosts(po);
        setLoadedFor(mode);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    if (open && loadedFor !== mode) load();
  }, [open, mode]);

  async function handleFetch() {
    setFetching(true);
    try {
      await api.crawlLinkedin();
      // listings arrive over ~1-2 min; refresh a few times
      setTimeout(load, 45000);
      setTimeout(load, 120000);
      setTimeout(() => setFetching(false), 120000);
    } catch {
      setFetching(false);
    }
  }

  const shown = tab === "posts" ? posts : jobs;

  return (
    <>
      {/* Toggle badge wrapper — group for hide button */}
      <div
        className="fixed group/badge"
        style={{ right: rightOffset, bottom: 155, zIndex: 50, transition: "right 0.3s ease" }}
      >
        <button
          onClick={() => setOpen((v) => !v)}
          className="flex items-center gap-1.5 rounded-2xl px-3 py-2 shadow-lg hover:scale-105 bg-white"
          style={{
            ...(open ? { background: LI_BLUE } : {}),
            border: `1.5px solid ${LI_BLUE}44`,
            color: open ? "white" : LI_BLUE,
            transition: "background 0.15s, transform 0.15s",
          }}
          title="LinkedIn jobs"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
            <path d="M16 8a6 6 0 016 6v7h-4v-7a2 2 0 00-2-2 2 2 0 00-2 2v7h-4v-7a6 6 0 016-6zM2 9h4v12H2z"/>
            <circle cx="4" cy="4" r="2"/>
          </svg>
          <span className="text-[11px] font-bold">LinkedIn</span>
          {jobs.length > 0 && !open && (
            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: LI_BLUE + "22", color: LI_BLUE }}>
              {jobs.length}
            </span>
          )}
          {jobs.length === 0 && !open && <span className="text-[9px] opacity-60">feed</span>}
        </button>
        {/* Hide button — appears on hover */}
        {onHide && (
          <button
            onClick={(e) => { e.stopPropagation(); setOpen(false); onHide(); }}
            title="Hide panel"
            className="absolute -top-2 -right-2 w-4 h-4 rounded-full flex items-center justify-center opacity-0 group-hover/badge:opacity-100 transition-opacity shadow-sm"
            style={{ background: "#64748b", color: "white", fontSize: 9 }}
          >
            ×
          </button>
        )}
      </div>

      {/* Mini panel */}
      {open && (
        <div
          className="fixed flex flex-col rounded-3xl overflow-hidden bg-white"
          style={{
            right: rightOffset, bottom: 195,
            width: 284,
            maxHeight: 420,
            zIndex: 50,
            border: "1.5px solid rgba(0,119,181,0.18)",
            boxShadow: "0 8px 40px rgba(0,0,0,0.14), 0 2px 8px rgba(0,119,181,0.10)",
            transition: "right 0.3s ease",
          }}
        >
          {/* Header */}
          <div className="flex items-center gap-2 px-4 py-3 flex-shrink-0"
            style={{ background: `linear-gradient(135deg, ${LI_BLUE}, #004b77)` }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="white">
              <path d="M16 8a6 6 0 016 6v7h-4v-7a2 2 0 00-2-2 2 2 0 00-2 2v7h-4v-7a6 6 0 016-6zM2 9h4v12H2z"/>
              <circle cx="4" cy="4" r="2"/>
            </svg>
            <p className="text-white font-bold text-sm flex-1">
              LinkedIn{mode === "phd" ? " · PhD" : ""}
            </p>
            <button
              onClick={(e) => { e.stopPropagation(); handleFetch(); }}
              disabled={fetching}
              title="Fetch fresh listings + posts (takes 1–2 min)"
              className="text-white/70 hover:text-white text-[10px] font-semibold px-2 py-1 rounded-lg hover:bg-white/20 transition-colors disabled:opacity-50 flex items-center gap-1"
            >
              {fetching ? (
                <svg className="animate-spin" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 12a9 9 0 11-6.22-8.56"/></svg>
              ) : (
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M23 4v6h-6M1 20v-6h6"/><path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/></svg>
              )}
              {fetching ? "Fetching…" : "Fetch"}
            </button>
            {/* Expand button */}
            <button
              onClick={(e) => { e.stopPropagation(); setExpanded(true); }}
              title="Expand all"
              className="text-white/60 hover:text-white w-6 h-6 flex items-center justify-center rounded-lg hover:bg-white/20 transition-colors"
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/>
              </svg>
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); setOpen(false); }}
              className="text-white/60 hover:text-white w-5 h-5 flex items-center justify-center rounded-lg hover:bg-white/20 transition-colors"
            >
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>

          {/* Listings / Posts tabs */}
          <div className="flex gap-1 px-2 pt-2 flex-shrink-0">
            {[
              { id: "listings", label: `Listings${jobs.length ? ` (${jobs.length})` : ""}` },
              { id: "posts", label: `Posts${posts.length ? ` (${posts.length})` : ""}` },
            ].map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className="flex-1 text-[10px] font-bold py-1.5 rounded-lg transition-colors"
                style={tab === t.id
                  ? { background: LI_BLUE + "18", color: LI_BLUE }
                  : { color: "#94a3b8" }}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Jobs / posts list */}
          <div className="flex-1 overflow-y-auto px-2 py-2 space-y-1 min-h-0">
            {loading ? (
              <div className="flex items-center justify-center h-24 text-slate-400 text-xs">
                <svg className="animate-spin mr-2" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12a9 9 0 11-6.22-8.56"/></svg>
                Loading…
              </div>
            ) : shown.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-24 text-slate-400 text-xs text-center px-4">
                <p>No {tab === "posts" ? "hiring posts" : "LinkedIn listings"} yet.</p>
                <p className="mt-1 opacity-70">Hit Fetch above — takes a minute or two.</p>
              </div>
            ) : tab === "posts" ? (
              shown.slice(0, 30).map((job) => <PostCard key={job.id} job={job} />)
            ) : (
              shown.slice(0, 30).map((job) => <MiniJobCard key={job.id} job={job} />)
            )}
          </div>

          {/* Footer */}
          <div className="px-4 py-2 border-t border-slate-100 flex-shrink-0 flex items-center justify-between">
            <p className="text-[9px] text-slate-400">
              {shown.length > 30 ? `Showing 30 of ${shown.length}` : `${shown.length} ${tab}`}{tab === "listings" ? " · by score" : ""}
            </p>
            {shown.length > 30 && tab === "listings" && (
              <button onClick={() => setExpanded(true)} className="text-[10px] font-semibold" style={{ color: LI_BLUE }}>
                See all →
              </button>
            )}
          </div>
        </div>
      )}

      {/* Full expanded modal */}
      {expanded && <ExpandedModal jobs={jobs} onClose={() => setExpanded(false)} />}
    </>
  );
}
