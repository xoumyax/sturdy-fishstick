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
import { ScoreBadge } from "../components/ScoreBadge";

const COLUMNS = [
  { id: "applied",   label: "Applied",      headerColor: "#23CED9", bg: "bg-brand-teal/8",   border: "border-brand-teal/25" },
  { id: "screen",    label: "Screening",    headerColor: "#F9D779", bg: "bg-brand-yellow/15", border: "border-brand-yellow/40" },
  { id: "interview", label: "Interview",    headerColor: "#FCA47C", bg: "bg-brand-orange/8",  border: "border-brand-orange/25" },
  { id: "offer",     label: "Offer",        headerColor: "#A1CCA6", bg: "bg-brand-sage/15",   border: "border-brand-sage/35" },
  { id: "rejected",  label: "Rejected",     headerColor: "#94a3b8", bg: "bg-slate-100/80",    border: "border-slate-200" },
];

function DraggableCard({ job }) {
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

function Column({ col, jobs }) {
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
        {jobs.map((job) => <DraggableCard key={job.id} job={job} />)}
        {jobs.length === 0 && (
          <p className="text-xs text-slate-400 text-center pt-6">Drop here</p>
        )}
      </div>
    </div>
  );
}

export function Tracker() {
  const [jobs, setJobs] = useState([]);
  const [activeJob, setActiveJob] = useState(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  useEffect(() => {
    Promise.all(
      ["applied", "screen", "interview", "offer", "rejected"].map((s) => api.getJobs({ status: s }))
    ).then((results) => setJobs(results.flat()));
  }, []);

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
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Tracker</h1>
          <p className="text-sm text-slate-400 mt-0.5">{jobs.length} active applications</p>
        </div>
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
              <Column key={col.id} col={col} jobs={jobs.filter((j) => j.status === col.id)} />
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
    </div>
  );
}
