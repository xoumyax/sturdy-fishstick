import { useState } from "react";
import { api } from "../api";
import { ScoreBadge } from "./ScoreBadge";

const STATUS_OPTIONS = ["new", "saved", "applied", "screen", "interview", "offer", "rejected"];

const AVATAR_COLORS = ["#FCA47C","#23CED9","#A1CCA6","#097C87","#6366f1","#ec4899","#f59e0b","#10b981"];

function avatarColor(name) {
  if (!name) return "#94a3b8";
  const h = [...name].reduce((acc, c) => (acc << 5) - acc + c.charCodeAt(0), 0);
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
}

function CompanyAvatar({ company, title }) {
  // Use company initial, fall back to title initial, then a briefcase
  const src = company || title || "";
  const letter = src.trim()[0]?.toUpperCase() || null;
  const bg = avatarColor(src || "default");
  const isDark = ["#097C87","#6366f1","#ec4899","#10b981"].includes(bg);
  return (
    <div
      className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold flex-shrink-0 shadow-sm"
      style={{ background: bg, color: isDark ? "#fff" : "#1e293b" }}
    >
      {letter ?? (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
          <rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v2"/>
        </svg>
      )}
    </div>
  );
}

function timeAgo(iso) {
  if (!iso) return "";
  const diff = (Date.now() - new Date(iso + "Z").getTime()) / 1000;
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  return `${Math.floor(diff / 86400)}d`;
}

function daysUntil(dateStr) {
  if (!dateStr) return null;
  return Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86400000);
}

function DeadlineBadge({ deadline }) {
  if (!deadline) return null;
  const d = daysUntil(deadline);
  if (d < 0)  return <span className="text-[10px] text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">Expired</span>;
  if (d <= 2) return <span className="text-[10px] font-bold text-red-600 bg-red-50 border border-red-200 px-2 py-0.5 rounded-full">⚠ {d}d left</span>;
  if (d <= 7) return <span className="text-[10px] font-medium text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">{d}d left</span>;
  return <span className="text-[10px] text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">{d}d</span>;
}

