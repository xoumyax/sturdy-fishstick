export function FilterBar({ filters, onChange }) {
  const update = (key, value) => onChange({ ...filters, [key]: value });

  return (
    <div className="flex flex-wrap gap-2 sm:gap-3 items-center bg-white border border-slate-200 rounded-2xl px-3 sm:px-4 py-3 mb-4 shadow-sm">
      <select
        value={filters.status || ""}
        onChange={(e) => update("status", e.target.value || null)}
        className="text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-brand-teal/40 bg-slate-50 text-slate-600"
      >
        <option value="">All statuses</option>
        {["new", "saved", "applied", "screen", "interview", "offer", "rejected"].map((s) => (
          <option key={s} value={s}>{s}</option>
        ))}
      </select>

      <select
        value={filters.source || ""}
        onChange={(e) => update("source", e.target.value || null)}
        className="text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-brand-teal/40 bg-slate-50 text-slate-600"
      >
        <option value="">All sources</option>
        <option value="google_jobs">Google Jobs</option>
        <option value="linkedin">LinkedIn</option>
        <option value="linkedin_direct">LinkedIn Direct</option>
      </select>

      <div className="flex items-center gap-2 text-xs text-slate-600">
        <span className="text-slate-400 font-medium">Score ≥</span>
        <input
          type="range"
          min={0}
          max={10}
          step={1}
          value={filters.score_min ?? 6}
          onChange={(e) => update("score_min", Number(e.target.value) || null)}
          className="w-24 accent-brand-teal"
        />
        <span
          className="w-7 h-7 rounded-full text-center text-xs font-bold flex items-center justify-center"
          style={{
            background: (filters.score_min ?? 6) >= 7 ? "#23CED9" : (filters.score_min ?? 6) >= 5 ? "#F9D779" : "#e2e8f0",
            color: (filters.score_min ?? 6) >= 7 ? "#fff" : "#1e293b",
          }}
        >
          {filters.score_min ?? 6}
        </span>
      </div>

      <label className="flex items-center gap-1.5 text-xs text-slate-500 cursor-pointer select-none ml-auto">
        <input
          type="checkbox"
          checked={!!filters.show_aggregates}
          onChange={(e) => update("show_aggregates", e.target.checked ? true : null)}
          className="accent-brand-teal rounded"
        />
        Show collections in list
      </label>
    </div>
  );
}
