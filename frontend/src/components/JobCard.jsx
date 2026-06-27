import { useState } from "react";
import { api } from "../api";
import { ScoreBadge } from "./ScoreBadge";

const STATUS_OPTIONS = ["new", "saved", "applied", "screen", "interview", "offer", "rejected"];

function timeAgo(iso) {
  if (!iso) return "";
  const diff = (Date.now() - new Date(iso + "Z").getTime()) / 1000;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function daysUntil(dateStr) {
  if (!dateStr) return null;
  const diff = (new Date(dateStr).getTime() - Date.now()) / 86400000;
  return Math.ceil(diff);
}

function DeadlineBadge({ deadline }) {
  if (!deadline) return null;
  const days = daysUntil(deadline);
  if (days < 0) return <span className="text-xs text-slate-400">Expired</span>;
  if (days <= 2) return <span className="text-xs font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded-full">⚠ {days}d left</span>;
  if (days <= 7) return <span className="text-xs font-medium text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">{days}d left</span>;
  return <span className="text-xs text-slate-500">{days}d left</span>;
}

function CoverLetterModal({ text, onClose }) {
  function handleCopy() {
    navigator.clipboard.writeText(text);
  }
  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <h2 className="font-semibold text-slate-800">Cover Letter</h2>
          <div className="flex gap-2">
            <button onClick={handleCopy} className="text-xs px-3 py-1.5 bg-indigo-50 text-indigo-700 rounded-lg hover:bg-indigo-100">
              Copy
            </button>
            <button onClick={onClose} className="text-xs px-3 py-1.5 bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200">
              Close
            </button>
          </div>
        </div>
        <div className="overflow-y-auto px-5 py-4">
          <pre className="whitespace-pre-wrap font-sans text-sm text-slate-700 leading-relaxed">{text}</pre>
        </div>
      </div>
    </div>
  );
}

export function JobCard({ job, onUpdate }) {
  const [expanded, setExpanded] = useState(false);
  const [notes, setNotes] = useState(job.notes || "");
  const [deadline, setDeadline] = useState(job.deadline || "");
  const [saving, setSaving] = useState(false);
  const [coverLetter, setCoverLetter] = useState(null);
  const [generatingCL, setGeneratingCL] = useState(false);

  const dim = job.match_score != null && job.match_score < 5;
  const deadlineSoon = job.deadline && daysUntil(job.deadline) <= 7 && daysUntil(job.deadline) >= 0;

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

  async function handleGenerateCL() {
    setGeneratingCL(true);
    try {
      const res = await api.generateCoverLetter(job.id);
      setCoverLetter(res.cover_letter);
    } catch (e) {
      alert("Cover letter generation failed: " + e.message);
    } finally {
      setGeneratingCL(false);
    }
  }

  return (
    <>
      <div className={`bg-white rounded-xl border shadow-sm mb-3 transition-opacity ${dim ? "opacity-50" : ""} ${deadlineSoon ? "border-amber-300" : ""}`}>
        {/* Header */}
        <div
          className="flex items-center gap-3 px-4 py-3 cursor-pointer select-none"
          onClick={() => setExpanded((v) => !v)}
        >
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-slate-800 truncate">{job.title}</p>
            <p className="text-sm text-slate-500 truncate">
              {job.company && <span>{job.company}</span>}
              {job.location && <span className="ml-2 text-slate-400">· {job.location}</span>}
            </p>
          </div>
          <DeadlineBadge deadline={job.deadline} />
          <ScoreBadge score={job.match_score} />
          <span className="text-xs text-slate-400 whitespace-nowrap">{timeAgo(job.date_found)}</span>
          <span className="text-slate-300 text-sm">{expanded ? "▲" : "▼"}</span>
        </div>

        {/* Expanded body */}
        {expanded && (
          <div className="border-t px-4 py-3 space-y-3">
            {job.match_reason && (
              <p className="text-sm text-indigo-700 bg-indigo-50 rounded-lg px-3 py-2">
                <span className="font-medium">Match: </span>{job.match_reason}
              </p>
            )}

            {job.description && (
              <p className="text-sm text-slate-600 whitespace-pre-line line-clamp-6">{job.description}</p>
            )}

            {/* Status picker */}
            <div className="flex flex-wrap gap-2 items-center">
              {STATUS_OPTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => changeStatus(s)}
                  className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                    job.status === s
                      ? "bg-indigo-600 text-white border-indigo-600"
                      : "bg-white text-slate-600 border-slate-300 hover:border-indigo-400"
                  }`}
                >
                  {s}
                </button>
              ))}
              <a
                href={job.url}
                target="_blank"
                rel="noreferrer"
                className="ml-auto text-xs text-indigo-600 hover:underline"
                onClick={(e) => e.stopPropagation()}
              >
                Open listing →
              </a>
            </div>

            {/* Deadline + cover letter row */}
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-2 text-sm">
                <label className="text-slate-500 text-xs">Deadline</label>
                <input
                  type="date"
                  value={deadline}
                  onChange={(e) => setDeadline(e.target.value)}
                  className="text-xs border rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-indigo-300"
                />
              </div>
              <button
                onClick={handleGenerateCL}
                disabled={generatingCL}
                className="text-xs px-3 py-1.5 rounded-lg border border-indigo-300 text-indigo-700 bg-indigo-50 hover:bg-indigo-100 disabled:opacity-50 transition-colors"
              >
                {generatingCL ? "Generating…" : "✦ Cover Letter"}
              </button>
            </div>

            {/* Notes */}
            <div className="flex gap-2">
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Add notes…"
                className="flex-1 text-sm border rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-300"
                rows={2}
              />
              <button
                onClick={saveChanges}
                disabled={saving}
                className="text-xs px-3 py-1 rounded-lg bg-indigo-600 text-white disabled:opacity-50"
              >
                {saving ? "…" : "Save"}
              </button>
            </div>
          </div>
        )}
      </div>

      {coverLetter && <CoverLetterModal text={coverLetter} onClose={() => setCoverLetter(null)} />}
    </>
  );
}