function Chip({ children, color }) {
  return (
    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${color || "bg-slate-100 text-slate-500"}`}>
      {children}
    </span>
  );
}

function AiModal({ title, text, onClose }) {
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-6 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
        style={{ boxShadow: "0 25px 50px -12px rgba(0,0,0,0.4)" }}
      >
        <div className="flex items-center justify-between px-6 py-4 rounded-t-2xl" style={{ background: "linear-gradient(135deg, #097C87, #065d66)" }}>
          <h2 className="font-semibold text-white text-sm">{title}</h2>
          <div className="flex gap-2">
            <button onClick={() => navigator.clipboard.writeText(text)} className="text-xs px-3 py-1.5 bg-white/20 text-white rounded-lg hover:bg-white/30 transition-colors">
              Copy
            </button>
            <button onClick={onClose} className="text-xs px-3 py-1.5 bg-white/10 text-white rounded-lg hover:bg-white/20 transition-colors">
              ✕
            </button>
          </div>
        </div>
        <div className="overflow-y-auto px-6 py-5">
          <pre className="whitespace-pre-wrap font-sans text-sm text-slate-700 leading-relaxed">{text}</pre>
        </div>
      </div>
    </div>
  );
}

export function JobCard({ job, onUpdate, onChat, onDelete }) {
  const [expanded, setExpanded] = useState(false);
  const [notes, setNotes] = useState(job.notes || "");
  const [deadline, setDeadline] = useState(job.deadline || "");
  const [saving, setSaving] = useState(false);
  const [modal, setModal] = useState(null);
  const [genCL, setGenCL] = useState(false);
  const [genRA, setGenRA] = useState(false);
  const [notifySent, setNotifySent] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  async function handleDelete(e) {
    e.stopPropagation();
    if (!confirmDelete) { setConfirmDelete(true); setTimeout(() => setConfirmDelete(false), 3000); return; }
    await api.deleteJob(job.id);
    onDelete?.(job.id);
  }

  const score = job.match_score;
  const dim = score != null && score < 5;
  const deadlineSoon = job.deadline && daysUntil(job.deadline) !== null && daysUntil(job.deadline) <= 7 && daysUntil(job.deadline) >= 0;

  // Left accent color based on score
  let accentColor = "#e2e8f0";
  if (score != null) {
    if (score >= 9) accentColor = "#A1CCA6";
    else if (score >= 7) accentColor = "#23CED9";
    else if (score >= 5) accentColor = "#F9D779";
  }
  if (job.is_priority && score == null) accentColor = "#FCA47C";

  async function changeStatus(status) {
    const updated = await api.updateJob(job.id, { status });
    onUpdate(updated);
  }

  async function saveChanges() {
    setSaving(true);
    const body = { notes };
    if (deadline !== (job.deadline || "")) body.deadline = deadline || null;
    const updated = await api.updateJob(job.id, body);
    onUpdate(updated);
    setSaving(false);
  }

  async function handleCoverLetter() {
    setGenCL(true);
    try {
      const res = await api.generateCoverLetter(job.id);
      setModal({ title: "Cover Letter", text: res.cover_letter });
    } catch (e) { alert("Cover letter failed: " + e.message); }
    finally { setGenCL(false); }
  }

  async function handleResumeAdvice() {
    setGenRA(true);
    try {
      const res = await api.generateResumeAdvice(job.id);
      setModal({ title: "Resume Tips for this Role", text: res.advice });
    } catch (e) {
      alert(e.message.includes("404")
        ? "No resume found — add .txt or .md files to backend/Resume/"
        : "Resume advice failed: " + e.message
      );
    }
    finally { setGenRA(false); }
  }

  async function handleNotify() {
    try {
      await api.notifyJob(job.id);
      setNotifySent(true);
      setTimeout(() => setNotifySent(false), 3000);
    } catch (e) { alert("Notify failed: " + e.message); }
  }

  const sourceLabel = { google_jobs: "Google", linkedin: "LinkedIn", linkedin_direct: "LinkedIn ✓", indeed: "Indeed", github_jobs: "⚡ SpeedyApply", career_page: "🏢 Career", phd: "🎓 PhD" };

  return (
    <>
      <div
        className={`group/card bg-white rounded-2xl border border-slate-200 mb-3 overflow-hidden transition-all hover:shadow-md hover:border-slate-300 ${dim ? "opacity-45" : ""} ${deadlineSoon ? "border-amber-300" : ""}`}
        style={{ boxShadow: expanded ? "0 4px 20px -4px rgba(0,0,0,0.10)" : undefined }}
      >
        {/* Left accent strip + card header */}
        <div className="flex">
          {/* Accent strip */}
          <div className="w-1 flex-shrink-0 rounded-l-2xl" style={{ background: accentColor }} />

          <div className="flex-1 min-w-0">
            {/* Header row */}
            <div
              className="flex items-center gap-3 px-4 py-3.5 cursor-pointer select-none"
              onClick={() => setExpanded((v) => !v)}
            >
              <CompanyAvatar company={job.company} title={job.title} />

              <div className="flex-1 min-w-0">
                <p className="font-semibold text-slate-800 text-sm truncate leading-snug">{job.title}</p>
                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                  {job.company && <span className="text-xs text-slate-500">{job.company}</span>}
                  {job.location && <span className="text-xs text-slate-400 truncate">· {job.location}</span>}
                </div>
              </div>

              {/* Right side badges */}
              <div className="flex items-center gap-2 flex-shrink-0">
                <DeadlineBadge deadline={job.deadline} />
                {job.country && <Chip color="bg-brand-teal/10 text-brand-dark">{job.country}</Chip>}
                {job.source && <Chip>{sourceLabel[job.source] || job.source}</Chip>}
                <span className="text-[10px] text-slate-400 w-6 text-right">{timeAgo(job.date_found)}</span>
                <ScoreBadge score={job.match_score} />
                <svg className={`text-slate-300 transition-transform flex-shrink-0 ${expanded ? "rotate-180" : ""}`} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="6 9 12 15 18 9"/></svg>
                <button
                  onClick={handleDelete}
                  title={confirmDelete ? "Click again to confirm" : "Delete this listing"}
                  className="flex-shrink-0 w-6 h-6 flex items-center justify-center rounded-lg transition-colors opacity-0 group-hover/card:opacity-100"
                  style={{ color: confirmDelete ? "#ef4444" : "#94a3b8", background: confirmDelete ? "#fee2e2" : "transparent" }}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                    {confirmDelete
                      ? <><path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6l-1 14H6L5 6"/></>
                      : <><path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6l-1 14H6L5 6"/></>
                    }
                  </svg>
                </button>
              </div>
            </div>

            {/* Expanded body */}
            {expanded && (
              <div className="border-t border-slate-100 px-4 py-4 space-y-4">
                {/* Match reason */}
                {job.match_reason && (
                  <div className="flex items-start gap-2.5 bg-brand-teal/5 border border-brand-teal/15 rounded-xl px-3.5 py-2.5">
                    <svg className="flex-shrink-0 mt-0.5" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#097C87" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                    <p className="text-xs text-brand-dark leading-relaxed"><span className="font-semibold">Match: </span>{job.match_reason}</p>
                  </div>
                )}

                {/* Description */}
                {job.description && (
                  <p className="text-xs text-slate-600 whitespace-pre-line line-clamp-5 leading-relaxed">{job.description}</p>
                )}

                {/* Status pills */}
                <div className="flex flex-wrap gap-1.5 items-center">
                  {STATUS_OPTIONS.map((s) => (
                    <button
                      key={s}
                      onClick={() => changeStatus(s)}
                      className={`text-xs px-3 py-1 rounded-full border transition-all ${
                        job.status === s
                          ? "bg-brand-dark text-white border-brand-dark shadow-sm"
                          : "bg-white text-slate-500 border-slate-200 hover:border-brand-teal/50 hover:text-slate-700"
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                  <a
                    href={job.url}
                    target="_blank"
                    rel="noreferrer"
                    className="ml-auto text-xs font-medium text-brand-dark hover:underline flex items-center gap-1"
                    onClick={(e) => e.stopPropagation()}
                  >
                    Open listing
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                  </a>
                </div>

                {/* AI tools + deadline */}
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="flex items-center gap-1.5 text-xs">
                    <span className="text-slate-400">Deadline</span>
                    <input
                      type="date"
                      value={deadline}
                      onChange={(e) => setDeadline(e.target.value)}
                      className="border border-slate-200 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-brand-teal/40 bg-slate-50"
                    />
                  </div>
                  <div className="flex items-center gap-2 ml-auto">
                    <button
                      onClick={handleCoverLetter}
                      disabled={genCL}
                      className="text-xs px-3 py-1.5 rounded-lg border border-brand-orange/40 text-brand-orange bg-orange-50 hover:bg-orange-100 disabled:opacity-50 transition-colors font-medium"
                    >
                      {genCL ? "Writing…" : "✦ Cover Letter"}
                    </button>
                    <button
                      onClick={handleResumeAdvice}
                      disabled={genRA}
                      className="text-xs px-3 py-1.5 rounded-lg border border-brand-teal/30 text-brand-dark bg-brand-teal/8 hover:bg-brand-teal/15 disabled:opacity-50 transition-colors font-medium"
                    >
                      {genRA ? "Analyzing…" : "📄 Resume Tips"}
                    </button>
                    {job.is_priority && (
                      <button
                        onClick={handleNotify}
                        className={`text-xs px-3 py-1.5 rounded-lg border transition-colors font-medium ${
                          notifySent
                            ? "border-brand-sage bg-brand-sage/20 text-emerald-700"
                            : "border-brand-sage/40 text-brand-dark bg-brand-sage/10 hover:bg-brand-sage/20"
                        }`}
                      >
                        {notifySent ? "✓ Sent!" : "✉ Notify"}
                      </button>
                    )}
                    {onChat && (
                      <button
                        onClick={() => onChat(job)}
                        className="text-xs px-3 py-1.5 rounded-lg border font-medium transition-all flex items-center gap-1.5 hover:brightness-105"
                        style={{ borderColor: "rgba(35,206,217,0.4)", color: "#097C87", background: "rgba(35,206,217,0.08)" }}
                        title="Ask Fishstick AI about this job"
                      >
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                          <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
                        </svg>
                        Ask AI
                      </button>
                    )}
                  </div>
                </div>

                {/* Notes */}
                <div className="flex gap-2">
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Add notes…"
                    className="flex-1 text-xs border border-slate-200 rounded-xl px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-brand-teal/30 bg-slate-50 placeholder-slate-400"
                    rows={2}
                  />
                  <button
                    onClick={saveChanges}
                    disabled={saving}
                    className="text-xs px-3 py-1 self-start rounded-lg bg-brand-dark text-white disabled:opacity-50 hover:opacity-90 transition-opacity"
                  >
                    {saving ? "…" : "Save"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {modal && <AiModal title={modal.title} text={modal.text} onClose={() => setModal(null)} />}
    </>
  );
}
