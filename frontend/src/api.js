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
  getAggregates: () => req("/jobs?only_aggregates=true&score_min=0"),
  updateJob: (id, body) => req(`/jobs/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  generateCoverLetter: (id) => req(`/jobs/${id}/cover-letter`, { method: "POST" }),
  generateResumeAdvice: (id) => req(`/jobs/${id}/resume-advice`, { method: "POST" }),
  notifyJob: (id) => req(`/jobs/${id}/notify`, { method: "POST" }),
  triggerSearch: () => req("/search/trigger", { method: "POST" }),
  getRuns: () => req("/runs"),
  getStats: () => req("/config/stats"),
  getTrends: () => req("/config/trends"),
  getConfig: () => req("/config"),
  getLinkedInStatus: () => req("/config/linkedin-status"),
  updateConfig: (yaml_content) => req("/config", { method: "POST", body: JSON.stringify({ yaml_content }) }),
  exportCsvUrl: () => `${BASE}/jobs/export`,
};
