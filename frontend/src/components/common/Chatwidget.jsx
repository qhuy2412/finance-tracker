import { useState, useRef, useEffect } from "react";
import { MessageCircle, X, Clock, Plus, Send } from "lucide-react";
import chatService from "../../services/chat.service";

const WELCOME = "Xin chào! Mình là trợ lý tài chính FinTra. Bạn muốn biết gì hôm nay?";

const QUICK_QUESTIONS = [
  "Tháng này tôi tiêu bao nhiêu?",
  "Tổng số dư các ví?",
  "Mục tiêu tiết kiệm của tôi?",
];

export default function ChatWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  const [sessions, setSessions] = useState([]);
  const [currentSessionId, setCurrentSessionId] = useState(null);
  const [messages, setMessages] = useState([{ role: "assistant", content: WELCOME }]);

  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef(null);

  // Auto-scroll on new message
  useEffect(() => {
    if (isOpen) bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isOpen]);

  // Load sessions on first open
  useEffect(() => {
    if (isOpen && sessions.length === 0) loadSessions();
  }, [isOpen]);

  async function loadSessions() {
    try {
      const data = await chatApi.getSessions();
      setSessions(data);
      if (data.length > 0 && !currentSessionId) {
        await switchSession(data[0].id);
      }
    } catch {
      // silent
    }
  }

  async function switchSession(sessionId) {
    setCurrentSessionId(sessionId);
    setShowHistory(false);
    try {
      const msgs = await chatApi.getMessages(sessionId);
      setMessages(msgs.length > 0 ? msgs : [{ role: "assistant", content: WELCOME }]);
    } catch {
      setMessages([{ role: "assistant", content: WELCOME }]);
    }
  }

  async function startNewSession() {
    try {
      const { session_id } = await chatApi.createSession();
      setCurrentSessionId(session_id);
      setMessages([{ role: "assistant", content: WELCOME }]);
      setShowHistory(false);
      setSessions((prev) => [
        { id: session_id, title: "Cuộc trò chuyện mới", updated_at: new Date() },
        ...prev,
      ]);
    } catch {
      setMessages([{ role: "assistant", content: WELCOME }]);
    }
  }

  async function handleSend() {
    const text = input.trim();
    if (!text || loading) return;

    setMessages((prev) => [...prev, { role: "user", content: text }]);
    setInput("");
    setLoading(true);
    setMessages((prev) => [...prev, { role: "assistant", content: "..." }]);

    try {
      const { reply, session_id } = await chatApi.sendMessage(text, currentSessionId);

      if (!currentSessionId) {
        setCurrentSessionId(session_id);
        loadSessions();
      }

      setMessages((prev) => [
        ...prev.slice(0, -1),
        { role: "assistant", content: reply },
      ]);

      setSessions((prev) =>
        prev.map((s) =>
          s.id === session_id
            ? { ...s, title: text.slice(0, 50), updated_at: new Date() }
            : s
        )
      );
    } catch {
      setMessages((prev) => [
        ...prev.slice(0, -1),
        { role: "assistant", content: "Xin lỗi, mình gặp sự cố kết nối. Bạn thử lại nhé!" },
      ]);
    } finally {
      setLoading(false);
    }
  }

  function handleKeyDown(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  return (
    <>
      {/* ── Chat Panel ── */}
      {isOpen && (
        <div
          className="fixed bottom-20 right-5 z-50 flex flex-col bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden"
          style={{ width: "360px", height: "540px" }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 bg-blue-600 text-white flex-shrink-0">
            <div className="flex items-center gap-2">
              {/* Online dot */}
              <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-sm shadow-emerald-300" />
              <span className="font-semibold text-sm tracking-tight">Trợ lý FinTra</span>
            </div>
            <div className="flex items-center gap-1">
              {/* History */}
              <button
                onClick={() => setShowHistory((v) => !v)}
                title="Lịch sử trò chuyện"
                className="h-7 w-7 flex items-center justify-center rounded-lg text-blue-200 hover:text-white hover:bg-blue-500 transition-colors"
              >
                <Clock size={14} />
              </button>
              {/* New session */}
              <button
                onClick={startNewSession}
                title="Cuộc trò chuyện mới"
                className="h-7 w-7 flex items-center justify-center rounded-lg text-blue-200 hover:text-white hover:bg-blue-500 transition-colors"
              >
                <Plus size={14} />
              </button>
              {/* Close */}
              <button
                onClick={() => setIsOpen(false)}
                className="h-7 w-7 flex items-center justify-center rounded-lg text-blue-200 hover:text-white hover:bg-blue-500 transition-colors"
              >
                <X size={14} />
              </button>
            </div>
          </div>

          {/* History overlay */}
          {showHistory && (
            <div className="absolute inset-0 top-[52px] bg-white z-10 flex flex-col">
              <div className="px-4 py-3 border-b border-slate-100">
                <p className="text-xs font-semibold tracking-widest uppercase text-slate-400">
                  Lịch sử trò chuyện
                </p>
              </div>
              <div className="flex-1 overflow-y-auto">
                {sessions.length === 0 ? (
                  <p className="text-sm text-slate-400 text-center mt-10">
                    Chưa có cuộc trò chuyện nào
                  </p>
                ) : (
                  sessions.map((s) => (
                    <button
                      key={s.id}
                      onClick={() => switchSession(s.id)}
                      className={`w-full text-left px-4 py-3 border-b border-slate-50 hover:bg-slate-50 transition-colors ${
                        s.id === currentSessionId ? "bg-blue-50 border-l-2 border-l-blue-600" : ""
                      }`}
                    >
                      <p className="text-sm font-medium text-slate-800 truncate">{s.title}</p>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {new Date(s.updated_at).toLocaleDateString("vi-VN")}
                      </p>
                    </button>
                  ))
                )}
              </div>
            </div>
          )}

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 bg-slate-50">
            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                {/* Assistant avatar */}
                {msg.role === "assistant" && (
                  <div className="h-6 w-6 rounded-full bg-blue-600 flex items-center justify-center mr-2 mt-0.5 flex-shrink-0 shadow-sm shadow-blue-200">
                    <svg width="10" height="10" viewBox="0 0 40 40" fill="none">
                      <path d="M20 2L5 8.5v10.5C5 29.2 11.8 37 20 39 28.2 37 35 29.2 35 19V8.5L20 2z"
                        fill="rgba(255,255,255,0.3)" stroke="rgba(255,255,255,0.7)" strokeWidth="2" />
                      <polyline points="10,25 15,18 20,22 26,13 32,8"
                        stroke="white" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                )}
                <div
                  className={`max-w-[78%] px-3 py-2.5 rounded-2xl text-sm whitespace-pre-wrap leading-relaxed ${
                    msg.role === "user"
                      ? "bg-blue-600 text-white rounded-br-sm shadow-sm shadow-blue-200"
                      : "bg-white text-slate-700 rounded-bl-sm border border-slate-100 shadow-sm"
                  }`}
                >
                  {msg.content === "..." ? (
                    <span className="flex gap-1 items-center h-4">
                      {[0, 150, 300].map((delay) => (
                        <span
                          key={delay}
                          className="w-1.5 h-1.5 bg-slate-300 rounded-full animate-bounce"
                          style={{ animationDelay: `${delay}ms` }}
                        />
                      ))}
                    </span>
                  ) : (
                    msg.content
                  )}
                </div>
              </div>
            ))}
            <div ref={bottomRef} />
          </div>

          {/* Quick questions — only on welcome state */}
          {messages.length === 1 && (
            <div className="px-4 py-2.5 flex flex-wrap gap-1.5 flex-shrink-0 bg-slate-50 border-t border-slate-100">
              {QUICK_QUESTIONS.map((q) => (
                <button
                  key={q}
                  onClick={() => setInput(q)}
                  className="text-xs px-3 py-1.5 rounded-full border border-blue-200 text-blue-600 bg-white hover:bg-blue-50 hover:border-blue-300 transition-colors font-medium"
                >
                  {q}
                </button>
              ))}
            </div>
          )}

          {/* Input */}
          <div className="px-3 py-3 border-t border-slate-100 bg-white flex gap-2 flex-shrink-0">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Hỏi gì đó..."
              rows={1}
              className="flex-1 resize-none rounded-xl border border-slate-200 bg-slate-50 text-slate-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-300 placeholder-slate-400 transition-colors"
              style={{ maxHeight: "80px" }}
            />
            <button
              onClick={handleSend}
              disabled={loading || !input.trim()}
              className="w-9 h-9 flex items-center justify-center rounded-xl bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex-shrink-0 shadow-sm shadow-blue-200"
            >
              <Send size={15} />
            </button>
          </div>
        </div>
      )}

      {/* ── Floating Button ── */}
      <button
        onClick={() => setIsOpen((v) => !v)}
        className="fixed bottom-5 right-5 z-50 w-14 h-14 flex items-center justify-center rounded-full bg-blue-600 text-white shadow-lg shadow-blue-200 hover:bg-blue-700 transition-all hover:scale-105 active:scale-95"
        aria-label="Mở trợ lý tài chính"
      >
        {isOpen ? <X size={22} /> : <MessageCircle size={22} />}
      </button>
    </>
  );
}