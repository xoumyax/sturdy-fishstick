export function FilterBar({ filters, onChange }) {
  const update = (key, value) => onChange({ ...filters, [key]: value });

  return (
    <div className="flex flex-wrap gap-3 items-center bg-white border rounded-xl px-4 py-3 mb-4 shadow-sm">
      <select
        value={filters.status || ""}
        onChange={(e) => update("status", e.target.value || null)}
        className="text-sm border rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-300"
      >
        <option value="">All statuses</option>
        {["new", "saved", "applied", "screen", "interview", "offer", "rejected"].map((s) => (
          <option key={s} value={s}>{s}</option>
        ))}
      </select>

      <select
        value={filters.source || ""}
        onChange={(e) => update("source", e.target.value || null)}
        className="text-sm border rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-300"
      >
        <option value="">All sources</option>
        <option value="google_jobs">Google Jobs</option>
        <option value="linkedin">LinkedIn</option>
        <option value="indeed">Indeed</option>
      </select>

      <div className="flex items-center gap-2 text-sm text-slate-600">
        <label>Min score</label>
        <input
          type="range"
          min={0}
          max={10}
          step={1}
          value={filters.score_min ?? 0}
          onChange={(e) => update("score_min", Number(e.target.value) || null)}
          className="w-24 accent-indigo-600"
        />
        <span className="w-4 text-center">{filters.score_min || 0}</span>
      </div>
    </div>
  );
}
