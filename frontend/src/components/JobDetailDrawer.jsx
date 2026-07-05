import { useEffect } from "react";
import { CompanyAvatar, JobDetails } from "./JobCard";
import { ScoreBadge } from "./ScoreBadge";

/** Right-side drawer showing one job's full details. Opened by clicking a
 *  JobCard on wide (2-column) screens so the grid neighbor never stretches. */
export function JobDetailDrawer({ job, onClose, onUpdate, onChat, onDelete, mode }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  if (!job) return null;

  const isPhd = mode === "phd";
  const headerBg = isPhd
    ? "linear-gradient(135deg, #818cf8, #6366f1)"
    : "linear-gradient(135deg, #097C87, #1A8C72)";

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40"
        style={{ background: "rgba(0,0,0,0.12)", backdropFilter: "blur(0.5px)" }}
        onClick={onClose}
      />

      {/* Drawer */}
      <div
        className="fixed top-0 right-0 h-full z-40 flex flex-col bg-white shadow-2xl"
        style={{
          width: "min(480px, 92vw)",
          borderLeft: "1.5px solid #d1ede8",
          boxShadow: "-8px 0 40px rgba(0,0,0,0.15)",
          animation: "drawer-in 0.22s ease-out",
        }}
      >
        {/* Header */}
        <div className="flex-shrink-0 px-5 py-4" style={{ background: headerBg }}>
          <div className="flex items-start gap-3">
            <CompanyAvatar company={job.company} title={job.title} />
            <div className="flex-1 min-w-0">
              <p className="text-white font-bold text-sm leading-snug">{job.title}</p>
              <p className="text-white/70 text-xs mt-0.5 truncate">
                {job.company || "Unknown"}{job.location ? ` · ${job.location}` : ""}
              </p>
              <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                <ScoreBadge score={job.match_score} />
                {job.country && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-white/20 text-white">{job.country}</span>
                )}
                {job.source && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-white/15 text-white/85">{job.source}</span>
                )}
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-white/70 hover:text-white p-1.5 rounded-lg hover:bg-white/15 transition-colors flex-shrink-0"
              title="Close (Esc)"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        </div>

        {/* Body — full details, full description */}
        <div className="flex-1 overflow-y-auto px-5 py-5">
          <JobDetails key={job.id} job={job} onUpdate={onUpdate} onChat={onChat} mode={mode} fullDescription />
          <button
            onClick={() => { onDelete?.(job.id); }}
            className="mt-6 text-xs text-red-400 hover:text-red-600 transition-colors"
          >
            Delete this listing
          </button>
        </div>
      </div>
    </>
  );
}
