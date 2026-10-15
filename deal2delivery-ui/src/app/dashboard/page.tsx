"use client";
import { useEffect, useState } from "react";
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend,
} from "recharts";
import { KPICard } from "@/components/KPICard";
import { InsightCard } from "@/components/InsightCard";
import { useAppData, InventoryRow } from "@/components/AppDataProvider";
import { pCat, pName } from "@/lib/productMap";

const CAT_COLORS: Record<string, string> = {
  COMP: "#3b82f6",
  MOBI: "#8b5cf6",
  ACCS: "#f59e0b",
};
const RISK_COLORS: Record<string, string> = {
  High:   "#ef4444",
  Medium: "#f59e0b",
  Low:    "#10b981",
};

export default function Dashboard() {
  const { kpis, trends, products, customers, inventory } = useAppData();
  const [insights, setInsights] = useState("");

  useEffect(() => {
    if (!kpis) return;
    fetch("/api/ai/insights", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kpis, trend_months: trends.length }),
    })
      .then((r) => r.json())
      .then((d) => d.insights && setInsights(d.insights))
      .catch(() => {});
  }, [kpis, trends]);

  if (!kpis) return <Err msg="KPI data unavailable" />;

  const total  = Number(kpis.total_customers ?? 0);
  const atRisk = Number(kpis.at_risk_rule_based ?? 0);

  const chartData = trends.map((r) => ({
    period:  r.period,
    revenue: Number(r.revenue),
    qty:     Number(r.qty),
  }));

  // Revenue by category — group products
  const catMap: Record<string, number> = {};
  for (const p of products) {
    const cat = pCat(p.product_category);
    catMap[cat] = (catMap[cat] ?? 0) + Number(p.revenue);
  }
  const catData = Object.entries(catMap).map(([name, revenue]) => ({ name, revenue }));

  // Customer health distribution
  const riskMap: Record<string, number> = {};
  for (const c of customers) {
    const tier = c.risk_tier ?? "Low";
    riskMap[tier] = (riskMap[tier] ?? 0) + 1;
  }
  const riskData = Object.entries(riskMap).map(([name, value]) => ({ name, value }));

  // Top 5 at-risk customers
  const topRisk = [...customers]
    .sort((a, b) => Number(b.churn_probability) - Number(a.churn_probability))
    .slice(0, 5);

  // Daily briefing data
  const topAtRisk    = topRisk[0];
  const criticalSku  = inventory?.rows.find((r) => r.gap_risk_level === "Critical");
  const highRiskCount   = customers.filter((c) => c.risk_tier === "High").length;
  const highRiskRevenue = customers
    .filter((c) => c.risk_tier === "High")
    .reduce((s, c) => s + Number(c.revenue), 0);
  const today = new Date().toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Dashboard</h1>
      <p className="text-sm text-gray-500 dark:text-gray-400 italic">
        When SAP and Salesforce finally talk to each other, this is what the full picture looks like.
      </p>
      <p className="text-xs text-gray-400 dark:text-gray-500 leading-relaxed">
        KPIs are pulled live from the <span className="font-medium text-gray-500 dark:text-gray-400">metrics_customer_health</span> Gold view in Unity Catalog — a join of SAP order history and Salesforce CRM signals. Revenue trend uses 24 months of <span className="font-medium text-gray-500 dark:text-gray-400">fact_sap_orders</span> from the Silver layer. Customer Health distribution comes from the XGBoost churn model: probability scores are bucketed into High (&gt;60%), Medium (30–60%), and Low (&lt;30%) tiers. The AI Insights strip calls GPT-4o in the background with the live KPI values and returns a 3-sentence executive summary — it fires after page load so it never blocks rendering.
      </p>

      {/* ── Daily Briefing ── */}
      {(topAtRisk || criticalSku || highRiskCount > 0) && (
        <div className="bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/20 dark:to-orange-950/20 border border-amber-200 dark:border-amber-800/60 rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="text-base">📋</span>
              <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-200">Today&apos;s Priority Briefing</h2>
              <span className="inline-flex items-center gap-1 text-xs bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400 px-2 py-0.5 rounded-full font-medium">
                <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                Live
              </span>
            </div>
            <span className="text-xs text-gray-400 dark:text-gray-500">{today}</span>
          </div>
          <div className="space-y-2.5">
            {topAtRisk && (
              <div className="flex items-start gap-2.5">
                <span className="text-base leading-none mt-0.5 shrink-0">🔴</span>
                <p className="text-sm text-gray-700 dark:text-gray-300 leading-snug">
                  <span className="font-semibold">{topAtRisk.customer_name}</span> — {Math.round(Number(topAtRisk.churn_probability) * 100)}% churn probability,{" "}
                  {Math.round(Number(topAtRisk.days_since_last_order))} days silent,{" "}
                  {topAtRisk.open_case_count} open case{Number(topAtRisk.open_case_count) !== 1 ? "s" : ""}. Recommend urgent outreach today.
                </p>
              </div>
            )}
            {criticalSku && (
              <div className="flex items-start gap-2.5">
                <span className="text-base leading-none mt-0.5 shrink-0">🟡</span>
                <p className="text-sm text-gray-700 dark:text-gray-300 leading-snug">
                  <span className="font-semibold">{criticalSku.product_description}</span> — only{" "}
                  {Math.round(Number(criticalSku.coverage_pct))}% of 6-month forecast demand covered by current SAP stock. Critical reorder required.
                </p>
              </div>
            )}
            <div className="flex items-start gap-2.5">
              <span className="text-base leading-none mt-0.5 shrink-0">📊</span>
              <p className="text-sm text-gray-700 dark:text-gray-300 leading-snug">
                <span className="font-semibold">{highRiskCount} of {customers.length} accounts</span> are at High churn risk —{" "}
                <span className="font-semibold">${highRiskRevenue.toLocaleString("en-US")}</span> in revenue exposed this quarter.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ── KPIs ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KPICard title="Total Customers"    value={String(total)} />
        <KPICard title="Total Revenue"      value={`$${Number(kpis.total_revenue).toLocaleString("en-US")}`} />
        <KPICard
          title="At-Risk Customers"
          value={String(atRisk)}
          sub={`${total ? Math.round((atRisk / total) * 100) : 0}% of customer base`}
          danger
        />
        <KPICard
          title="Avg Revenue / Customer"
          value={`$${Number(kpis.avg_revenue_per_customer).toLocaleString("en-US")}`}
        />
      </div>

      {insights && <InsightCard text={insights} />}

      {/* ── Revenue Trend + Category breakdown ── */}
      <div className="grid md:grid-cols-2 gap-4">
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg p-5">
          <h2 className="text-base font-semibold mb-1">Monthly Revenue Trend</h2>
          <p className="text-xs text-gray-400 mb-3">SAP orders aggregated by month</p>
          <div className="overflow-x-auto">
            <div style={{ minWidth: Math.max(420, chartData.length * 22) }}>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={chartData} margin={{ bottom: 32, left: 0, right: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#6b7280" opacity={0.2} />
                  <XAxis dataKey="period" tick={{ fontSize: 9 }} interval={1} angle={-35} textAnchor="end" />
                  <YAxis tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 10 }} width={40} />
                  <Tooltip formatter={(v: number) => [`$${v.toLocaleString("en-US")}`, "Revenue"]} />
                  <Line type="monotone" dataKey="revenue" stroke="#3b82f6" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
          <p className="text-xs text-gray-400 mt-1 text-center sm:hidden">← scroll →</p>
        </div>

        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg p-5">
          <h2 className="text-base font-semibold mb-1">Revenue by Category</h2>
          <p className="text-xs text-gray-400 mb-4">COMP · MOBI · ACCS product mix</p>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={catData} layout="vertical" margin={{ left: 8, right: 16 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#6b7280" opacity={0.2} horizontal={false} />
              <XAxis type="number" tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 10 }} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 12, fontWeight: 600 }} width={44} />
              <Tooltip formatter={(v: number) => [`$${v.toLocaleString("en-US")}`, "Revenue"]} />
              <Bar dataKey="revenue" radius={[0, 4, 4, 0]} maxBarSize={32}>
                {catData.map((entry) => (
                  <Cell key={entry.name} fill={CAT_COLORS[entry.name] ?? "#6b7280"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ── Units trend + Customer health ── */}
      <div className="grid md:grid-cols-2 gap-4">
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg p-5">
          <h2 className="text-base font-semibold mb-1">Monthly Units Ordered</h2>
          <p className="text-xs text-gray-400 mb-3">Quantity shipped across all SKUs</p>
          <div className="overflow-x-auto">
            <div style={{ minWidth: Math.max(420, chartData.length * 22) }}>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={chartData} margin={{ bottom: 32, left: 0, right: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#6b7280" opacity={0.2} />
                  <XAxis dataKey="period" tick={{ fontSize: 9 }} interval={1} angle={-35} textAnchor="end" />
                  <YAxis tick={{ fontSize: 10 }} width={35} />
                  <Tooltip formatter={(v: number) => [v.toLocaleString("en-US"), "Units"]} />
                  <Line type="monotone" dataKey="qty" stroke="#10b981" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
          <p className="text-xs text-gray-400 mt-1 text-center sm:hidden">← scroll →</p>
        </div>

        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg p-5">
          <h2 className="text-base font-semibold mb-1">Customer Health Overview</h2>
          <p className="text-xs text-gray-400 mb-4">XGBoost churn risk across all accounts</p>
          <div className="flex items-center gap-4">
            <ResponsiveContainer width="60%" height={180}>
              <PieChart>
                <Pie
                  data={riskData}
                  cx="50%" cy="50%"
                  innerRadius={50} outerRadius={75}
                  paddingAngle={3}
                  dataKey="value"
                >
                  {riskData.map((entry) => (
                    <Cell key={entry.name} fill={RISK_COLORS[entry.name] ?? "#6b7280"} />
                  ))}
                </Pie>
                <Tooltip formatter={(v: number, name: string) => [v, `${name} risk`]} />
              </PieChart>
            </ResponsiveContainer>
            <div className="space-y-2.5 flex-1">
              {riskData.map((d) => (
                <div key={d.name} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: RISK_COLORS[d.name] ?? "#6b7280" }} />
                    <span className="text-gray-600 dark:text-gray-400">{d.name}</span>
                  </div>
                  <span className="font-semibold tabular-nums">{d.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Inventory Health ── */}
      {inventory && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold">Inventory Health</h2>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5 leading-relaxed max-w-2xl">
                Stock gap = 6-month ML forecast demand minus current{" "}
                <span className="font-medium text-gray-500 dark:text-gray-400">SAP MARD</span> on-hand stock.{" "}
                <span className="font-medium text-red-500">Critical</span> = stock covers &lt;80% of forecast,{" "}
                <span className="font-medium text-amber-500">Warning</span> = 80–120%,{" "}
                <span className="font-medium text-green-600">OK</span> = above 120%.{" "}
                Source: <span className="font-medium text-gray-500 dark:text-gray-400">gold_demand_vs_supply_gap</span> Gold view — joins{" "}
                <span className="font-medium text-gray-500 dark:text-gray-400">demand_forecast_predictions</span> and{" "}
                <span className="font-medium text-gray-500 dark:text-gray-400">bronze_sap_mard_stock</span>.
              </p>
            </div>
            <span className="text-xs bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-400 px-2 py-1 rounded-full shrink-0">
              SAP MARD · Delta Bronze · 6M Forecast
            </span>
          </div>

          {/* Alert strip */}
          <div className="flex gap-3">
            {inventory.critical_count > 0 && (
              <div className="flex-1 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-lg p-4">
                <p className="text-sm font-semibold text-red-700 dark:text-red-400">
                  {inventory.critical_count} SKU{inventory.critical_count > 1 ? "s" : ""} Critical
                </p>
                <p className="text-xs text-red-600 dark:text-red-300 mt-1">
                  Stock covers &lt;25% of 6-month forecast demand
                </p>
              </div>
            )}
            {inventory.warning_count > 0 && (
              <div className="flex-1 bg-yellow-50 dark:bg-yellow-950/40 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
                <p className="text-sm font-semibold text-yellow-700 dark:text-yellow-400">
                  {inventory.warning_count} SKU{inventory.warning_count > 1 ? "s" : ""} Warning
                </p>
                <p className="text-xs text-yellow-600 dark:text-yellow-300 mt-1">
                  Stock covers 25–50% of 6-month forecast demand
                </p>
              </div>
            )}
            {(() => {
              const ok = inventory.rows.filter((r) => r.gap_risk_level === "OK").length;
              return ok > 0 ? (
                <div className="flex-1 bg-green-50 dark:bg-green-950/40 border border-green-200 dark:border-green-800 rounded-lg p-4">
                  <p className="text-sm font-semibold text-green-700 dark:text-green-400">{ok} SKU{ok > 1 ? "s" : ""} OK</p>
                  <p className="text-xs text-green-600 dark:text-green-300 mt-1">Stock exceeds 120% of forecast demand</p>
                </div>
              ) : null;
            })()}
            {inventory.critical_count === 0 && inventory.warning_count === 0 && (
              <div className="flex-1 bg-green-50 dark:bg-green-950/40 border border-green-200 dark:border-green-800 rounded-lg p-4">
                <p className="text-sm font-semibold text-green-700 dark:text-green-400">All SKUs adequately stocked</p>
              </div>
            )}
          </div>

          {/* Forecast vs Stock bar chart — top 8 by gap */}
          {(() => {
            const chartRows = [...inventory.rows]
              .sort((a, b) => Number(b.stock_gap) - Number(a.stock_gap))
              .slice(0, 8);
            const chartData = chartRows.map((r) => ({
              name:     pName(r.product_description, r.material_number).split(" ").slice(0, 3).join(" "),
              forecast: Math.round(Number(r.forecast_qty_6m)),
              stock:    Math.round(Number(r.current_stock)),
              safety:   Math.round(Number(r.safety_stock)),
              risk:     r.gap_risk_level,
            }));
            return (
              <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg p-4 sm:p-5">
                <h3 className="text-base font-semibold mb-1">Forecast Demand vs Current Stock (Top 8 by Gap)</h3>
                <p className="text-xs text-gray-400 mb-3">Blue = 6M ML forecast · Green = current SAP MARD stock</p>
                <div className="overflow-x-auto">
                  <div style={{ minWidth: Math.max(480, chartData.length * 56) }}>
                    <ResponsiveContainer width="100%" height={280}>
                      <BarChart data={chartData} margin={{ bottom: 48, left: 0, right: 8 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#6b7280" opacity={0.2} />
                        <XAxis dataKey="name" tick={{ fontSize: 9 }} interval={0} angle={-35} textAnchor="end" />
                        <YAxis tick={{ fontSize: 10 }} width={45} />
                        <Tooltip formatter={(v: number) => Math.round(v).toLocaleString("en-US")} />
                        <Legend verticalAlign="top" />
                        <Bar dataKey="forecast" name="6M Forecast"   fill="#3b82f6" opacity={0.7} maxBarSize={28} />
                        <Bar dataKey="stock"    name="Current Stock" fill="#22c55e"               maxBarSize={28} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
                <p className="text-xs text-gray-400 mt-1 text-center sm:hidden">← scroll to see all products →</p>
              </div>
            );
          })()}

          {/* Full SKU table */}
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 dark:bg-gray-800/60">
                  <tr className="text-left text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                    <th className="px-3 sm:px-4 py-3 font-medium">Product</th>
                    <th className="px-3 sm:px-4 py-3 font-medium hidden sm:table-cell">Category</th>
                    <th className="px-3 sm:px-4 py-3 font-medium text-right hidden sm:table-cell">6M Forecast</th>
                    <th className="px-3 sm:px-4 py-3 font-medium text-right hidden sm:table-cell">Stock</th>
                    <th className="px-3 sm:px-4 py-3 font-medium text-right hidden md:table-cell">Safety Stock</th>
                    <th className="px-3 sm:px-4 py-3 font-medium text-right hidden md:table-cell">Reorder Point</th>
                    <th className="px-3 sm:px-4 py-3 font-medium text-right">Coverage</th>
                    <th className="px-3 sm:px-4 py-3 font-medium text-right hidden xs:table-cell">Gap</th>
                    <th className="px-3 sm:px-4 py-3 font-medium">Risk</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {inventory.rows.map((r: InventoryRow) => {
                    const gap = Number(r.stock_gap);
                    const cov = Number(r.coverage_pct);
                    return (
                      <tr key={r.material_number} className="hover:bg-gray-50 dark:hover:bg-gray-800/40">
                        <td className="px-3 sm:px-4 py-3 font-medium text-sm">
                          {pName(r.product_description, r.material_number)}
                        </td>
                        <td className="px-3 sm:px-4 py-3 hidden sm:table-cell">
                          <span className="text-xs bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded-full">
                            {pCat(r.product_category)}
                          </span>
                        </td>
                        <td className="px-3 sm:px-4 py-3 text-right tabular-nums hidden sm:table-cell">
                          {Math.round(Number(r.forecast_qty_6m)).toLocaleString("en-US")}
                        </td>
                        <td className="px-3 sm:px-4 py-3 text-right tabular-nums hidden sm:table-cell">
                          {Math.round(Number(r.current_stock)).toLocaleString("en-US")}
                        </td>
                        <td className="px-3 sm:px-4 py-3 text-right tabular-nums text-gray-500 hidden md:table-cell">
                          {Math.round(Number(r.safety_stock)).toLocaleString("en-US")}
                        </td>
                        <td className="px-3 sm:px-4 py-3 text-right tabular-nums text-gray-500 hidden md:table-cell">
                          {Math.round(Number(r.reorder_point)).toLocaleString("en-US")}
                        </td>
                        <td className="px-3 sm:px-4 py-3 text-right">
                          <span style={{ color: invRiskColor(r.gap_risk_level) }} className="font-medium tabular-nums">
                            {isNaN(cov) ? "—" : `${cov.toFixed(1)}%`}
                          </span>
                        </td>
                        <td className={`px-3 sm:px-4 py-3 text-right font-medium tabular-nums hidden xs:table-cell ${gap > 0 ? "text-red-500" : "text-green-500"}`}>
                          {gap > 0 ? "+" : ""}{Math.round(gap).toLocaleString("en-US")}
                        </td>
                        <td className="px-3 sm:px-4 py-3">
                          <InvRiskBadge level={r.gap_risk_level} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── Top At-Risk Customers ── */}
      {topRisk.length > 0 && (
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg p-5">
          <h2 className="text-base font-semibold mb-1">Top Risk Customers — Immediate Action Required</h2>
          <p className="text-xs text-gray-400 mb-4">Highest churn probability from the XGBoost model · full details on Customer Risk tab</p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 dark:border-gray-800 text-xs text-gray-500 dark:text-gray-400">
                  <th className="text-left pb-2 font-medium">Customer</th>
                  <th className="text-right pb-2 font-medium">Churn Risk</th>
                  <th className="text-right pb-2 font-medium hidden sm:table-cell">Days Silent</th>
                  <th className="text-right pb-2 font-medium hidden md:table-cell">Revenue</th>
                  <th className="text-right pb-2 font-medium hidden sm:table-cell">Tier</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-gray-800/60">
                {topRisk.map((c) => {
                  const pct = Math.round(Number(c.churn_probability) * 100);
                  const tierColor =
                    c.risk_tier === "High"   ? "text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/30" :
                    c.risk_tier === "Medium" ? "text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/30" :
                                               "text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/30";
                  return (
                    <tr key={c.customer_number} className="hover:bg-gray-50 dark:hover:bg-gray-800/40 transition-colors">
                      <td className="py-2.5 font-medium">{c.customer_name}</td>
                      <td className="py-2.5 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <div className="w-16 h-1.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden hidden sm:block">
                            <div
                              className="h-full rounded-full"
                              style={{ width: `${pct}%`, background: pct >= 70 ? "#ef4444" : pct >= 40 ? "#f59e0b" : "#10b981" }}
                            />
                          </div>
                          <span className={`font-semibold tabular-nums ${pct >= 70 ? "text-red-600 dark:text-red-400" : pct >= 40 ? "text-amber-600 dark:text-amber-400" : "text-green-600 dark:text-green-400"}`}>
                            {pct}%
                          </span>
                        </div>
                      </td>
                      <td className="py-2.5 text-right text-gray-500 dark:text-gray-400 hidden sm:table-cell tabular-nums">
                        {Math.round(Number(c.days_since_last_order))}d
                      </td>
                      <td className="py-2.5 text-right text-gray-600 dark:text-gray-300 hidden md:table-cell tabular-nums">
                        ${Number(c.revenue).toLocaleString("en-US")}
                      </td>
                      <td className="py-2.5 text-right hidden sm:table-cell">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${tierColor}`}>
                          {c.risk_tier}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function invRiskColor(level: string) {
  return level === "Critical" ? "#ef4444" : level === "Warning" ? "#f59e0b" : "#22c55e";
}

function InvRiskBadge({ level }: { level: string }) {
  const cls =
    level === "Critical"
      ? "bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300"
      : level === "Warning"
      ? "bg-yellow-100 dark:bg-yellow-900/40 text-yellow-700 dark:text-yellow-300"
      : "bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300";
  return <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${cls}`}>{level}</span>;
}

function Err({ msg }: { msg: string }) {
  return (
    <div className="bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-lg p-4 text-red-700 dark:text-red-300 text-sm">
      Error: {msg}
    </div>
  );
}
