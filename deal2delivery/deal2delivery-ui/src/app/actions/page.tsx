"use client";
import { useEffect, useState, useCallback } from "react";
import { RefreshCw, Flag, ArrowUpCircle, Calendar, Package, Bell, AlertTriangle, Zap, CheckCircle2 } from "lucide-react";

interface CustomerAction {
  action_id: string; customer_name: string; action_type: string;
  priority: string; notes: string; follow_up_date: string;
  created_at: string; status: string;
}
interface StockRequest {
  request_id: string; product_name: string; request_type: string;
  quantity: string; threshold: string; urgency: string;
  notes: string; created_at: string; status: string;
}
interface PipelineRequest {
  request_id: string; pipeline_name: string;
  requested_at: string; status: string; job_run_id: string;
}

const ACTION_ICONS: Record<string, React.ReactNode> = {
  FLAG_OUTREACH:     <Flag size={13} />,
  ESCALATE:          <ArrowUpCircle size={13} />,
  SCHEDULE_FOLLOWUP: <Calendar size={13} />,
  REORDER:           <Package size={13} />,
  ALERT_THRESHOLD:   <Bell size={13} />,
  CRITICAL_FLAG:     <AlertTriangle size={13} />,
};

const ACTION_LABEL: Record<string, string> = {
  FLAG_OUTREACH:     "Flagged for outreach",
  ESCALATE:          "Escalated",
  SCHEDULE_FOLLOWUP: "Follow-up scheduled",
  REORDER:           "Reorder requested",
  ALERT_THRESHOLD:   "Alert threshold set",
  CRITICAL_FLAG:     "Marked critical",
};

const CUSTOMER_STATUSES  = ["Open", "In Progress", "Complete"];
const STOCK_STATUSES     = ["Pending", "In Progress", "Fulfilled", "Complete"];
const PIPELINE_STATUSES  = ["Requested", "Running", "Complete"];

function fmt(ts: string) {
  if (!ts) return "—";
  try { return new Date(ts).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }); }
  catch { return ts; }
}

