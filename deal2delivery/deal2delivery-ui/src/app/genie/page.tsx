"use client";
import { useState, useRef, useEffect } from "react";
import { Send, Loader2, ChevronDown, ChevronUp, Zap, Search, AlertCircle, Trash2 } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface Message {
  role: "user" | "assistant";
  content: string;
  type?: "query" | "action" | "text" | "error";
  sql?: string;
  rows?: Record<string, string>[];
  columns?: string[];
  tool?: string;
}

const QUERY_CHIPS = [
  "Which customers haven't ordered in 90 days?",
  "Top 5 customers by total revenue",
  "Show total revenue by product category",
  "Which customers are at highest churn risk?",
  "What is the average churn probability across all customers?",
  "Which products have the highest order volume?",
  "Show total order count by customer",
  "What is the average days since last order?",
  "List all customers with more than 2 open cases",
  "What is the total revenue from all orders?",
];

const ACTION_CHIPS = [
  "Flag GlobalTech Solutions for urgent outreach",
  "Reorder 200 Business Laptop Pros — Critical",
  "Set stock alert for Ultrabook Slim below 30 units",
  "Schedule a follow-up with Apex Financial next Monday",
  "Escalate CloudBase Inc to high-priority watch list",
  "Mark Workstation Desktop i9 as critical priority",
  "Reorder 500 Smartphone Pro Max units — Standard",
  "Refresh the demand forecast pipeline",
  "Set stock alert for Wireless Earbuds below 50 units",
  "Flag Meridian Logistics for at-risk outreach",
];

const CAPABILITIES = [
  { icon: "🔍", label: "Query live data" },
  { icon: "🚩", label: "Flag customers" },
  { icon: "📦", label: "Reorder stock" },
  { icon: "📅", label: "Schedule follow-ups" },
  { icon: "🔔", label: "Set stock alerts" },
  { icon: "⚡", label: "Trigger pipelines" },
];

const SESSION_KEY = "novatech-ai-messages";

