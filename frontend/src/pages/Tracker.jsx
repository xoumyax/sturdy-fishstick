import { useEffect, useState } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
} from "@dnd-kit/core";
import { useDroppable } from "@dnd-kit/core";
import { useDraggable } from "@dnd-kit/core";
import { api } from "../api";
import { ScoreBadge } from "../components/ScoreBadge";

const COLUMNS = [
  { id: "applied", label: "Applied", color: "bg-blue-50 border-blue-200" },
  { id: "screen", label: "Phone Screen", color: "bg-yellow-50 border-yellow-200" },
  { id: "interview", label: "Interview", color: "bg-purple-50 border-purple-200" },
  { id: "offer", label: "Offer", color: "bg-emerald-50 border-emerald-200" },
  { id: "rejected", label: "Rejected", color: "bg-red-50 border-red-200" },
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
      className="bg-white rounded-lg border shadow-sm p-3 cursor-grab active:cursor-grabbing select-none"
    >
      <p className="font-medium text-sm text-slate-800 leading-snug">{job.title}</p>
      {job.company && <p className="text-xs text-slate-500 mt-0.5">{job.company}</p>}
      <div className="flex items-center justify-between mt-2">
        <ScoreBadge score={job.match_score} />
        <a
          href={job.url}
          target="_blank"
          rel="noreferrer"
          className="text-xs text-indigo-500 hover:underline"
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
    <div className="flex flex-col min-w-[200px] w-full">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold text-slate-700">{col.label}</h3>
        <span className="text-xs bg-slate-200 text-slate-600 px-2 py-0.5 rounded-full">{jobs.length}</span>
      </div>
      <div
        ref={setNodeRef}
        className={`flex-1 min-h-[120px] rounded-xl border-2 p-2 space-y-2 transition-colors ${col.color} ${
          isOver ? "border-indigo-400 bg-indigo-50" : ""
        }`}
      >
        {jobs.map((job) => (
          <DraggableCard key={job.id} job={job} />
        ))}
        {jobs.length === 0 && (
          <p className="text-xs text-slate-400 text-center pt-4">Drop here</p>
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

  const columnJobs = (colId) => jobs.filter((j) => j.status === colId);

  async function handleDragEnd({ active, over }) {
    setActiveJob(null);
    if (!over || active.id === over.id) return;
    const job = jobs.find((j) => j.id === active.id);
    if (!job || job.status === over.id) return;

    // Optimistic update
    setJobs((prev) => prev.map((j) => (j.id === active.id ? { ...j, status: over.id } : j)));
    try {
      await api.updateJob(active.id, { status: over.id });
    } catch {
      // Revert on failure
      setJobs((prev) => prev.map((j) => (j.id === active.id ? { ...j, status: job.status } : j)));
    }
  }

  function handleDragStart({ active }) {
    setActiveJob(jobs.find((j) => j.id === active.id) || null);
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-slate-800">Application Tracker</h1>
        <p className="text-sm text-slate-500">{jobs.length} active applications</p>
      </div>

      {jobs.length === 0 ? (
        <div className="text-center text-slate-400 mt-16">
          <p className="text-4xl mb-3">📋</p>
          <p>No applications yet. Mark jobs as "applied" from the Dashboard to track them here.</p>
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            {COLUMNS.map((col) => (
              <Column key={col.id} col={col} jobs={columnJobs(col.id)} />
            ))}
          </div>

          <DragOverlay>
            {activeJob && (
              <div className="bg-white rounded-lg border-2 border-indigo-400 shadow-xl p-3 opacity-95 rotate-1">
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
