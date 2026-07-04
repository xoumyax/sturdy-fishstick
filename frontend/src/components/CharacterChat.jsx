import { useEffect, useRef, useState } from "react";

const BASE = import.meta.env.DEV ? `http://${window.location.hostname}:8001` : "";

async function* streamPersona(messages, persona, mode) {
  const resp = await fetch(`${BASE}/chat/stream`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
      persona,
      mode: mode || "careers",
    }),
  });
  if (!resp.ok) { yield "[couldn't connect]"; return; }

  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const lines = buf.split("\n");
    buf = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      const payload = line.slice(6);
      if (payload === "[DONE]") return;
      try { const { content } = JSON.parse(payload); if (content) yield content; } catch {}
    }
  }
}

const CHARACTERS = {
  puff: {
    name: "Puff",
    greeting: "Hii!! ✨ Puff is SO happy you clicked!! 🎵 Ask me anything about your job hunt, your resume, or just talk — Puff loves chatting! 💕",
    bubble: { background: "linear-gradient(135deg, #f8d7f5, #fce8ff)", border: "rgba(220,100,220,0.25)" },
    header: { background: "linear-gradient(135deg, #d966d6, #b94fc4)" },
    userBubble: { background: "linear-gradient(135deg, #d966d6, #b94fc4)" },
    inputBorder: "rgba(200,80,200,0.35)",
    inputRing: "rgba(200,80,200,0.25)",
    sendBg: "linear-gradient(135deg, #d966d6, #b94fc4)",
  },
  brownie: {
    name: "Brownie",
    greeting: "yo 🔥 what's good. ask me anything — jobs, resume, interview stuff. i'll give it to you straight, no fluff.",
    bubble: { background: "linear-gradient(135deg, #fff4ea, #fff0e0)", border: "rgba(220,120,50,0.25)" },
    header: { background: "linear-gradient(135deg, #e8630a, #c44d00)" },
    userBubble: { background: "linear-gradient(135deg, #e8630a, #c44d00)" },
    inputBorder: "rgba(220,100,30,0.35)",
    inputRing: "rgba(220,100,30,0.25)",
    sendBg: "linear-gradient(135deg, #e8630a, #c44d00)",
  },
};

function TypingDots({ color }) {
  return (
    <span className="inline-flex items-center gap-1 py-0.5 px-0.5">
      {[0, 150, 300].map((d) => (
        <span key={d} className="w-1.5 h-1.5 rounded-full animate-bounce"
          style={{ background: color, animationDelay: `${d}ms`, animationDuration: "800ms" }} />
      ))}
    </span>
  );
}

const AVATARS = { puff: "/jigglypuff.png", brownie: "/charizard.png" };

function SizeButton({ active, onClick, title, children }) {
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      title={title}
      className="text-white/70 hover:text-white w-6 h-6 flex items-center justify-center rounded-lg hover:bg-white/20 transition-colors"
      style={active ? { background: "rgba(255,255,255,0.25)", color: "white" } : {}}
    >
      {children}
    </button>
  );
}

