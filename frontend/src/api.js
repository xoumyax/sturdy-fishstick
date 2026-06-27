const BASE = "http://localhost:8001";

async function req(path, opts = {}) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...opts,
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}

export const api = {
  getJobs: (params = {}) => {
    const q = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => v != null && q.set(k, v));
    return req(`/jobs?${q}`);
  },
  updateJob: (id, body) => req(`/jobs/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  generateCoverLetter: (id) => req(`/jobs/${id}/cover-letter`, { method: "POST" }),
  triggerSearch: () => req("/search/trigger", { method: "POST" }),
  getRuns: () => req("/runs"),
  getStats: () => req("/config/stats"),
  getConfig: () => req("/config"),
  updateConfig: (yaml_content) => req("/config", { method: "POST", body: JSON.stringify({ yaml_content }) }),
  exportCsvUrl: () => `${BASE}/jobs/export`,
};
