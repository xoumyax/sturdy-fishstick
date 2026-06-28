import { useEffect, useRef, useState } from "react";

const BASE = "http://localhost:8001";

async function* streamChat(messages, jobId) {
  const resp = await fetch(`${BASE}/chat/stream`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
      job_id: jobId ?? null,
    }),
  });

  if (!resp.ok) {
    yield `[Error ${resp.status}]`;
    return;
  }

  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      const payload = line.slice(6);
      if (payload === "[DONE]") return;
      try {
        const { content } = JSON.parse(payload);
        if (content) yield content;
      } catch {}
    }
  }
}

function TypingDots() {
  return (
    <span className="inline-flex items-center gap-1 px-1 py-0.5">
      {[0, 150, 300].map((d) => (
        <span
          key={d}
          className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce"
          style={{ animationDelay: `${d}ms`, animationDuration: "900ms" }}
        />
      ))}
    </span>
  );
}

function Message({ msg }) {
  const isUser = msg.role === "user";
  return (
    <div className={`flex items-end gap-2 mb-4 ${isUser ? "flex-row-reverse" : "flex-row"}`}>
      {!isUser && (
        <div
          className="w-7 h-7 rounded-xl flex-shrink-0 flex items-center justify-center text-sm shadow-sm"
          style={{ background: "linear-gradient(135deg, #23CED9, #097C87)" }}
        >
          🐟
        </div>
      )}
      <div
        className={`max-w-[82%] px-4 py-2.5 text-sm leading-relaxed ${
          isUser
            ? "text-white rounded-2xl rounded-br-sm shadow-sm"
            : "bg-white border border-slate-200 text-slate-800 rounded-2xl rounded-bl-sm shadow-sm"
        }`}
        style={isUser ? { background: "linear-gradient(135deg, #097C87, #1A8C72)" } : {}}
      >
        {msg.streaming && !msg.content ? (
          <TypingDots />
        ) : (
          <pre className="whitespace-pre-wrap font-sans text-sm">{msg.content}</pre>
        )}
      </div>
    </div>
  );
}

const WELCOME = {
  id: "welcome",
  role: "assistant",
  content:
    "Hi! I'm Fishstick 🐟 — your job search AI. I know your profile, your resumes, and all the jobs in your list.\n\nAsk me anything: about specific jobs, how to tailor your resume, cover letter help, or how the app works.",
};

function getSuggestions(jobContext) {
  if (jobContext) {
    return [
      `What are the key requirements for ${jobContext.title.slice(0, 40)}?`,
      "How should I tailor my resume for this role?",
      "Draft a cover letter for this job",
      "What's the interview likely to cover?",
    ];
  }
  return [
    "Which of my jobs should I apply to first?",
    "How do I improve my match scores?",
    "How does the auto-scan scheduling work?",
    "Tips for tailoring my resume to ML roles",
  ];
}

