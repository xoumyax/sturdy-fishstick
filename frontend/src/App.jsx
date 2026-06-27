import { useState } from "react";
import { Dashboard } from "./pages/Dashboard";
import { Tracker } from "./pages/Tracker";
import { Settings } from "./pages/Settings";

const PAGES = ["Dashboard", "Tracker", "Settings"];

export default function App() {
  const [page, setPage] = useState("Dashboard");

  return (
    <div className="min-h-screen bg-slate-50">
      <nav className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 flex items-center gap-1 h-12">
          <span className="font-bold text-indigo-600 mr-4">JobRadar</span>
          {PAGES.map((p) => (
            <button
              key={p}
              onClick={() => setPage(p)}
              className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                page === p
                  ? "bg-indigo-600 text-white font-medium"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              {p}
            </button>
          ))}
        </div>
      </nav>
      {page === "Dashboard" && <Dashboard />}
      {page === "Tracker" && <Tracker />}
      {page === "Settings" && <Settings />}
    </div>
  );
}