export default function GeniePage() {
  const [messages,  setMessages]  = useState<Message[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const saved = sessionStorage.getItem(SESSION_KEY);
      return saved ? (JSON.parse(saved) as Message[]) : [];
    } catch { return []; }
  });
  const [input,     setInput]     = useState("");
  const [loading,   setLoading]   = useState(false);
  const [statusMsg, setStatusMsg] = useState("");
  const [sqlOpen,   setSqlOpen]   = useState<Record<number, boolean>>({});
  const bottomRef   = useRef<HTMLDivElement>(null);
  const inputRef    = useRef<HTMLTextAreaElement>(null);
  const autoSentRef = useRef(false);

  useEffect(() => {
    try { sessionStorage.setItem(SESSION_KEY, JSON.stringify(messages)); } catch {}
  }, [messages]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  useEffect(() => {
    if (autoSentRef.current) return;
    const q = new URLSearchParams(window.location.search).get("q");
    if (q) { autoSentRef.current = true; send(q); }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function send(text: string) {
    if (!text.trim() || loading) return;
    // Include both user AND assistant messages so GPT-4o has full context
    // across multi-turn flows (e.g. clarification → follow-up answer)
    const history = messages
      .filter((m) => m.type !== "error")
      .slice(-10)
      .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));

    setMessages((prev) => [...prev, { role: "user", content: text }]);
    setInput("");
    setLoading(true);
    setStatusMsg("Understanding your request…");

    try {
      const isQuery = /which|what|show|list|how many|top|trend|who|give me/i.test(text);
      if (isQuery) {
        setTimeout(() => setStatusMsg("Generating SQL with Genie…"), 1200);
        setTimeout(() => setStatusMsg("Running query on Databricks…"), 4000);
      } else {
        setTimeout(() => setStatusMsg("Executing action…"), 800);
      }

      const res  = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, history }),
      });
      const data = await res.json();

      setMessages((prev) => [...prev, {
        role:    "assistant",
        content: data.content ?? data.summary ?? "Done.",
        type:    data.type,
        sql:     data.sql,
        rows:    data.rows,
        columns: data.columns,
        tool:    data.tool,
      }]);
    } catch {
      setMessages((prev) => [...prev, {
        role: "assistant", type: "error",
        content: "Something went wrong. Please try again.",
      }]);
    } finally {
      setLoading(false);
      setStatusMsg("");
      inputRef.current?.focus();
    }
  }

  function clearSession() {
    setMessages([]);
    try { sessionStorage.removeItem(SESSION_KEY); } catch {}
  }

  function handleKey(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input); }
  }

  const isEmpty = messages.length === 0;

  return (
    // Fixed: escapes layout padding entirely, fills exact remaining viewport after navbar (h-14 = 56px)
    <div
      className="fixed inset-x-0 bottom-0 flex flex-col bg-gray-50 dark:bg-gray-950"
      style={{ top: "56px" }}
    >
      {/* ── Inner column ── */}
      <div className="flex flex-col h-full max-w-3xl w-full mx-auto">

        {/* Header */}
        <div className="shrink-0 px-4 pt-3 pb-3 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 space-y-2.5">
          {/* Title row */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center shrink-0">
                <Zap size={15} className="text-white" />
              </div>
              <div>
                <p className="text-sm font-semibold leading-none">NovaTech AI</p>
                <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-0.5">
                  GPT-4o · Databricks Genie · Session cached
                </p>
              </div>
            </div>
            {!isEmpty && (
              <button
                onClick={clearSession}
                className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
                title="Clear conversation"
              >
                <Trash2 size={15} />
              </button>
            )}
          </div>

          {/* Description */}
          <p className="text-[11px] text-gray-500 dark:text-gray-400 leading-relaxed">
            NovaTech AI is a GPT-4o assistant connected to your live Databricks Lakehouse. Ask questions in plain English and it queries SAP + Salesforce data via Databricks Genie, or triggers real operational actions that are logged to Delta tables and visible in the War Room.
          </p>

          {/* Available tools */}
          <div className="flex flex-wrap gap-1.5">
            {[
              { icon: "🔍", label: "Query data" },
              { icon: "🚩", label: "Flag customer" },
              { icon: "⬆️", label: "Escalate" },
              { icon: "📅", label: "Schedule follow-up" },
              { icon: "📦", label: "Reorder stock" },
              { icon: "🔔", label: "Set stock alert" },
              { icon: "⚠️", label: "Mark SKU critical" },
              { icon: "⚡", label: "Trigger pipeline" },
            ].map(({ icon, label }) => (
              <span key={label} className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-700">
                <span>{icon}</span><span>{label}</span>
              </span>
            ))}
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden min-h-0">
          {isEmpty ? (
            <EmptyState onChip={(t) => send(t)} />
          ) : (
            <div className="px-4 py-4 space-y-3">
              {messages.map((m, i) => (
                <div key={i}>
                  <MessageBubble
                    msg={m}
                    sqlOpen={!!sqlOpen[i]}
                    onToggleSql={() => setSqlOpen((p) => ({ ...p, [i]: !p[i] }))}
                  />
                  {/* Inline suggestions after each assistant reply (not errors, not while loading) */}
                  {m.role === "assistant" && m.type !== "error" && i === messages.length - 1 && !loading && (
                    <SuggestionRow seed={i} onSend={send} disabled={loading} />
                  )}
                </div>
              ))}
              {loading && <TypingIndicator status={statusMsg} />}
              <div ref={bottomRef} />
            </div>
          )}
        </div>


        {/* Input */}
        <div className="shrink-0 px-4 py-3 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800">
          <div className="flex gap-2 items-end bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl px-4 py-2.5 focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500/20 transition-all">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKey}
              placeholder="Ask about customers, inventory, revenue… or take an action"
              rows={1}
              disabled={loading}
              className="flex-1 resize-none bg-transparent text-sm outline-none text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 max-h-28 leading-relaxed"
            />
            <button
              onClick={() => send(input)}
              disabled={!input.trim() || loading}
              className="shrink-0 w-8 h-8 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center transition-colors"
            >
              {loading
                ? <Loader2 size={14} className="text-white animate-spin" />
                : <Send size={14} className="text-white" />
              }
            </button>
          </div>
          <p className="text-[11px] text-center text-gray-300 dark:text-gray-700 mt-1.5">
            Enter to send · Shift+Enter for new line
          </p>
        </div>
      </div>
    </div>
  );
}

