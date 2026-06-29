import { useEffect, useState } from "react";
import { CharacterChat } from "./components/CharacterChat";
import { ChatPanel } from "./components/ChatPanel";
import { FishingBackground } from "./components/FishingBackground";
import { FloatingJobPanel } from "./components/FloatingJobPanel";
import { LinkedInPanel } from "./components/LinkedInPanel";
import { Dashboard } from "./pages/Dashboard";
import { Settings } from "./pages/Settings";
import { Tracker } from "./pages/Tracker";

const NAV = [
  { id: "Dashboard", icon: DashIcon },
  { id: "Tracker",   icon: TrackerIcon },
  { id: "Settings",  icon: SettingsIcon },
];

function DashIcon({ active }) {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.2 : 1.8} strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" />
    </svg>
  );
}

function TrackerIcon({ active }) {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.2 : 1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 11l3 3L22 4" /><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" />
    </svg>
  );
}

function SettingsIcon({ active }) {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.2 : 1.8} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
    </svg>
  );
}

function ChatIcon({ active }) {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.2 : 1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
    </svg>
  );
}

function loadPanelVis() {
  try { return JSON.parse(localStorage.getItem("panelVis")) || {}; } catch { return {}; }
}

export default function App() {
  const [page, setPage] = useState("Dashboard");
  const [chatOpen, setChatOpen] = useState(false);
  const [chatJob, setChatJob] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [panelVis, setPanelVis] = useState(() => {
    const saved = loadPanelVis();
    return { linkedin: true, careers: true, phd: true, ...saved };
  });
  const [dark, setDark] = useState(() => {
    try {
      const saved = localStorage.getItem("darkMode");
      return saved === null ? true : saved === "true"; // default dark
    } catch { return true; }
  });

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
    localStorage.setItem("darkMode", dark);
  }, [dark]);

  useEffect(() => {
    document.title = `${page} | Sturdy Fishstick`;
  }, [page]);

  function openChat(job = null) {
    if (job) setChatJob(job);
    setChatOpen(true);
  }

  function navigate(id) {
    setPage(id);
    setSidebarOpen(false);
  }

  function hidePanel(name) {
    const next = { ...panelVis, [name]: false };
    setPanelVis(next);
    localStorage.setItem("panelVis", JSON.stringify(next));
  }

  function showPanel(name) {
    const next = { ...panelVis, [name]: true };
    setPanelVis(next);
    localStorage.setItem("panelVis", JSON.stringify(next));
  }

  return (
    <div className="flex min-h-screen relative">
      {/* Animated fishing background */}
      <FishingBackground dark={dark} />

      {/* Backdrop — closes sidebar on click outside */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/20 backdrop-blur-[1px]"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Hamburger button — only when sidebar is closed */}
      {!sidebarOpen && <button
        onClick={() => setSidebarOpen((v) => !v)}
        className="fixed top-4 left-4 z-40 w-9 h-9 flex flex-col items-center justify-center gap-[5px] rounded-xl shadow-md transition-all duration-150 hover:scale-105 active:scale-95"
        style={{ background: "linear-gradient(135deg, #097C87, #1A8C72)" }}
        aria-label="Toggle menu"
      >
        <span className="h-[2px] rounded-full bg-white block" style={{ width: 18 }} />
        <span className="h-[2px] rounded-full bg-white block" style={{ width: 14 }} />
        <span className="h-[2px] rounded-full bg-white block" style={{ width: 18 }} />
      </button>}

      {/* Sidebar */}
      <aside
        className="w-52 min-h-screen flex-shrink-0 flex flex-col fixed left-0 top-0 z-30"
        style={{
          background: "linear-gradient(160deg, #097C87 0%, #065d66 55%, #1A8C72 100%)",
          transform: sidebarOpen ? "translateX(0)" : "translateX(-100%)",
          transition: "transform 0.25s cubic-bezier(0.4, 0, 0.2, 1)",
          boxShadow: sidebarOpen ? "4px 0 24px rgba(0,0,0,0.18)" : "none",
        }}
      >
        {/* Logo */}
        <div className="px-5 pt-7 pb-5">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-2xl flex items-center justify-center text-xl shadow-lg flex-shrink-0"
              style={{ background: "linear-gradient(135deg, #23CED9, #FCA47C)" }}
            >
              🐟
            </div>
            <div>
              <p className="text-white font-bold text-sm leading-tight">Sturdy Fishstick</p>
              <p className="text-[10px] mt-0.5 leading-none font-medium" style={{ color: "#B8EDD6" }}>
                Job Radar
              </p>
            </div>
          </div>
        </div>

        <div className="mx-5 mb-4 h-px" style={{ background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.15), transparent)" }} />

        {/* Nav */}
        <nav className="flex-1 px-3 space-y-0.5">
          {NAV.map(({ id, icon: Icon }) => {
            const active = page === id;
            return (
              <button
                key={id}
                onClick={() => navigate(id)}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150"
                style={{
                  background: active ? "rgba(255,255,255,0.16)" : "transparent",
                  color: active ? "white" : "rgba(255,255,255,0.55)",
                  boxShadow: active ? "inset 0 1px 0 rgba(255,255,255,0.1)" : "none",
                }}
                onMouseEnter={(e) => { if (!active) e.currentTarget.style.background = "rgba(255,255,255,0.09)"; e.currentTarget.style.color = "rgba(255,255,255,0.88)"; }}
                onMouseLeave={(e) => { if (!active) e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "rgba(255,255,255,0.55)"; }}
              >
                <Icon active={active} />
                {id}
              </button>
            );
          })}
        </nav>

        {/* Chat button */}
        <div className="px-3 pb-2">
          <div className="h-px mb-3" style={{ background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.12), transparent)" }} />
          <button
            onClick={() => { openChat(); setSidebarOpen(false); }}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150"
            style={{
              background: chatOpen ? "rgba(35,206,217,0.25)" : "rgba(35,206,217,0.12)",
              color: chatOpen ? "white" : "rgba(255,255,255,0.75)",
              border: chatOpen ? "1px solid rgba(35,206,217,0.4)" : "1px solid transparent",
            }}
          >
            <ChatIcon active={chatOpen} />
            Ask Fishstick
          </button>
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t flex items-center justify-between" style={{ borderColor: "rgba(255,255,255,0.08)" }}>
          <p className="text-[10px]" style={{ color: "rgba(255,255,255,0.22)" }}>v0.4 · localhost:8001</p>
          <button
            onClick={() => setDark((v) => !v)}
            title={dark ? "Switch to light mode" : "Switch to dark mode"}
            className="w-7 h-7 rounded-lg flex items-center justify-center transition-all hover:scale-110 active:scale-95"
            style={{ background: "rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.6)" }}
          >
            {dark ? (
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                <circle cx="12" cy="12" r="4"/>
                <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/>
              </svg>
            ) : (
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/>
              </svg>
            )}
          </button>
        </div>
      </aside>

      {/* Main content — full width, padded top for hamburger button */}
      <main className="flex-1 min-h-screen w-full pt-14 relative" style={{ zIndex: 1 }}>
        {page === "Dashboard" && <Dashboard onChat={openChat} panelVis={panelVis} onShowPanel={showPanel} />}
        {page === "Tracker"   && <Tracker />}
        {page === "Settings"  && <Settings />}
      </main>

      {/* Chat panel */}
      <ChatPanel
        open={chatOpen}
        onClose={() => setChatOpen(false)}
        jobContext={chatJob}
        onClearContext={() => setChatJob(null)}
      />

      {/* LinkedIn feed panel */}
      {panelVis.linkedin && <LinkedInPanel chatOpen={chatOpen} onHide={() => hidePanel("linkedin")} />}

      {/* Career page crawl panel */}
      {panelVis.careers && (
        <FloatingJobPanel
          label="Careers"
          sources={["career_page"]}
          accent="#097C87"
          accentDark="#065d66"
          headerIcon={(color) => (
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="7" width="20" height="14" rx="2" />
              <path d="M16 7V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v2" />
            </svg>
          )}
          chatOpen={chatOpen}
          toggleBottom={210}
          onHide={() => hidePanel("careers")}
        />
      )}

      {/* PhD positions panel */}
      {panelVis.phd && (
        <FloatingJobPanel
          label="PhD"
          sources={["phd"]}
          accent="#6366f1"
          accentDark="#4f46e5"
          headerIcon={(color) => (
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
              <path d="M6 12v5c3 3 9 3 12 0v-5" />
            </svg>
          )}
          chatOpen={chatOpen}
          toggleBottom={265}
          onHide={() => hidePanel("phd")}
        />
      )}

      {/* Corner companions */}
      <CornerCompanions chatOpen={chatOpen} />
    </div>
  );
}

