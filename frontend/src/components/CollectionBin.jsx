import { useEffect, useState } from "react";
import { api } from "../api";

function CollectionCard({ job }) {
  const [open, setOpen] = useState(false);

  return (
    <div className={`rounded-xl border transition-all ${open ? "border-brand-teal/30 bg-brand-teal/3" : "border-slate-200 bg-white hover:border-slate-300"}`}>
      <button
        className="w-full flex items-center gap-3 px-4 py-3 text-left"
        onClick={() => setOpen((v) => !v)}
      >
        <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-sm flex-shrink-0">📦</div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-slate-700 truncate">{job.title}</p>
          <p className="text-[10px] text-slate-400 truncate mt-0.5">{job.location || "No location"} · {job.source}</p>
        </div>
        <svg className={`text-slate-400 flex-shrink-0 transition-transform ${open ? "rotate-180" : ""}`} width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="6 9 12 15 18 9"/></svg>
      </button>
      {open && (
        <div className="px-4 pb-3 border-t border-slate-100">
          {job.description && (
            <p className="text-[11px] text-slate-500 mt-2 mb-2 line-clamp-3 leading-relaxed">{job.description}</p>
          )}
          <a
            href={job.url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-xs font-medium text-brand-dark hover:underline"
          >
            Browse collection
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
          </a>
        </div>
      )}
    </div>
  );
}

export function CollectionBin() {
  const [jobs, setJobs] = useState([]);
  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (open && !loaded) {
      api.getAggregates()
        .then((data) => { setJobs(data); setLoaded(true); })
        .catch(() => setLoaded(true));
    }
  }, [open, loaded]);

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm mb-4">
      <button
        className="w-full flex items-center gap-3 px-5 py-4 text-left"
        onClick={() => setOpen((v) => !v)}
      >
        <div className="w-9 h-9 rounded-xl bg-brand-yellow/20 flex items-center justify-center text-base flex-shrink-0">📦</div>
        <div className="flex-1">
          <p className="text-sm font-semibold text-slate-700">Job Collections</p>
          <p className="text-[11px] text-slate-400 mt-0.5">Aggregate boards, search pages, and batch postings</p>
        </div>
        {loaded && jobs.length > 0 && (
          <span className="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">{jobs.length}</span>
        )}
        <svg className={`text-slate-400 transition-transform ${open ? "rotate-180" : ""}`} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="6 9 12 15 18 9"/></svg>
      </button>

      {open && (
        <div className="px-5 pb-5 border-t border-slate-100">
          {!loaded ? (
            <div className="flex items-center gap-2 text-xs text-slate-400 py-4">
              <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12a9 9 0 11-6.22-8.56"/></svg>
              Loading collections…
            </div>
          ) : jobs.length === 0 ? (
            <p className="text-xs text-slate-400 py-4">No collections yet. They appear here once scraped.</p>
          ) : (
            <div className="grid grid-cols-1 gap-2 mt-4">
              {jobs.map((job) => <CollectionCard key={job.id} job={job} />)}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
