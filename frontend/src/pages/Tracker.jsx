import { useEffect, useState } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { useDroppable } from "@dnd-kit/core";
import { useDraggable } from "@dnd-kit/core";
import { api } from "../api";
import { JobDetailDrawer } from "../components/JobDetailDrawer";
import { ScoreBadge } from "../components/ScoreBadge";

const EMPTY_FORM = { title: "", company: "", url: "", location: "", status: "applied", deadline: "", notes: "" };

function AddApplicationModal({ mode, onClose, onCreated }) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const isPhd = mode === "phd";
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function submit(e) {
    e.preventDefault();
    if (!form.title.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const job = await api.createJob({
        title: form.title, company: form.company || null, url: form.url || null,
        location: form.location || null, status: form.status,
        deadline: form.deadline || null, notes: form.notes || null,
        track: mode,
      });
      onCreated(job);
      onClose();
    } catch (err) {
      setError(err.message.includes("409")
        ? "A job with this URL already exists in the app."
        : "Failed to save: " + err.message);
    } finally { setSaving(false); }
  }

  const field = "w-full text-sm border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-teal/40 bg-slate-50";

  return (
    <div className="fixed inset-0 bg-black/50 z-[70] flex items-center justify-center p-6 backdrop-blur-sm" onClick={onClose}>
      <form
        onSubmit={submit}
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col overflow-hidden"
      >
        <div className="px-6 py-4" style={{ background: isPhd ? "linear-gradient(135deg,#818cf8,#6366f1)" : "linear-gradient(135deg,#097C87,#1A8C72)" }}>
          <p className="text-white font-bold text-sm">
            Add {isPhd ? "PhD application" : "application"} manually
          </p>
          <p className="text-white/70 text-[11px] mt-0.5">
            For roles you applied to outside the app — lands on this board
          </p>
        </div>
        <div className="p-6 space-y-3">
          <input className={field} placeholder={isPhd ? "Position / program title *" : "Job title *"} value={form.title} onChange={set("title")} required autoFocus />
          <div className="grid grid-cols-2 gap-3">
            <input className={field} placeholder={isPhd ? "University / lab" : "Company"} value={form.company} onChange={set("company")} />
            <input className={field} placeholder="Location" value={form.location} onChange={set("location")} />
          </div>
          <input className={field} placeholder="Listing / application URL (optional)" value={form.url} onChange={set("url")} />
          <div className="grid grid-cols-2 gap-3">
            <select className={field} value={form.status} onChange={set("status")}>
              {["applied", "screen", "interview", "offer", "rejected", "saved"].map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
            <input className={field} type="date" value={form.deadline} onChange={set("deadline")} title="Deadline" />
          </div>
          <textarea className={field} rows={3} placeholder="Notes — referral, contact, portal login, anything…" value={form.notes} onChange={set("notes")} />
          {error && <p className="text-xs text-red-500">{error}</p>}
        </div>
        <div className="px-6 pb-5 flex items-center justify-end gap-2">
          <button type="button" onClick={onClose} className="text-sm px-4 py-2 rounded-xl text-slate-500 hover:bg-slate-100 transition-colors">
            Cancel
          </button>
          <button type="submit" disabled={saving || !form.title.trim()}
            className="text-sm px-5 py-2 rounded-xl text-white font-semibold disabled:opacity-50 transition-all"
            style={{ background: isPhd ? "linear-gradient(135deg,#818cf8,#6366f1)" : "linear-gradient(135deg,#097C87,#1A8C72)" }}>
            {saving ? "Saving…" : "Add"}
          </button>
        </div>
      </form>
    </div>
  );
}

const COLUMNS = [
  { id: "applied",   label: "Applied",      headerColor: "#23CED9", bg: "bg-brand-teal/8",   border: "border-brand-teal/25" },
  { id: "screen",    label: "Screening",    headerColor: "#F9D779", bg: "bg-brand-yellow/15", border: "border-brand-yellow/40" },
  { id: "interview", label: "Interview",    headerColor: "#FCA47C", bg: "bg-brand-orange/8",  border: "border-brand-orange/25" },
  { id: "offer",     label: "Offer",        headerColor: "#A1CCA6", bg: "bg-brand-sage/15",   border: "border-brand-sage/35" },
  { id: "rejected",  label: "Rejected",     headerColor: "#94a3b8", bg: "bg-slate-100/80",    border: "border-slate-200" },
];

function DraggableCard({ job, onOpen }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: job.id });
  const style = transform
    ? { transform: `translate(${transform.x}px, ${transform.y}px)`, opacity: isDragging ? 0.4 : 1 }
    : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      onClick={() => onOpen?.(job)}
      title="Click for full details"
      className="bg-white rounded-xl border border-slate-200 shadow-sm p-3 cursor-grab active:cursor-grabbing select-none hover:border-brand-teal/40 transition-colors"
    >
      <p className="font-medium text-sm text-slate-800 leading-snug">{job.title}</p>
      {job.company && <p className="text-xs text-slate-500 mt-0.5">{job.company}</p>}
      <div className="flex items-center justify-between mt-2">
        <ScoreBadge score={job.match_score} />
        <a
          href={job.url}
          target="_blank"
          rel="noreferrer"
          className="text-xs text-brand-dark hover:underline"
          onClick={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
        >
          ↗
        </a>
      </div>
    </div>
  );
}