// ── Inline suggestion row — shown after each assistant reply ──────────────
function SuggestionRow({ seed, onSend, disabled }: {
  seed: number;
  onSend: (t: string) => void;
  disabled: boolean;
}) {
  // Stable "random" pick per message — different offsets so Q and A don't cycle together
  const q = QUERY_CHIPS[(seed * 3 + 2) % QUERY_CHIPS.length];
  const a = ACTION_CHIPS[(seed * 2 + 1) % ACTION_CHIPS.length];

  return (
    <div className="mt-2 ml-8 grid grid-cols-2 gap-2">
      <button
        onClick={() => onSend(q)}
        disabled={disabled}
        className="text-left text-[11px] px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:border-blue-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/30 transition-all disabled:opacity-40 shadow-sm leading-snug"
      >
        <span className="block text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-0.5 flex items-center gap-1">
          <Search size={9} /> Ask
        </span>
        {q}
      </button>
      <button
        onClick={() => onSend(a)}
        disabled={disabled}
        className="text-left text-[11px] px-3 py-2 rounded-xl border border-violet-200 dark:border-violet-800/50 bg-white dark:bg-gray-800 text-violet-700 dark:text-violet-400 hover:bg-violet-50 dark:hover:bg-violet-950/30 hover:border-violet-400 transition-all disabled:opacity-40 shadow-sm leading-snug"
      >
        <span className="block text-[10px] font-semibold text-violet-400 dark:text-violet-500 uppercase tracking-wide mb-0.5 flex items-center gap-1">
          <Zap size={9} /> War Room
        </span>
        {a}
      </button>
    </div>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────
function EmptyState({ onChip }: { onChip: (t: string) => void }) {
  return (
    <div className="flex flex-col justify-center h-full px-4 py-6 gap-6 max-w-2xl mx-auto w-full">

      {/* Hero */}
      <div className="text-center">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center mx-auto mb-3 shadow-lg shadow-blue-500/20">
          <Zap size={22} className="text-white" />
        </div>
        <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">Oracle — NovaTech AI</h2>
        <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
          Query live Databricks data or take actions — all in plain English
        </p>
      </div>

      {/* Capability pills */}
      <div className="flex flex-wrap gap-2 justify-center">
        {CAPABILITIES.map(({ icon, label }) => (
          <span
            key={label}
            className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 shadow-sm"
          >
            <span>{icon}</span>
            <span>{label}</span>
          </span>
        ))}
      </div>

      {/* Chips grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <div className="space-y-2">
          <p className="text-[11px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider flex items-center gap-1">
            <Search size={10} /> Questions
          </p>
          {QUERY_CHIPS.map((c) => (
            <button
              key={c}
              onClick={() => onChip(c)}
              className="w-full text-left text-xs px-3 py-2.5 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:border-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/30 hover:text-blue-700 dark:hover:text-blue-300 transition-all shadow-sm"
            >
              {c}
            </button>
          ))}
        </div>
        <div className="space-y-2">
          <p className="text-[11px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider flex items-center gap-1">
            <Zap size={10} /> War Room
          </p>
          {ACTION_CHIPS.map((c) => (
            <button
              key={c}
              onClick={() => onChip(c)}
              className="w-full text-left text-xs px-3 py-2.5 rounded-xl bg-white dark:bg-gray-800 border border-violet-200 dark:border-violet-800/50 text-violet-700 dark:text-violet-400 hover:bg-violet-50 dark:hover:bg-violet-950/30 hover:border-violet-400 transition-all shadow-sm"
            >
              {c}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Message bubble ────────────────────────────────────────────────────────
function MessageBubble({ msg, sqlOpen, onToggleSql }: {
  msg: Message; sqlOpen: boolean; onToggleSql: () => void;
}) {
  if (msg.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[78%] bg-blue-600 text-white rounded-2xl rounded-tr-md px-4 py-2.5 text-sm shadow-sm">
          {msg.content}
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-2.5 max-w-full">
      <div className="w-6 h-6 rounded-md bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center shrink-0 mt-1">
        <Zap size={11} className="text-white" />
      </div>

      <div className="flex-1 space-y-2 min-w-0 overflow-hidden">

        {/* Error */}
        {msg.type === "error" && (
          <div className="flex items-start gap-2 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-xl p-3 text-sm text-red-700 dark:text-red-400">
            <AlertCircle size={14} className="shrink-0 mt-0.5" />
            {msg.content}
          </div>
        )}

        {/* Text */}
        {(msg.type === "text" || !msg.type) && (
          <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl rounded-tl-md px-4 py-3 shadow-sm">
            <Md>{msg.content}</Md>
          </div>
        )}

        {/* Action confirmation */}
        {msg.type === "action" && (
          <div className="bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/50 rounded-2xl rounded-tl-md px-4 py-3 shadow-sm">
            <Md className="text-emerald-800 dark:text-emerald-300">{msg.content}</Md>
            <p className="text-[11px] text-emerald-500 dark:text-emerald-600 mt-2 flex items-center gap-1">
              <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
              Logged to War Room · {new Date().toLocaleTimeString()}
            </p>
          </div>
        )}

        {/* Query result */}
        {msg.type === "query" && (
          <div className="space-y-2">
            {msg.content && (
              <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl rounded-tl-md px-4 py-3 shadow-sm">
                <Md>{msg.content}</Md>
              </div>
            )}

            {msg.sql && (
              <div>
                <button
                  onClick={onToggleSql}
                  className="flex items-center gap-1.5 text-[11px] text-gray-400 hover:text-blue-500 transition-colors"
                >
                  {sqlOpen ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
                  {sqlOpen ? "Hide" : "Show"} generated SQL
                </button>
                {sqlOpen && (
                  <pre className="mt-1.5 text-[11px] bg-gray-900 text-green-400 rounded-xl p-3 overflow-x-auto whitespace-pre-wrap break-all">
                    {msg.sql}
                  </pre>
                )}
              </div>
            )}

            {msg.rows && msg.rows.length > 0 && (
              <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50 dark:bg-gray-800">
                    <tr>
                      {msg.columns?.map((col) => (
                        <th key={col} className="px-3 py-2 text-left font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide whitespace-nowrap">
                          {col.replace(/_/g, " ")}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-gray-800/50 divide-y divide-gray-100 dark:divide-gray-700">
                    {msg.rows.slice(0, 10).map((row, i) => (
                      <tr key={i} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                        {msg.columns?.map((col) => (
                          <td key={col} className="px-3 py-2 text-gray-800 dark:text-gray-200 max-w-[200px] truncate">
                            {row[col] ?? "—"}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
                {msg.rows.length > 10 && (
                  <p className="text-[11px] text-center text-gray-400 py-2 bg-gray-50 dark:bg-gray-800">
                    Showing 10 of {msg.rows.length} rows
                  </p>
                )}
              </div>
            )}

            {msg.rows?.length === 0 && (
              <p className="text-xs text-gray-400 italic">No rows returned.</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Markdown ──────────────────────────────────────────────────────────────
function Md({ children, className = "" }: { children: string; className?: string }) {
  return (
    <div className={`text-sm leading-relaxed text-gray-800 dark:text-gray-200 ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          p:      ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
          ul:     ({ children }) => <ul className="list-disc list-inside mb-2 space-y-0.5">{children}</ul>,
          ol:     ({ children }) => <ol className="list-decimal list-inside mb-2 space-y-0.5">{children}</ol>,
          li:     ({ children }) => <li className="text-sm">{children}</li>,
          strong: ({ children }) => <strong className="font-semibold text-gray-900 dark:text-gray-100">{children}</strong>,
          em:     ({ children }) => <em className="italic text-gray-600 dark:text-gray-400">{children}</em>,
          code:   ({ children }) => (
            <code className="text-xs bg-gray-100 dark:bg-gray-700 text-blue-600 dark:text-blue-300 px-1.5 py-0.5 rounded font-mono">
              {children}
            </code>
          ),
          h1: ({ children }) => <h1 className="text-base font-bold mb-2">{children}</h1>,
          h2: ({ children }) => <h2 className="text-sm font-bold mb-1.5">{children}</h2>,
          h3: ({ children }) => <h3 className="text-sm font-semibold mb-1">{children}</h3>,
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}

// ── Typing indicator ──────────────────────────────────────────────────────
function TypingIndicator({ status }: { status: string }) {
  return (
    <div className="flex gap-2.5">
      <div className="w-6 h-6 rounded-md bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center shrink-0 mt-1">
        <Zap size={11} className="text-white" />
      </div>
      <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl rounded-tl-md px-4 py-3 flex items-center gap-2 shadow-sm">
        <div className="flex gap-1">
          <span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
          <span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
          <span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
        </div>
        <span className="text-xs text-gray-400">{status}</span>
      </div>
    </div>
  );
}