export function CharacterChat({ persona, open, onClose, bottomOffset, mode, onExpandChange }) {
  const cfg = CHARACTERS[persona];
  const [messages, setMessages] = useState([{ id: "hi", role: "assistant", content: cfg.greeting }]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [size, setSize] = useState(() => {
    try { return localStorage.getItem(`charChatSize:${persona}`) || "bubble"; } catch { return "bubble"; }
  });
  const bottomRef = useRef(null);
  const inputRef = useRef(null);

  const expanded = size !== "bubble";

  function changeSize(s) {
    const next = size === s ? "bubble" : s; // clicking active size returns to bubble
    setSize(next);
    try { localStorage.setItem(`charChatSize:${persona}`, next); } catch {}
  }

  // Tell the parent when this chat covers the screen so the corner sprite
  // can dock into the header (and reappear on close).
  useEffect(() => { onExpandChange?.(open && expanded); }, [open, expanded, onExpandChange]);

  useEffect(() => { if (open) setTimeout(() => inputRef.current?.focus(), 80); }, [open, size]);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  async function send(txt) {
    const text = (txt ?? input).trim();
    if (!text || busy) return;
    setInput("");
    const userId = Date.now();
    const aiId = Date.now() + 1;
    setMessages((p) => [...p, { id: userId, role: "user", content: text }, { id: aiId, role: "assistant", content: "", streaming: true }]);
    setBusy(true);
    const history = [...messages, { role: "user", content: text }]
      .filter((m) => m.content)
      .slice(-16)
      .map(({ role, content }) => ({ role, content }));
    try {
      let acc = "";
      for await (const chunk of streamPersona(history, persona, mode)) {
        acc += chunk;
        setMessages((p) => p.map((m) => m.id === aiId ? { ...m, content: acc, streaming: false } : m));
      }
    } catch {
      setMessages((p) => p.map((m) => m.id === aiId ? { ...m, content: "oops, can't reach Ollama right now!", streaming: false } : m));
    } finally {
      setBusy(false);
      setMessages((p) => p.map((m) => m.id === aiId ? { ...m, streaming: false } : m));
    }
  }

  if (!open) return null;

  const dotColor = persona === "puff" ? "#c060c0" : "#c05010";

  const sizeStyles = {
    bubble: {
      position: "absolute", width: 300, maxHeight: 420,
      bottom: bottomOffset, right: 0, borderRadius: 24, zIndex: 60,
    },
    half: {
      position: "fixed", top: 0, right: 0, bottom: 0,
      width: "min(50vw, 680px)", minWidth: 380,
      borderRadius: "24px 0 0 24px", zIndex: 70,
    },
    full: {
      position: "fixed", inset: 0, borderRadius: 0, zIndex: 70,
    },
  };

  return (
    <div
      className="flex flex-col overflow-hidden cursor-default"
      onClick={(e) => e.stopPropagation()}
      onMouseEnter={(e) => e.stopPropagation()}
      style={{
        ...sizeStyles[size],
        background: cfg.bubble.background,
        border: `1.5px solid ${cfg.bubble.border}`,
        boxShadow: "0 8px 40px rgba(0,0,0,0.18), 0 2px 8px rgba(0,0,0,0.10)",
      }}
    >
      {/* Header — the character docks here when expanded */}
      <div className="flex items-center gap-2.5 px-4 py-3 flex-shrink-0" style={{ background: cfg.header.background }}>
        {expanded ? (
          <img src={AVATARS[persona]} alt={cfg.name}
            style={{ width: 34, height: 34, objectFit: "contain", filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.25))" }} />
        ) : (
          <span className="text-lg">{persona === "puff" ? "🎵" : "🔥"}</span>
        )}
        <p className="text-white font-bold text-sm flex-1">{cfg.name}</p>
        <SizeButton active={size === "half"} onClick={() => changeSize("half")} title="Half screen">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <rect x="3" y="3" width="18" height="18" rx="2"/><line x1="12" y1="3" x2="12" y2="21"/>
          </svg>
        </SizeButton>
        <SizeButton active={size === "full"} onClick={() => changeSize("full")} title="Full screen">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/>
          </svg>
        </SizeButton>
        <button
          onClick={(e) => { e.stopPropagation(); onClose(); }}
          className="text-white/70 hover:text-white w-6 h-6 flex items-center justify-center rounded-lg hover:bg-white/20 transition-colors"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-3 py-3 min-h-0">
       <div className="space-y-2.5 w-full" style={expanded ? { maxWidth: 720, margin: "0 auto" } : {}}>
        {messages.map((msg) => {
          const isUser = msg.role === "user";
          return (
            <div key={msg.id} className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
              <div
                className="max-w-[88%] px-3 py-2 rounded-2xl text-xs leading-relaxed"
                style={
                  isUser
                    ? { background: cfg.userBubble.background, color: "white", borderBottomRightRadius: 4 }
                    : { background: "white", color: "#1e293b", borderBottomLeftRadius: 4, boxShadow: "0 1px 4px rgba(0,0,0,0.08)" }
                }
              >
                {msg.streaming && !msg.content
                  ? <TypingDots color={dotColor} />
                  : <span className="whitespace-pre-wrap">{msg.content}</span>
                }
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
       </div>
      </div>

      {/* Quick prompts — only show early in conversation */}
      {messages.length <= 2 && (
        <div className="px-3 pb-2 flex flex-col gap-1.5 flex-shrink-0">
          {(persona === "puff"
            ? ["Show me my top jobs! ✨", "How do I set this app up? 💕", "How do I update my target roles? 🌸"]
            : ["which job should I apply to first", "how do I update my preferences", "how do I set this app up from scratch"]
          ).map((p) => (
            <button key={p} onClick={() => send(p)}
              className="text-left text-[11px] px-3 py-1.5 rounded-xl border transition-colors truncate"
              style={{ borderColor: cfg.bubble.border, background: "rgba(255,255,255,0.6)", color: "#374151" }}
            >
              {p}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <div className="px-3 pb-3 pt-1 flex-shrink-0">
        <div className="flex gap-1.5 items-end w-full" style={expanded ? { maxWidth: 720, margin: "0 auto" } : {}}>
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); send(); } }}
            placeholder={persona === "puff" ? "say something!! ✨" : "what's on your mind"}
            disabled={busy}
            className="flex-1 text-xs border rounded-xl px-3 py-2 focus:outline-none disabled:opacity-50 bg-white"
            style={{ borderColor: cfg.inputBorder, boxShadow: `0 0 0 0px ${cfg.inputRing}` }}
          />
          <button
            onClick={() => send()}
            disabled={!input.trim() || busy}
            className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 disabled:opacity-35 transition-all"
            style={{ background: cfg.sendBg }}
          >
            {busy
              ? <svg className="animate-spin" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5"><path d="M21 12a9 9 0 11-6.22-8.56"/></svg>
              : <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
            }
          </button>
        </div>
      </div>
    </div>
  );
}
