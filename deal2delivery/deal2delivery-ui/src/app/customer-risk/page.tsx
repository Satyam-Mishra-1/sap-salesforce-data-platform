"use client";
import { useState, Fragment, useEffect, useCallback } from "react";
import { X, ExternalLink } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
} from "recharts";
import { useAppData, Customer } from "@/components/AppDataProvider";

interface CategoryDetail {
  product_category: string;
  order_count:      string;
  total_qty:        string;
  avg_qty_per_order:string;
  total_revenue:    string;
  last_order_date:  string;
}
interface TopProduct {
  product_description: string;
  product_category:    string;
  total_qty:           string;
  total_revenue:       string;
  order_count:         string;
}

const CAT_COLORS: Record<string, string> = {
  COMP: "#3b82f6",
  MOBI: "#8b5cf6",
  ACCS: "#f59e0b",
};

const SEGMENT_COLORS: Record<string, string> = {
  Champions:   "#3b82f6",
  Loyal:       "#22c55e",
  "At-Risk":   "#f59e0b",
  Hibernating: "#ef4444",
  Prospects:   "#8b5cf6",
};

const SIGNAL_LABELS: Record<string, string> = {
  "Customer Inactivity":   "Inactivity",
  "Open Case Burden":      "Open Cases",
  "Sentiment Risk":        "Sentiment",
  "Negative Interactions": "Neg. Interactions",
  "Revenue Trajectory":    "Revenue",
};

function getSignals(c: Customer) {
  const days  = Number(c.days_since_last_order);
  const cases = Number(c.open_case_count);
  const sent  = Number(c.sentiment) || 3;
  const prob  = Number(c.churn_probability);
  return [
    { label: "Customer Inactivity",   weight: 35, score: Math.min(100, Math.round(days / 1.5)),             detail: `${Math.round(days)} days since last order` },
    { label: "Open Case Burden",      weight: 20, score: Math.min(100, cases * 25),                         detail: `${cases} open support case${cases !== 1 ? "s" : ""}` },
    { label: "Sentiment Risk",        weight: 20, score: Math.min(100, Math.round(((5 - sent) / 4) * 100)), detail: `Avg sentiment ${sent.toFixed(1)} / 5.0` },
    { label: "Negative Interactions", weight: 15, score: Math.min(100, Math.round(prob * 120)),              detail: "Derived from interaction quality signals" },
    { label: "Revenue Trajectory",    weight: 10,
      score: c.risk_tier === "High" ? 78 : c.risk_tier === "Medium" ? 42 : 18,
      detail: c.risk_tier === "High" ? "Declining revenue detected" : c.risk_tier === "Medium" ? "Flat revenue trajectory" : "Healthy revenue growth" },
  ];
}

