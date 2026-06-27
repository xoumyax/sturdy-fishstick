import { useEffect, useState } from "react";
import { api } from "../api";

function RunHistory() {
  const [runs, setRuns] = useState([]);

  useEffect(() => {
    api.getRuns().then(setRuns).catch(() => {});
    const id = setInterval(() => api.getRuns().then(setRuns).catch(() => {}), 10000);
    return () => clearInterval(id);
  }, []);

  function fmt(iso) {
    if (!iso) return "—";
    return new Date(iso + "Z").toLocaleString();
  }

  function duration(run) {
    if (!run.completed_at || !run.started_at) return "—";
    const ms = new Date(run.completed_at + "Z") - new Date(run.started_at + "Z");
    const s = Math.round(ms / 1000);
    return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${s % 60}s`;
  }

  const statusColor = {
    completed: "bg-emerald-100 text-emerald-700",
    running: "bg-blue-100 text-blue-700",
    failed: "bg-red-100 text-red-700",
  };

  return (
    <div className="bg-white rounded-xl border shadow-sm p-5">
      <h2 className="font-semibold text-slate-800 mb-4">Search Run History</h2>
      {runs.length === 0 ? (
        <p className="text-sm text-slate-400">No runs yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-slate-500 border-b">
                <th className="pb-2 pr-4">Started</th>
                <th className="pb-2 pr-4">Status</th>
                <th className="pb-2 pr-4">Found</th>
                <th className="pb-2 pr-4">New</th>
                <th className="pb-2 pr-4">Duration</th>
                <th className="pb-2">Error</th>
              </tr>
            </thead>
            <tbody>
              {runs.map((run) => (
                <tr key={run.id} className="border-b last:border-0">
                  <td className="py-2 pr-4 text-slate-600 whitespace-nowrap">{fmt(run.started_at)}</td>
                  <td className="py-2 pr-4">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColor[run.status] || ""}`}>
                      {run.status}
                    </span>
                  </td>
                  <td className="py-2 pr-4 text-slate-600">{run.jobs_found}</td>
                  <td className="py-2 pr-4 text-slate-600">{run.jobs_new}</td>
                  <td className="py-2 pr-4 text-slate-500">{duration(run)}</td>
                  <td className="py-2 text-red-500 text-xs max-w-[200px] truncate">{run.error_msg || ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function ConfigEditor() {
  const [loading, setLoading] = useState(true);
  const [yaml, setYaml] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null); // { type: "success"|"error", text }

  useEffect(() => {
    api.getConfig()
      .then((cfg) => {
        setYaml(configToYaml(cfg));
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  async function handleSave() {
    setSaving(true);
    setMsg(null);
    try {
      await api.updateConfig(yaml);
      setMsg({ type: "success", text: "Config saved and reloaded." });
    } catch (e) {
      setMsg({ type: "error", text: e.message || "Failed to save config." });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="bg-white rounded-xl border shadow-sm p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold text-slate-800">Configuration</h2>
        <span className="text-xs text-slate-400">Edit config.yaml — changes take effect immediately</span>
      </div>

      {loading ? (
        <p className="text-sm text-slate-400">Loading…</p>
      ) : (
        <>
          <textarea
            value={yaml}
            onChange={(e) => setYaml(e.target.value)}
            className="w-full font-mono text-xs border rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-slate-50 resize-y"
            rows={28}
            spellCheck={false}
          />
          <div className="flex items-center gap-3 mt-3">
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg disabled:opacity-60 hover:bg-indigo-700 transition-colors"
            >
              {saving ? "Saving…" : "Save & Reload"}
            </button>
            {msg && (
              <p className={`text-sm ${msg.type === "success" ? "text-emerald-600" : "text-red-500"}`}>
                {msg.text}
              </p>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// Convert the API config object back to YAML string for editing
function configToYaml(cfg) {
  const lines = [
    "profile:",
    `  name: "${cfg.profile.name}"`,
    "  positions:",
    ...cfg.profile.positions.map((p) => `    - "${p}"`),
    "  expertise:",
    ...cfg.profile.expertise.map((e) => `    - "${e}"`),
    "  resume_summary: |",
    ...cfg.profile.resume_summary.split("\n").map((l) => `    ${l}`),
    `  location_preference: "${cfg.profile.location_preference}"`,
    `  remote_ok: ${cfg.profile.remote_ok}`,
    `  relocation_ok: ${cfg.profile.relocation_ok}`,
    "",
    "search:",
    "  sources:",
    ...cfg.search.sources.map((s) => `    - ${s}`),
    `  time_filter: "${cfg.search.time_filter}"`,
    `  max_results_per_query: ${cfg.search.max_results_per_query}`,
    "  extra_keywords:",
    ...cfg.search.extra_keywords.map((k) => `    - "${k}"`),
    "  company_blacklist:",
    ...cfg.search.company_blacklist.map((c) => `    - "${c}"`),
    "  company_whitelist:",
    ...cfg.search.company_whitelist.map((c) => `    - "${c}"`),
    "",
    "scheduler:",
    "  times:",
    ...cfg.scheduler.times.map((t) => `    - "${t}"`),
    `  timezone: "${cfg.scheduler.timezone}"`,
    "",
    "llm:",
    `  model: "${cfg.llm.model}"`,
    `  priority_threshold: ${cfg.llm.priority_threshold}`,
    `  batch_size: ${cfg.llm.batch_size}`,
    "",
    "app:",
    `  port: ${cfg.app.port}`,
    `  host: "${cfg.app.host}"`,
  ];
  return lines.join("\n") + "\n";
}

export function Settings() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
      <h1 className="text-xl font-bold text-slate-800">Settings</h1>
      <ConfigEditor />
      <RunHistory />
    </div>
  );
}