function Column({ col, jobs, onOpen }) {
  const { setNodeRef, isOver } = useDroppable({ id: col.id });

  return (
    <div className="flex flex-col min-w-[180px] w-full">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full" style={{ background: col.headerColor }} />
          <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">{col.label}</h3>
        </div>
        <span className="text-[10px] font-bold bg-white border border-slate-200 text-slate-500 px-2 py-0.5 rounded-full shadow-sm">{jobs.length}</span>
      </div>
      <div
        ref={setNodeRef}
        className={`flex-1 min-h-[120px] rounded-2xl border-2 p-2 space-y-2 transition-colors ${col.bg} ${col.border} ${
          isOver ? "border-brand-teal bg-brand-teal/20" : ""
        }`}
      >
        {jobs.map((job) => <DraggableCard key={job.id} job={job} onOpen={onOpen} />)}
        {jobs.length === 0 && (
          <p className="text-xs text-slate-400 text-center pt-6">Drop here</p>
        )}
      </div>
    </div>
  );
}

export function Tracker({ mode = "careers", onChat }) {
  const [jobs, setJobs] = useState([]);
  const [activeJob, setActiveJob] = useState(null);
  const [selectedJob, setSelectedJob] = useState(null); // detail drawer
  const [showAdd, setShowAdd] = useState(false);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  useEffect(() => {
    Promise.all(
      ["applied", "screen", "interview", "offer", "rejected"].map((s) => api.getJobs({ status: s, mode }))
    ).then((results) => setJobs(results.flat()));
  }, [mode]);

  function handleDrawerUpdate(updated) {
    setJobs((prev) => prev.map((j) => (j.id === updated.id ? updated : j)));
    setSelectedJob((prev) => (prev && prev.id === updated.id ? updated : prev));
  }

  async function handleDrawerDelete(id) {
    try { await api.deleteJob(id); } catch {}
    setJobs((prev) => prev.filter((j) => j.id !== id));
    setSelectedJob(null);
  }

  async function handleDragEnd({ active, over }) {
    setActiveJob(null);
    if (!over || active.id === over.id) return;
    const job = jobs.find((j) => j.id === active.id);
    if (!job || job.status === over.id) return;
    setJobs((prev) => prev.map((j) => (j.id === active.id ? { ...j, status: over.id } : j)));
    try {
      await api.updateJob(active.id, { status: over.id });
    } catch {
      setJobs((prev) => prev.map((j) => (j.id === active.id ? { ...j, status: job.status } : j)));
    }
  }

  return (
    <div className="px-4 sm:px-6 lg:px-10 py-6 max-w-6xl mx-auto w-full">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100 tracking-tight">Tracker</h1>
          <p className="text-sm text-slate-400 mt-0.5">
            {jobs.length} active {mode === "phd" ? "PhD applications" : "applications"} · click a card for full details
          </p>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="inline-flex items-center gap-1.5 text-sm px-4 py-2 font-semibold rounded-xl text-white shadow-sm transition-all hover:scale-[1.02]"
          style={{ background: mode === "phd" ? "linear-gradient(135deg,#818cf8,#6366f1)" : "linear-gradient(135deg,#097C87,#1A8C72)" }}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Add application
        </button>
      </div>

      {jobs.length === 0 ? (
        <div className="text-center text-slate-400 mt-16">
          <p className="text-5xl mb-3">📋</p>
          <p>Mark jobs as "applied" from the Dashboard to track them here.</p>
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={({ active }) => setActiveJob(jobs.find((j) => j.id === active.id) || null)}
          onDragEnd={handleDragEnd}
        >
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            {COLUMNS.map((col) => (
              <Column key={col.id} col={col} jobs={jobs.filter((j) => j.status === col.id)}
                onOpen={(j) => setSelectedJob(j)} />
            ))}
          </div>
          <DragOverlay>
            {activeJob && (
              <div className="bg-white rounded-xl border-2 border-brand-teal shadow-xl p-3 rotate-1">
                <p className="font-medium text-sm text-slate-800">{activeJob.title}</p>
                {activeJob.company && <p className="text-xs text-slate-500 mt-0.5">{activeJob.company}</p>}
              </div>
            )}
          </DragOverlay>
        </DndContext>
      )}

      {/* Manual application form */}
      {showAdd && (
        <AddApplicationModal
          mode={mode}
          onClose={() => setShowAdd(false)}
          onCreated={(job) => setJobs((prev) => [job, ...prev])}
        />
      )}

      {/* Full-detail drawer */}
      {selectedJob && (
        <JobDetailDrawer
          job={selectedJob}
          onClose={() => setSelectedJob(null)}
          onUpdate={handleDrawerUpdate}
          onChat={onChat}
          onDelete={handleDrawerDelete}
          mode={mode}
        />
      )}
    </div>
  );
}