function CornerCompanions({ chatOpen }) {
  const [hovered, setHovered] = useState(null);
  const [activeChat, setActiveChat] = useState(null); // "puff" | "brownie" | null
  const rightOffset = chatOpen ? 406 : 16;

  function toggle(who) {
    setActiveChat((prev) => (prev === who ? null : who));
  }

  return (
    <div
      className="fixed flex items-end gap-2 transition-all duration-300 ease-out"
      style={{ right: rightOffset, bottom: 18, zIndex: 55 }}
    >
      {/* ── Puff ── */}
      <div
        className="relative cursor-pointer select-none"
        onClick={() => toggle("puff")}
        onMouseEnter={() => setHovered("puff")}
        onMouseLeave={() => setHovered(null)}
      >
        <CharacterChat
          persona="puff"
          open={activeChat === "puff"}
          onClose={() => setActiveChat(null)}
          bottomOffset={76}
        />

        <img
          src="/jigglypuff.png"
          alt="Puff"
          style={{
            width: 64,
            height: 64,
            objectFit: "contain",
            display: "block",
            marginBottom: 10,
            filter: "drop-shadow(0 4px 10px rgba(200,80,200,0.30))",
            transition: "transform 0.2s ease",
            transform:
              activeChat === "puff"
                ? "scale(1.22) translateY(-8px)"
                : hovered === "puff"
                ? "scale(1.12) translateY(-4px)"
                : "scale(1) translateY(0)",
          }}
        />

        {/* Name badge — overlaid at bottom of image, never in flow */}
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 pointer-events-none">
          <span
            className="text-[9px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap shadow-sm"
            style={{
              background: activeChat === "puff" ? "linear-gradient(135deg,#d966d6,#b94fc4)" : "white",
              color: activeChat === "puff" ? "white" : "#b040b0",
              border: "1.5px solid rgba(200,80,200,0.3)",
            }}
          >
            Puff
          </span>
        </div>
      </div>

      {/* ── Brownie ── */}
      <div
        className="relative cursor-pointer select-none"
        onClick={() => toggle("brownie")}
        onMouseEnter={() => setHovered("brownie")}
        onMouseLeave={() => setHovered(null)}
      >
        <CharacterChat
          persona="brownie"
          open={activeChat === "brownie"}
          onClose={() => setActiveChat(null)}
          bottomOffset={100}
        />

        <img
          src="/charizard.png"
          alt="Brownie"
          style={{
            width: 92,
            height: 92,
            objectFit: "contain",
            display: "block",
            filter: "drop-shadow(0 6px 14px rgba(220,100,30,0.35))",
            transition: "transform 0.2s ease",
            transform:
              activeChat === "brownie"
                ? "scale(1.15) translateY(-10px)"
                : hovered === "brownie"
                ? "scale(1.07) translateY(-5px)"
                : "scale(1) translateY(0)",
          }}
        />

        {/* Name badge — overlaid at bottom of image, never in flow */}
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 pointer-events-none">
          <span
            className="text-[9px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap shadow-sm"
            style={{
              background: activeChat === "brownie" ? "linear-gradient(135deg,#e8630a,#c44d00)" : "white",
              color: activeChat === "brownie" ? "white" : "#b04800",
              border: "1.5px solid rgba(220,100,30,0.3)",
            }}
          >
            Brownie
          </span>
        </div>
      </div>
    </div>
  );
}
