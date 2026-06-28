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
    const s = Math.round((new Date(run.completed_at + "Z") - new Date(run.started_at + "Z")) / 1000);
    return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${s % 60}s`;
  }

  const statusStyle = {
    completed: "bg-brand-sage/30 text-emerald-800",
    running:   "bg-brand-teal/20 text-brand-dark",
    failed:    "bg-red-100 text-red-700",
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
      <h2 className="font-semibold text-brand-dark mb-4">Search Run History</h2>
      {runs.length === 0 ? (
        <p className="text-sm text-slate-400">No runs yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-slate-400 border-b">
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
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusStyle[run.status] || ""}`}>
                      {run.status}
                    </span>
                  </td>
                  <td className="py-2 pr-4 text-slate-600">{run.jobs_found}</td>
                  <td className="py-2 pr-4 text-slate-600">{run.jobs_new}</td>
                  <td className="py-2 pr-4 text-slate-400">{duration(run)}</td>
                  <td className="py-2 text-red-500 text-xs max-w-xs truncate">{run.error_msg || ""}</td>
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
  const [msg, setMsg] = useState(null);

  useEffect(() => {
    api.getConfig()
      .then((cfg) => { setYaml(configToYaml(cfg)); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  async function handleSave() {
    setSaving(true);
    setMsg(null);
    try {
      await api.updateConfig(yaml);
      setMsg({ type: "success", text: "Config saved and reloaded." });
    } catch (e) {
      setMsg({ type: "error", text: e.message || "Failed to save." });
    } finally { setSaving(false); }
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold text-brand-dark">Configuration</h2>
        <span className="text-xs text-slate-400">Changes take effect immediately</span>
      </div>
      {loading ? (
        <p className="text-sm text-slate-400">Loading…</p>
      ) : (
        <>
          <textarea
            value={yaml}
            onChange={(e) => setYaml(e.target.value)}
            className="w-full font-mono text-xs border rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-brand-teal/40 bg-slate-50 resize-y"
            rows={32}
            spellCheck={false}
          />
          <div className="flex items-center gap-3 mt-3">
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 bg-brand-dark text-white text-sm font-medium rounded-xl disabled:opacity-60 hover:brightness-110 transition-all"
            >
              {saving ? "Saving…" : "Save & Reload"}
            </button>
            {msg && (
              <p className={`text-sm ${msg.type === "success" ? "text-emerald-600" : "text-red-500"}`}>{msg.text}</p>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function LinkedInStatus() {
  const [status, setStatus] = useState(null);

  useEffect(() => {
    api.getLinkedInStatus().then(setStatus).catch(() => {});
  }, []);

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
      <div className="flex items-center gap-2 mb-3">
        <h2 className="font-semibold text-brand-dark">LinkedIn Direct Scraper</h2>
        {status && (
          <span className={`text-xs px-2 py-0.5 rounded-full ${
            status.configured
              ? "bg-brand-sage/30 text-emerald-700"
              : "bg-slate-100 text-slate-500"
          }`}>
            {status.configured ? `✓ Configured (${status.email_hint})` : "Not configured"}
          </span>
        )}
      </div>
      <p className="text-sm text-slate-600 mb-3">
        Set up a dummy LinkedIn account and add its credentials to <code className="bg-slate-100 px-1 rounded text-xs">backend/.env</code> to enable direct job fetching:
      </p>
      <pre className="text-xs bg-slate-50 border rounded-xl p-3 text-slate-600 font-mono leading-relaxed overflow-x-auto">
{`LINKEDIN_EMAIL=your_dummy_account@example.com
LINKEDIN_PASSWORD=your_password`}
      </pre>
      <p className="text-xs text-slate-400 mt-2">
        Also install the library: <code className="bg-slate-100 px-1 rounded">cd backend && .venv/bin/pip install linkedin-api</code>
      </p>
      <p className="text-xs text-slate-400 mt-1">
        Restart the backend after adding credentials. The scraper runs automatically with each scheduled search.
      </p>
    </div>
  );
}

function configToYaml(cfg) {
  const locs = Array.isArray(cfg.profile.location_preference)
    ? cfg.profile.location_preference
    : [cfg.profile.location_preference];

  const lines = [
    "profile:",
    `  name: "${cfg.profile.name}"`,
    "  positions:",
    ...cfg.profile.positions.map((p) => `    - "${p}"`),
    "  expertise:",
    ...cfg.profile.expertise.map((e) => `    - "${e}"`),
    "  resume_summary: |",
    ...cfg.profile.resume_summary.split("\n").map((l) => `    ${l}`),
    "  location_preference:",
    ...locs.map((l) => `    - "${l}"`),
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
    "notifications:",
    "  email:",
    `    enabled: ${cfg.notifications?.email?.enabled ?? false}`,
    `    to: "${cfg.notifications?.email?.to ?? ""}"`,
    `    from_addr: "${cfg.notifications?.email?.from_addr ?? ""}"`,
    `    smtp_host: "${cfg.notifications?.email?.smtp_host ?? "smtp.gmail.com"}"`,
    `    smtp_port: ${cfg.notifications?.email?.smtp_port ?? 587}`,
    `    score_threshold: ${cfg.notifications?.email?.score_threshold ?? 8}`,
    "",
    "app:",
    `  port: ${cfg.app.port}`,
    `  host: "${cfg.app.host}"`,
  ];
  return lines.join("\n") + "\n";
}

export function Settings() {
  return (
    <div className="px-8 py-8 max-w-3xl space-y-6">
      <div className="mb-2">
        <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Settings</h1>
        <p className="text-sm text-slate-400 mt-0.5">Configure your job search preferences</p>
      </div>
      <ConfigEditor />
      <LinkedInStatus />
      <RunHistory />
    </div>
  );
}
