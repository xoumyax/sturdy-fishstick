import { useState } from "react";
import { api } from "../api";
import { ScoreBadge } from "./ScoreBadge";

const STATUS_OPTIONS = ["new", "saved", "applied", "screen", "interview", "offer", "rejected"];

function timeAgo(iso) {
  if (!iso) return "";
  const diff = (Date.now() - new Date(iso)) / 1000;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export function JobCard({ job, onUpdate }) {
  const [expanded, setExpanded] = useState(false);
  const [notes, setNotes] = useState(job.notes || "");
  const [saving, setSaving] = useState(false);

  const dim = job.match_score != null && job.match_score < 5;

  async function changeStatus(status) {
    const updated = await api.updateJob(job.id, { status });
    onUpdate(updated);
  }

  async function saveNotes() {
    setSaving(true);
    const updated = await api.updateJob(job.id, { notes });
    onUpdate(updated);
    setSaving(false);
  }

  return (
    <div className={`bg-white rounded-xl border shadow-sm mb-3 transition-opacity ${dim ? "opacity-50" : ""}`}>
      {/* Header row */}
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
              onClick={saveNotes}
              disabled={saving}
              className="text-xs px-3 py-1 rounded-lg bg-indigo-600 text-white disabled:opacity-50"
            >
              {saving ? "…" : "Save"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