function PriorityBadge({ p }: { p: string }) {
  const cls = p === "High" || p === "Critical"
    ? "bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300"
    : "bg-yellow-100 dark:bg-yellow-900/40 text-yellow-700 dark:text-yellow-300";
  return <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${cls}`}>{p}</span>;
}

function StatusSelect({
  id, table, current, options, onComplete,
}: {
  id: string; table: string; current: string;
  options: string[]; onComplete: () => void;
}) {
  const [value,   setValue]   = useState(current);
  const [saving,  setSaving]  = useState(false);

  async function handleChange(next: string) {
    setValue(next);
    setSaving(true);
    try {
      await fetch("/api/data/agent-actions", {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ id, table, status: next }),
      });
      if (next === "Complete") onComplete();
    } finally {
      setSaving(false);
    }
  }

  const isComplete = value === "Complete";
  return (
    <div className="flex items-center gap-1 shrink-0">
      {saving && <RefreshCw size={11} className="animate-spin text-gray-400" />}
      {isComplete ? (
        <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400 font-medium">
          <CheckCircle2 size={11} /> Complete
        </span>
      ) : (
        <select
          value={value}
          onChange={(e) => handleChange(e.target.value)}
          disabled={saving}
          className="text-xs border border-gray-200 dark:border-gray-700 rounded-lg px-2 py-1 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 cursor-pointer hover:border-blue-400 transition-colors disabled:opacity-50 focus:outline-none focus:ring-1 focus:ring-blue-500"
        >
          {options.map((o) => (
            <option key={o} value={o}>{o}</option>
          ))}
        </select>
      )}
    </div>
  );
}

export default function ActionsPage() {
  const [customers,   setCustomers]   = useState<CustomerAction[]>([]);
  const [stock,       setStock]       = useState<StockRequest[]>([]);
  const [pipeline,    setPipeline]    = useState<PipelineRequest[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [lastRefresh, setLastRefresh] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res  = await fetch("/api/data/agent-actions", { cache: "no-store" });
      const data = await res.json();
      setCustomers(data.customers ?? []);
      setStock(data.stock     ?? []);
      setPipeline(data.pipeline  ?? []);
      setLastRefresh(new Date().toLocaleTimeString());
    } catch { /* show empty state */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const total = customers.length + stock.length + pipeline.length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">War Room</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5 italic">
            Every move made by NovaTech AI — live from Delta tables.
          </p>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1 leading-relaxed max-w-2xl">
            Three Delta tables back this feed:{" "}
            <span className="font-medium text-gray-500 dark:text-gray-400">customer_actions</span>,{" "}
            <span className="font-medium text-gray-500 dark:text-gray-400">stock_requests</span>, and{" "}
            <span className="font-medium text-gray-500 dark:text-gray-400">pipeline_requests</span>.
            Update status inline — completed actions are automatically hidden.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {lastRefresh && <p className="text-xs text-gray-400">Updated {lastRefresh}</p>}
          <button
            onClick={load}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors disabled:opacity-50"
          >
            <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
            Refresh
          </button>
        </div>
      </div>

      {/* Summary strip */}
      {!loading && (
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "Customer Actions", count: customers.length, color: "blue"   },
            { label: "Stock Requests",   count: stock.length,     color: "orange" },
            { label: "Pipeline Runs",    count: pipeline.length,  color: "purple" },
          ].map(({ label, count, color }) => (
            <div key={label} className={`rounded-xl border p-4 text-center ${
              color === "blue"   ? "border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/20"
              : color === "orange" ? "border-orange-200 dark:border-orange-800 bg-orange-50 dark:bg-orange-950/20"
              : "border-purple-200 dark:border-purple-800 bg-purple-50 dark:bg-purple-950/20"
            }`}>
              <p className="text-2xl font-bold">{count}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{label}</p>
            </div>
          ))}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center h-40 text-gray-400">
          <RefreshCw size={20} className="animate-spin mr-2" /> Loading War Room…
        </div>
      ) : total === 0 ? (
        <EmptyActions />
      ) : (
        <div className="space-y-8">

          {/* Customer actions */}
          {customers.length > 0 && (
            <Section title="Customer Actions" icon={<Flag size={16} className="text-blue-500" />}>
              <div className="space-y-2">
                {customers.map((a) => (
                  <div key={a.action_id}
                    className="flex flex-wrap items-start gap-3 p-3 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40">
                      {ACTION_ICONS[a.action_type] ?? <Flag size={13} />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-sm">{a.customer_name}</span>
                        <span className="text-xs text-gray-500 dark:text-gray-400">{ACTION_LABEL[a.action_type] ?? a.action_type}</span>
                        {a.priority && <PriorityBadge p={a.priority} />}
                      </div>
                      {a.notes && <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{a.notes}</p>}
                      {a.follow_up_date && <p className="text-xs text-blue-600 dark:text-blue-400 mt-0.5">Follow-up: {a.follow_up_date}</p>}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <p className="text-xs text-gray-400">{fmt(a.created_at)}</p>
                      <StatusSelect
                        id={a.action_id}
                        table="customer_actions"
                        current={a.status}
                        options={CUSTOMER_STATUSES}
                        onComplete={() => setCustomers((prev) => prev.filter((x) => x.action_id !== a.action_id))}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </Section>
          )}

          {/* Stock requests */}
          {stock.length > 0 && (
            <Section title="Stock Requests" icon={<Package size={16} className="text-orange-500" />}>
              <div className="space-y-2">
                {stock.map((s) => (
                  <div key={s.request_id}
                    className="flex flex-wrap items-start gap-3 p-3 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-950/40">
                      {ACTION_ICONS[s.request_type] ?? <Package size={13} />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-sm">{s.product_name}</span>
                        <span className="text-xs text-gray-500 dark:text-gray-400">{ACTION_LABEL[s.request_type] ?? s.request_type}</span>
                        {s.urgency && <PriorityBadge p={s.urgency} />}
                      </div>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                        {s.quantity ? `${Number(s.quantity).toLocaleString("en-US")} units` : ""}
                        {s.threshold ? `Alert below ${Number(s.threshold).toLocaleString("en-US")} units` : ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <p className="text-xs text-gray-400">{fmt(s.created_at)}</p>
                      <StatusSelect
                        id={s.request_id}
                        table="stock_requests"
                        current={s.status}
                        options={STOCK_STATUSES}
                        onComplete={() => setStock((prev) => prev.filter((x) => x.request_id !== s.request_id))}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </Section>
          )}

          {/* Pipeline requests */}
          {pipeline.length > 0 && (
            <Section title="Pipeline Requests" icon={<Zap size={16} className="text-purple-500" />}>
              <div className="space-y-2">
                {pipeline.map((p) => (
                  <div key={p.request_id}
                    className="flex flex-wrap items-start gap-3 p-3 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-950/40">
                      <Zap size={13} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-sm capitalize">{p.pipeline_name} refresh</span>
                        {p.job_run_id && <span className="text-xs text-gray-400">Run #{p.job_run_id}</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <p className="text-xs text-gray-400">{fmt(p.requested_at)}</p>
                      <StatusSelect
                        id={p.request_id}
                        table="pipeline_requests"
                        current={p.status}
                        options={PIPELINE_STATUSES}
                        onComplete={() => setPipeline((prev) => prev.filter((x) => x.request_id !== p.request_id))}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </Section>
          )}
        </div>
      )}
    </div>
  );
}

function Section({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 border-b border-gray-200 dark:border-gray-800 pb-2">
        {icon}
        <h2 className="text-sm font-semibold">{title}</h2>
      </div>
      {children}
    </div>
  );
}

function EmptyActions() {
  return (
    <div className="text-center py-16 space-y-3">
      <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center mx-auto">
        <Zap size={22} className="text-white" />
      </div>
      <p className="font-semibold text-gray-700 dark:text-gray-300">No open actions</p>
      <p className="text-sm text-gray-500 dark:text-gray-400 max-w-xs mx-auto">
        Moves made by NovaTech AI appear here. Completed actions are hidden.
      </p>
      <a href="/genie"
        className="inline-flex items-center gap-1.5 text-sm text-blue-600 dark:text-blue-400 hover:underline mt-2">
        Open Oracle →
      </a>
    </div>
  );
}
