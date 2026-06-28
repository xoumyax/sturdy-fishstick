import { useEffect, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { api } from "../api";

const COUNTRY_COLORS = [
  "#23CED9", "#FCA47C", "#A1CCA6", "#F9D779", "#097C87", "#6366f1",
  "#ec4899", "#f59e0b", "#10b981", "#8b5cf6",
];

function shortDate(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

function WeeklyBar({ daily }) {
  if (!daily || daily.length === 0) {
    return <p className="text-sm text-slate-400 text-center py-6">No data yet — run a search first.</p>;
  }

  // Roll up into weekly buckets (last 4 weeks)
  const weeks = {};
  for (const d of daily) {
    const date = new Date(d.date);
    const day = date.getDay();
    const weekStart = new Date(date);
    weekStart.setDate(date.getDate() - day);
    const key = weekStart.toISOString().slice(0, 10);
    if (!weeks[key]) weeks[key] = { week: `W of ${shortDate(key)}`, new_jobs: 0, priority: 0 };
    weeks[key].new_jobs += d.new_jobs;
    weeks[key].priority += d.priority;
  }

  const data = Object.values(weeks).slice(-4);

  return (
    <ResponsiveContainer width="100%" height={180}>
      <BarChart data={data} barSize={28} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis dataKey="week" tick={{ fontSize: 11 }} />
        <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
        <Tooltip contentStyle={{ fontSize: 12 }} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Bar dataKey="new_jobs" name="New jobs" fill="#23CED9" radius={[4, 4, 0, 0]} />
        <Bar dataKey="priority" name="Priority" fill="#FCA47C" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

function DailyBar({ daily }) {
  if (!daily || daily.length === 0) {
    return <p className="text-sm text-slate-400 text-center py-6">No data yet.</p>;
  }

  const data = daily.slice(-14).map((d) => ({
    date: shortDate(d.date),
    new_jobs: d.new_jobs,
    priority: d.priority,
    avg_score: d.avg_score,
  }));

  return (
    <ResponsiveContainer width="100%" height={180}>
      <BarChart data={data} barSize={18} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis dataKey="date" tick={{ fontSize: 10 }} />
        <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
        <Tooltip contentStyle={{ fontSize: 12 }} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Bar dataKey="new_jobs" name="New" fill="#23CED9" radius={[3, 3, 0, 0]} />
        <Bar dataKey="priority" name="Priority" fill="#FCA47C" radius={[3, 3, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

function CountryBar({ countries }) {
  if (!countries || countries.length === 0) return null;
  return (
    <ResponsiveContainer width="100%" height={180}>
      <BarChart
        data={countries}
        layout="vertical"
        barSize={16}
        margin={{ top: 4, right: 24, left: 60, bottom: 0 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
        <XAxis type="number" tick={{ fontSize: 10 }} allowDecimals={false} />
        <YAxis type="category" dataKey="country" tick={{ fontSize: 11 }} width={58} />
        <Tooltip contentStyle={{ fontSize: 12 }} />
        <Bar dataKey="total" name="Total" radius={[0, 4, 4, 0]}>
          {countries.map((_, i) => <Cell key={i} fill={COUNTRY_COLORS[i % COUNTRY_COLORS.length]} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export function TrendCharts() {
  const [data, setData] = useState(null);
  const [activeTab, setActiveTab] = useState("weekly");

  useEffect(() => {
    api.getTrends().then(setData).catch(() => {});
  }, []);

  if (!data) return null;

  const tabs = [
    { id: "weekly", label: "Weekly" },
    { id: "daily",  label: "Daily (14d)" },
    { id: "country", label: "By Country" },
  ];

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 mb-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold text-brand-dark">Trends</h2>
        <div className="flex gap-1">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`text-xs px-3 py-1 rounded-lg transition-colors ${
                activeTab === t.id
                  ? "bg-brand-dark text-white"
                  : "bg-slate-100 text-slate-500 hover:bg-slate-200"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {activeTab === "weekly"  && <WeeklyBar  daily={data.daily} />}
      {activeTab === "daily"   && <DailyBar   daily={data.daily} />}
      {activeTab === "country" && <CountryBar countries={data.countries} />}
    </div>
  );
}