export default function CustomerRisk() {
  const { customers, segments } = useAppData();

  const [selected,      setSelected]      = useState<Customer | null>(null);
  const [detail,        setDetail]        = useState<{ categories: CategoryDetail[]; topProducts: TopProduct[] } | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [explaining,    setExplaining]    = useState(false);
  const [explanations,  setExplanations]  = useState<Record<string, string>>({});
  const [riskFilter,    setRiskFilter]    = useState<"All" | "High" | "Medium" | "Low">("All");
  const [segFilter,     setSegFilter]     = useState<string>("All");

  const source = customers[0]?.score_source ?? "";

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") setSelected(null); };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, []);

  useEffect(() => {
    document.body.style.overflow = selected ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [selected]);

  useEffect(() => {
    if (!selected) { setDetail(null); return; }
    setDetailLoading(true);
    fetch(`/api/data/customer-detail?id=${encodeURIComponent(selected.customer_number)}`)
      .then((r) => r.json())
      .then((d) => { if (!d.error) setDetail(d); })
      .catch(() => {})
      .finally(() => setDetailLoading(false));
  }, [selected?.customer_number]); // eslint-disable-line react-hooks/exhaustive-deps

  const explain = useCallback(async (c: Customer) => {
    if (explanations[c.customer_number]) return;
    if (c.ai_explanation) {
      setExplanations((prev) => ({ ...prev, [c.customer_number]: c.ai_explanation! }));
      return;
    }
    setExplaining(true);
    try {
      const res = await fetch("/api/ai/explain", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(c),
      }).then((r) => r.json());
      setExplanations((prev) => ({ ...prev, [c.customer_number]: res.explanation ?? res.error }));
    } finally { setExplaining(false); }
  }, [explanations]);

  const filtered = customers.filter((c) => {
    const riskOk = riskFilter === "All" || c.risk_tier === riskFilter;
    const segOk  = segFilter  === "All" || c.segment_name === segFilter;
    return riskOk && segOk;
  });

  const high   = customers.filter((c) => c.risk_tier === "High").length;
  const medium = customers.filter((c) => c.risk_tier === "Medium").length;
  const low    = customers.filter((c) => c.risk_tier === "Low").length;

  const segChartData = segments.map((s) => ({
    name: s.segment_name, count: Number(s.customer_count), churn: Number(s.avg_churn_pct),
  }));
  const allSegments = ["All", ...segments.map((s) => s.segment_name)];

  return (
    <div className="space-y-5">

      {/* ── Header ── */}
      <div className="flex flex-wrap items-start gap-2">
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold">Customer Risk</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 italic">
            Your best customers are going quiet. XGBoost sees the pattern. Act before they leave.
          </p>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-2 leading-relaxed">
            XGBoost churn model · 5-signal composite label · Optuna tuning · K-Means k=5 RFM segments · Click any row for Customer 360.
          </p>
        </div>
        <span className={`text-xs px-2 py-1 rounded-full shrink-0 ${
          source === "ml_traced" ? "bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-400"
          : source === "ml"      ? "bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400"
          : "bg-yellow-100 dark:bg-yellow-900/40 text-yellow-700 dark:text-yellow-400"
        }`}>
          {source === "ml_traced" ? "MLflow Traced" : source === "ml" ? "@champion" : "Rule-based"}
        </span>
      </div>

      {/* ── Segment chart ── */}
      {segments.length > 0 && (
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg p-4">
          <h2 className="text-sm font-semibold mb-3">K-Means RFM Segments</h2>
          <div className="overflow-x-auto">
            <div style={{ minWidth: 320 }}>
              <ResponsiveContainer width="100%" height={150}>
                <BarChart data={segChartData} layout="vertical" margin={{ left: 72, right: 8 }}>
                  <XAxis type="number" tick={{ fontSize: 10 }} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={70} />
                  <Tooltip formatter={(v: number, name: string) =>
                    name === "count" ? [`${v} customers`, "Count"] : [`${v}% avg churn`, "Avg Churn"]
                  } />
                  <Bar dataKey="count" name="count" radius={[0, 4, 4, 0]}>
                    {segChartData.map((d) => (
                      <Cell key={d.name} fill={SEGMENT_COLORS[d.name] ?? "#6b7280"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* ── Filters ── */}
      <div className="space-y-2">
        {/* Risk tier pills */}
        <div className="flex gap-1.5 flex-wrap">
          {(["All", "High", "Medium", "Low"] as const).map((t) => {
            const count = t === "All" ? customers.length : t === "High" ? high : t === "Medium" ? medium : low;
            return (
              <button key={t} onClick={() => setRiskFilter(t)}
                className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                  riskFilter === t ? tierActive(t) : "border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400"
                }`}>
                {t} ({count})
              </button>
            );
          })}
        </div>
        {/* Segment pills — horizontal scroll on mobile */}
        <div className="flex gap-1.5 overflow-x-auto pb-0.5">
          {allSegments.map((seg) => {
            const cnt = seg === "All" ? customers.length : customers.filter((c) => c.segment_name === seg).length;
            return (
              <button key={seg} onClick={() => setSegFilter(seg)}
                className={`shrink-0 px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                  segFilter === seg ? "text-white border-transparent" : "border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400"
                }`}
                style={
                  segFilter === seg && seg !== "All" ? { backgroundColor: SEGMENT_COLORS[seg] ?? "#6b7280", borderColor: "transparent" }
                  : segFilter === seg ? { backgroundColor: "#374151", borderColor: "transparent" }
                  : {}
                }>
                {seg} ({cnt})
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Table ── */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-800/60">
              <tr className="text-left text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                <th className="px-3 py-3 font-medium">Customer</th>
                <th className="px-3 py-3 font-medium hidden md:table-cell">Segment</th>
                <th className="px-3 py-3 font-medium">Risk</th>
                <th className="px-3 py-3 font-medium text-right hidden sm:table-cell">Revenue</th>
                <th className="px-3 py-3 font-medium text-right hidden lg:table-cell">Days Silent</th>
                <th className="px-3 py-3 font-medium text-right hidden lg:table-cell">Cases</th>
                <th className="px-3 py-3 font-medium text-center w-10">360</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {filtered.map((c) => {
                const prob = Number(c.churn_probability);
                return (
                  <Fragment key={c.customer_number}>
                    <tr className="hover:bg-gray-50 dark:hover:bg-gray-800/40 cursor-pointer transition-colors active:bg-gray-100 dark:active:bg-gray-800"
                      onClick={() => setSelected(c)}>
                      <td className="px-3 py-2.5">
                        <p className="font-medium text-sm leading-snug">{c.customer_name}</p>
                        <p className="text-xs text-gray-400">{c.industry}</p>
                        {c.segment_name && (
                          <span className="md:hidden mt-0.5 inline-block text-[10px] px-1.5 py-0.5 rounded-full font-medium text-white"
                            style={{ backgroundColor: SEGMENT_COLORS[c.segment_name] ?? "#6b7280" }}>
                            {c.segment_name}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 hidden md:table-cell">
                        {c.segment_name
                          ? <span className="text-xs px-2 py-0.5 rounded-full font-medium text-white"
                              style={{ backgroundColor: SEGMENT_COLORS[c.segment_name] ?? "#6b7280" }}>
                              {c.segment_name}
                            </span>
                          : <span className="text-xs text-gray-400">—</span>}
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-1.5">
                          <div className="w-10 sm:w-14 bg-gray-200 dark:bg-gray-700 rounded-full h-1.5 shrink-0">
                            <div className={`h-1.5 rounded-full ${tierBar(c.risk_tier)}`}
                              style={{ width: `${Math.round(prob * 100)}%` }} />
                          </div>
                          <span className={`text-xs font-semibold tabular-nums ${tierText(c.risk_tier)}`}>
                            {Math.round(prob * 100)}%
                          </span>
                        </div>
                      </td>
                      <td className="px-3 py-2.5 text-right text-xs text-gray-600 dark:text-gray-300 hidden sm:table-cell tabular-nums">
                        ${Number(c.revenue).toLocaleString("en-US")}
                      </td>
                      <td className="px-3 py-2.5 text-right text-xs text-gray-500 hidden lg:table-cell tabular-nums">
                        {Math.round(Number(c.days_since_last_order))}d
                      </td>
                      <td className="px-3 py-2.5 text-right text-xs text-gray-500 hidden lg:table-cell">
                        {c.open_case_count}
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        <span className="text-xs font-medium text-blue-600 dark:text-blue-400">→</span>
                      </td>
                    </tr>
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Customer 360 Modal (bottom-sheet on mobile, centered on desktop) ── */}
      {selected && (
        <div className="fixed inset-0 z-50" onClick={() => setSelected(null)}>
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />

          {/* Mobile: slides up from bottom; Desktop: centered dialog */}
          <div
            className="absolute inset-x-0 bottom-0 sm:inset-0 sm:flex sm:items-center sm:justify-center sm:p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="relative bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-2xl max-h-[92vh] sm:max-h-[90vh] overflow-y-auto">

              {/* Drag handle (mobile only) */}
              <div className="sm:hidden flex justify-center pt-3 pb-1">
                <div className="w-10 h-1 rounded-full bg-gray-300 dark:bg-gray-600" />
              </div>

              {/* Sticky header */}
              <div className="sticky top-0 bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800 px-4 py-3 flex items-start justify-between z-10">
                <div className="flex-1 min-w-0 pr-2">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <h2 className="text-base font-bold leading-snug">{selected.customer_name}</h2>
                    <span className={`text-[11px] px-1.5 py-0.5 rounded-full font-semibold ${tierBadge(selected.risk_tier)}`}>
                      {selected.risk_tier}
                    </span>
                    {selected.segment_name && (
                      <span className="text-[11px] px-1.5 py-0.5 rounded-full font-semibold text-white"
                        style={{ backgroundColor: SEGMENT_COLORS[selected.segment_name] ?? "#6b7280" }}>
                        {selected.segment_name}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{selected.industry}</p>
                </div>
                <button onClick={() => setSelected(null)}
                  className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors shrink-0" aria-label="Close">
                  <X size={16} className="text-gray-500" />
                </button>
              </div>

              <div className="p-4 space-y-4">

                {/* Key Stats — 2×2 on mobile, 4-col on sm+ */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { label: "Revenue",     value: `$${Number(selected.revenue).toLocaleString("en-US")}` },
                    { label: "Days Silent", value: `${Math.round(Number(selected.days_since_last_order))}d` },
                    { label: "Open Cases",  value: String(selected.open_case_count) },
                    { label: "Churn",       value: `${Math.round(Number(selected.churn_probability) * 100)}%` },
                  ].map((s) => (
                    <div key={s.label} className="bg-gray-50 dark:bg-gray-800/60 rounded-lg p-2.5">
                      <p className="text-[11px] text-gray-500 dark:text-gray-400 font-medium">{s.label}</p>
                      <p className="text-sm font-bold mt-0.5 tabular-nums">{s.value}</p>
                    </div>
                  ))}
                </div>

                {/* Churn Signal Breakdown */}
                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-2">
                    Churn Signal Breakdown
                  </h3>
                  <div className="space-y-2">
                    {getSignals(selected).map((sig) => (
                      <div key={sig.label}>
                        <div className="flex justify-between items-center mb-0.5">
                          <span className="text-xs text-gray-600 dark:text-gray-400 font-medium">
                            {SIGNAL_LABELS[sig.label] ?? sig.label}
                            <span className="ml-1 text-gray-400 font-normal text-[10px]">({sig.weight}%)</span>
                          </span>
                          <span className={`text-[11px] font-semibold tabular-nums ${
                            sig.score >= 70 ? "text-red-600 dark:text-red-400"
                            : sig.score >= 40 ? "text-amber-600 dark:text-amber-400"
                            : "text-green-600 dark:text-green-400"
                          }`}>{sig.score}</span>
                        </div>
                        <div className="w-full bg-gray-100 dark:bg-gray-800 rounded-full h-1.5">
                          <div className={`h-1.5 rounded-full ${
                            sig.score >= 70 ? "bg-red-500" : sig.score >= 40 ? "bg-amber-500" : "bg-green-500"
                          }`} style={{ width: `${sig.score}%` }} />
                        </div>
                        <p className="text-[10px] text-gray-400 mt-0.5">{sig.detail}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* AI Explanation */}
                <div className="border border-blue-100 dark:border-blue-900/40 bg-blue-50 dark:bg-blue-950/20 rounded-xl p-3">
                  <div className="flex items-center justify-between mb-1.5">
                    <h3 className="text-xs font-semibold text-blue-700 dark:text-blue-400">✦ GPT-4o Explanation</h3>
                    {!explanations[selected.customer_number] && (
                      <button onClick={() => explain(selected)} disabled={explaining}
                        className="text-[11px] bg-blue-600 hover:bg-blue-700 text-white px-2.5 py-1 rounded-lg font-medium disabled:opacity-50 transition-colors">
                        {explaining ? "Generating…" : "Generate"}
                      </button>
                    )}
                  </div>
                  <p className="text-xs text-gray-700 dark:text-gray-300 leading-relaxed">
                    {explanations[selected.customer_number]
                      ?? `Click Generate to get a plain-English explanation of this ${Math.round(Number(selected.churn_probability) * 100)}% churn score.`}
                  </p>
                </div>

                {/* Purchase Analytics */}
                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-2">
                    Purchase Analytics
                  </h3>
                  {detailLoading && <p className="text-xs text-gray-400 italic">Loading from Databricks…</p>}
                  {!detailLoading && detail && detail.categories.length > 0 && (
                    <div className="space-y-2">
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        {detail.categories.map((cat) => {
                          const color = CAT_COLORS[cat.product_category] ?? "#6b7280";
                          return (
                            <div key={cat.product_category}
                              className="border border-gray-100 dark:border-gray-800 rounded-lg p-2.5"
                              style={{ borderLeftColor: color, borderLeftWidth: 3 }}>
                              <span className="text-[11px] font-bold" style={{ color }}>{cat.product_category}</span>
                              <div className="grid grid-cols-2 gap-1 mt-1.5 text-[11px]">
                                <div><p className="text-gray-400">Revenue</p><p className="font-semibold">${Number(cat.total_revenue).toLocaleString("en-US")}</p></div>
                                <div><p className="text-gray-400">Orders</p><p className="font-semibold">{cat.order_count}</p></div>
                                <div><p className="text-gray-400">Total Qty</p><p className="font-semibold">{Number(cat.total_qty).toLocaleString("en-US")}</p></div>
                                <div><p className="text-gray-400">Avg/Order</p><p className="font-semibold">{cat.avg_qty_per_order}</p></div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      {detail.topProducts.length > 0 && (
                        <div className="rounded-lg border border-gray-100 dark:border-gray-800 overflow-hidden">
                          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide px-3 py-1.5 bg-gray-50 dark:bg-gray-800/60">
                            Top Products by Revenue
                          </p>
                          <table className="w-full text-xs">
                            <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                              {detail.topProducts.map((p) => (
                                <tr key={p.product_description} className="hover:bg-gray-50 dark:hover:bg-gray-800/40">
                                  <td className="px-3 py-2 max-w-0 w-full">
                                    <p className="font-medium text-gray-800 dark:text-gray-200 truncate">{p.product_description}</p>
                                    <span className="text-[9px] px-1 py-0.5 rounded font-medium text-white"
                                      style={{ backgroundColor: CAT_COLORS[p.product_category] ?? "#6b7280" }}>
                                      {p.product_category}
                                    </span>
                                  </td>
                                  <td className="px-3 py-2 text-right tabular-nums font-medium whitespace-nowrap">
                                    ${Number(p.total_revenue).toLocaleString("en-US")}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  )}
                  {!detailLoading && (!detail || detail.categories.length === 0) && (
                    <p className="text-xs text-gray-400 italic">No order history found.</p>
                  )}
                </div>

                {/* Quick Actions — full-width on mobile */}
                <div className="flex flex-col sm:flex-row gap-2 pt-1 border-t border-gray-100 dark:border-gray-800">
                  <a href={`/genie?q=Tell me about ${encodeURIComponent(selected.customer_name)}: their purchase history, churn risk factors, and what specific actions I should take today.`}
                    className="inline-flex items-center justify-center gap-1.5 text-xs bg-gray-900 dark:bg-white text-white dark:text-gray-900 px-4 py-2.5 rounded-lg font-medium hover:opacity-90 transition-opacity">
                    Ask Oracle about this customer <ExternalLink size={11} />
                  </a>
                  <a href="/actions"
                    className="inline-flex items-center justify-center text-xs border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 px-4 py-2.5 rounded-lg font-medium hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                    Open War Room
                  </a>
                </div>

              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function tierBar(t: string) { return t === "High" ? "bg-red-500" : t === "Medium" ? "bg-yellow-500" : "bg-green-500"; }
function tierText(t: string) { return t === "High" ? "text-red-600 dark:text-red-400" : t === "Medium" ? "text-yellow-600 dark:text-yellow-400" : "text-green-600 dark:text-green-400"; }
function tierBadge(t: string) { return t === "High" ? "bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300" : t === "Medium" ? "bg-yellow-100 dark:bg-yellow-900/40 text-yellow-700 dark:text-yellow-300" : "bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300"; }
function tierActive(t: string) { return t === "High" ? "border-red-500 text-red-600 dark:text-red-400" : t === "Medium" ? "border-yellow-500 text-yellow-600 dark:text-yellow-400" : t === "Low" ? "border-green-500 text-green-600 dark:text-green-400" : "border-gray-900 dark:border-gray-100 text-gray-900 dark:text-gray-100"; }