export function ChatPanel({ open, onClose, jobContext, onClearContext }) {
  const [messages, setMessages] = useState([WELCOME]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const bottomRef = useRef(null);
  const inputRef = useRef(null);
  const abortRef = useRef(false);
  const prevJobRef = useRef(null);

  // Inject context-change notice when job changes
  useEffect(() => {
    if (jobContext && jobContext.id !== prevJobRef.current) {
      prevJobRef.current = jobContext.id;
      setMessages((prev) => [
        ...prev,
        {
          id: `ctx-${Date.now()}`,
          role: "assistant",
          content: `📌 Now focused on: **${jobContext.title}**${jobContext.company ? ` @ ${jobContext.company}` : ""}${jobContext.match_score != null ? ` (score: ${jobContext.match_score}/10)` : ""}`,
        },
      ]);
    }
  }, [jobContext]);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [open]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function send(text) {
    const msg = (text ?? input).trim();
    if (!msg || streaming) return;
    setInput("");

    const userMsg = { id: Date.now(), role: "user", content: msg };
    const assistantId = Date.now() + 1;
    const assistantMsg = { id: assistantId, role: "assistant", content: "", streaming: true };

    setMessages((prev) => [...prev, userMsg, assistantMsg]);
    setStreaming(true);
    abortRef.current = false;

    const history = [...messages, userMsg]
      .filter((m) => m.role === "user" || (m.role === "assistant" && m.content && !m.content.startsWith("📌")))
      .slice(-20)
      .map((m) => ({ role: m.role, content: m.content }));

    try {
      let accumulated = "";
      for await (const chunk of streamChat(history, jobContext?.id)) {
        if (abortRef.current) break;
        accumulated += chunk;
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId ? { ...m, content: accumulated, streaming: false } : m
          )
        );
      }
      if (!accumulated) throw new Error("empty response");
    } catch {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId
            ? { ...m, content: "Couldn't reach Ollama. Make sure it's running (`ollama serve`).", streaming: false }
            : m
        )
      );
    } finally {
      setStreaming(false);
      setMessages((prev) =>
        prev.map((m) => (m.id === assistantId ? { ...m, streaming: false } : m))
      );
    }
  }

  const suggestions = getSuggestions(jobContext);
  const showSuggestions = messages.length <= 2;

  return (
    <>
      {/* Backdrop — click closes panel */}
      <div
        className={`fixed inset-0 z-40 transition-opacity duration-300 ${open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"}`}
        style={{ background: "rgba(0,0,0,0.08)", backdropFilter: "blur(0.5px)" }}
        onClick={onClose}
      />

      {/* Slide-in panel */}
      <div
        className="fixed top-0 right-0 h-full z-50 flex flex-col transition-transform duration-300 ease-out"
        style={{
          width: 390,
          background: "#f8fffe",
          borderLeft: "1.5px solid #d1ede8",
          boxShadow: "-8px 0 40px rgba(9,124,135,0.12)",
          transform: open ? "translateX(0)" : "translateX(100%)",
        }}
      >
        {/* Header */}
        <div
          className="flex-shrink-0 flex items-center gap-3 px-5 py-4"
          style={{ background: "linear-gradient(135deg, #097C87 0%, #1A8C72 100%)" }}
        >
          <div
            className="w-9 h-9 rounded-2xl flex items-center justify-center text-xl flex-shrink-0"
            style={{ background: "rgba(255,255,255,0.18)" }}
          >
            🐟
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white font-bold text-sm leading-tight">Fishstick AI</p>
            <p className="text-[10px] leading-none mt-0.5" style={{ color: "#B8EDD6" }}>
              phi3:mini · local · private
            </p>
          </div>
          <button
            onClick={() => {
              setMessages([WELCOME]);
              prevJobRef.current = null;
              onClearContext?.();
            }}
            className="text-white/60 hover:text-white text-xs px-2.5 py-1.5 rounded-lg hover:bg-white/15 transition-colors"
          >
            Clear
          </button>
          <button
            onClick={onClose}
            className="text-white/70 hover:text-white p-1.5 rounded-lg hover:bg-white/15 transition-colors"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Job context badge */}
        {jobContext && (
          <div
            className="flex-shrink-0 flex items-center gap-2.5 px-4 py-2.5"
            style={{ background: "rgba(35,206,217,0.07)", borderBottom: "1px solid rgba(35,206,217,0.18)" }}
          >
            <div className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: "rgba(9,124,135,0.12)" }}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#097C87" strokeWidth="2.5" strokeLinecap="round">
                <rect x="2" y="7" width="20" height="14" rx="2" /><path d="M16 7V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v2" />
              </svg>
            </div>
            <p className="text-xs text-brand-dark font-medium flex-1 truncate">
              {jobContext.title}
              {jobContext.company && <span className="text-slate-400 font-normal"> · {jobContext.company}</span>}
              {jobContext.match_score != null && (
                <span className="ml-1.5 text-[10px] font-bold text-brand-dark bg-brand-teal/15 px-1.5 py-0.5 rounded-full">
                  {jobContext.match_score}/10
                </span>
              )}
            </p>
            <button
              onClick={onClearContext}
              className="text-slate-400 hover:text-slate-600 transition-colors flex-shrink-0"
              title="Remove job context"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        )}

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 pt-4 pb-2">
          {messages.map((msg) => <Message key={msg.id} msg={msg} />)}
          <div ref={bottomRef} />
        </div>

        {/* Suggested prompts */}
        {showSuggestions && (
          <div className="flex-shrink-0 px-4 pb-2 space-y-1.5">
            <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider mb-2">Try asking…</p>
            {suggestions.map((s) => (
              <button
                key={s}
                onClick={() => send(s)}
                className="w-full text-left text-xs px-3.5 py-2 rounded-xl border text-brand-dark transition-all hover:shadow-sm truncate"
                style={{ borderColor: "rgba(9,124,135,0.2)", background: "white" }}
              >
                {s}
              </button>
            ))}
          </div>
        )}

        {/* Input */}
        <div
          className="flex-shrink-0 px-4 py-3 border-t"
          style={{ borderColor: "#d1ede8" }}
        >
          <div className="flex gap-2 items-end">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
              placeholder="Ask about jobs, resume, cover letters…"
              rows={2}
              disabled={streaming}
              className="flex-1 text-sm border rounded-2xl px-3.5 py-2.5 resize-none focus:outline-none focus:ring-2 placeholder-slate-400 disabled:opacity-60"
              style={{
                borderColor: "#c8e8e3",
                background: "white",
                maxHeight: 120,
                "--tw-ring-color": "rgba(35,206,217,0.35)",
              }}
            />
            <button
              onClick={() => send()}
              disabled={!input.trim() || streaming}
              className="w-10 h-10 rounded-2xl flex-shrink-0 flex items-center justify-center transition-all disabled:opacity-35 hover:brightness-110 shadow-sm"
              style={{ background: "linear-gradient(135deg, #23CED9, #097C87)" }}
            >
              {streaming ? (
                <svg className="animate-spin" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5"><path d="M21 12a9 9 0 11-6.22-8.56" /></svg>
              ) : (
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round">
                  <line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" />
                </svg>
              )}
            </button>
          </div>
          <p className="text-[10px] text-slate-400 text-center mt-2">
            Enter to send · Shift+Enter for new line · all data stays local
          </p>
        </div>
      </div>
    </>
  );
}
