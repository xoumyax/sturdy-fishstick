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

function CareerWatchTab() {
  const [watchData, setWatchData] = useState(null);
  const [msg, setMsg] = useState(null);
  const [crawling, setCrawling] = useState(false);

  useEffect(() => {
    api.getCareerWatch().then((d) => { if (Object.keys(d).length > 0) setWatchData(d); }).catch(() => {});
  }, []);

  function handleFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      let parsed;
      try {
        parsed = JSON.parse(ev.target.result);
      } catch (err) {
        setMsg({ type: "error", text: "Could not parse file — make sure it is valid JSON. " + err.message });
        setTimeout(() => setMsg(null), 6000);
        return;
      }
      try {
        await api.updateCareerWatch(parsed);
        setWatchData(parsed);
        const total = Object.values(parsed).reduce((a, v) => a + v.length, 0);
        setMsg({ type: "success", text: `Saved ${total} companies across ${Object.keys(parsed).length} categories.` });
      } catch (err) {
        setMsg({ type: "error", text: "Backend error: " + err.message + " — try restarting the backend server." });
      }
      setTimeout(() => setMsg(null), 6000);
    };
    reader.readAsText(file);
  }

  async function handleCrawl() {
    setCrawling(true);
    try {
      await api.crawlCareers();
      setMsg({ type: "success", text: "Career crawl started — check the Dashboard for new listings." });
    } catch (e) {
      setMsg({ type: "error", text: "Crawl failed: " + e.message });
    } finally {
      setCrawling(false);
      setTimeout(() => setMsg(null), 5000);
    }
  }

  const totalCompanies = watchData ? Object.values(watchData).reduce((a, v) => a + v.length, 0) : 0;
  const categories = watchData ? Object.keys(watchData) : [];

  return (
    <div className="space-y-4">
      {/* Upload card */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
        <div className="flex items-start justify-between mb-3">
          <div>
            <h2 className="font-semibold text-brand-dark">Career Page Watchlist</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              {watchData ? `${totalCompanies} companies across ${categories.length} categories` : "No watchlist uploaded yet"}
            </p>
          </div>
          <div className="flex gap-2">
            <label className="cursor-pointer px-3 py-1.5 text-xs font-semibold rounded-xl border border-brand-dark text-brand-dark hover:bg-brand-dark hover:text-white transition-colors">
              Upload JSON
              <input type="file" accept=".json" className="hidden" onChange={handleFile} />
            </label>
            <button
              onClick={handleCrawl}
              disabled={crawling || !watchData}
              className="px-3 py-1.5 text-xs font-semibold rounded-xl text-white disabled:opacity-50 transition-all"
              style={{ background: "linear-gradient(135deg,#097C87,#1A8C72)" }}
            >
              {crawling ? "Starting…" : "Crawl Now"}
            </button>
          </div>
        </div>

        {msg && (
          <p className={`text-xs px-3 py-2 rounded-xl mb-3 ${msg.type === "success" ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-600"}`}>
            {msg.text}
          </p>
        )}

        <div className="text-xs text-slate-500 bg-slate-50 rounded-xl p-3 mb-3">
          <p className="font-medium mb-1">Expected JSON format:</p>
          <pre className="font-mono text-[10px] text-slate-600 leading-relaxed overflow-x-auto">{`{
  "Frontier AI Labs": [
    { "name": "Anthropic", "url": "https://www.anthropic.com/careers" },
    { "name": "OpenAI",    "url": "https://openai.com/careers/" }
  ],
  "Big Tech": [
    { "name": "Google", "url": "https://careers.google.com/" }
  ]
}`}</pre>
        </div>

        <p className="text-[10px] text-slate-400">
          Known ATS (Greenhouse, Lever) are detected automatically from the URL and queried via their JSON APIs.
          When an API returns a 404 (wrong slug or moved ATS), Playwright/Chromium scrapes the career page directly.
          Other companies use Serper site-search as a fallback.
        </p>
      </div>

      {/* Company list */}
      {watchData && (
        <div className="space-y-3">
          {categories.map((cat) => (
            <div key={cat} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-slate-700">{cat}</h3>
                <span className="text-[10px] text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">{watchData[cat].length} companies</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {watchData[cat].map((c) => (
                  <a
                    key={c.name}
                    href={c.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-lg border border-slate-200 hover:border-brand-teal hover:text-brand-dark transition-colors text-slate-600"
                  >
                    <span className="w-4 h-4 rounded flex items-center justify-center text-[9px] font-bold text-white flex-shrink-0"
                      style={{ background: "#097C87" }}>
                      {c.name[0]}
                    </span>
                    {c.name}
                  </a>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const TABS = ["Config", "Career Watch", "Run History"];

export function Settings() {
  const [tab, setTab] = useState("Config");

  return (
    <div className="px-8 py-8 max-w-5xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Settings</h1>
        <p className="text-sm text-slate-400 mt-0.5">Configure your job search preferences</p>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 mb-6 p-1 w-fit rounded-xl" style={{ background: "rgba(9,124,135,0.08)" }}>
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className="px-5 py-1.5 text-sm font-medium rounded-lg transition-all duration-150"
            style={
              tab === t
                ? { background: "white", color: "#097C87", boxShadow: "0 1px 4px rgba(0,0,0,0.1)", fontWeight: 600 }
                : { color: "#5d8a8f" }
            }
          >
            {t}
          </button>
        ))}
      </div>

      <div className="space-y-6">
        {tab === "Config" && (
          <>
            <ConfigEditor />
            <LinkedInStatus />
          </>
        )}
        {tab === "Career Watch" && <CareerWatchTab />}
        {tab === "Run History" && <RunHistory />}
      </div>
    </div>
  );
}
