"use client";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, Legend,
} from "recharts";
import { useAppData, InventoryRow } from "@/components/AppDataProvider";
import { pName, pCat } from "@/lib/productMap";

function riskColor(level: string) {
  return level === "Critical" ? "#ef4444" : level === "Warning" ? "#f59e0b" : "#22c55e";
}

function RiskBadge({ level }: { level: string }) {
  const cls =
    level === "Critical"
      ? "bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300"
      : level === "Warning"
      ? "bg-yellow-100 dark:bg-yellow-900/40 text-yellow-700 dark:text-yellow-300"
      : "bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300";
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${cls}`}>
      {level}
    </span>
  );
}

export default function Inventory() {
  const { inventory } = useAppData();

  if (!inventory) return (
    <div className="bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-lg p-4 text-red-700 dark:text-red-300 text-sm">
      Inventory data unavailable
    </div>
  );

  const { rows, critical_count, warning_count } = inventory;

  const chartRows = [...rows]
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
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Inventory Gap</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 italic">
            By the time a stockout shows up in SAP, the deal is already lost. We show it 6 months early.
          </p>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-2 leading-relaxed max-w-2xl">
            Stock gap = 6-month ML forecast demand minus current <span className="font-medium text-gray-500 dark:text-gray-400">SAP MARD</span> on-hand stock. Risk tiers: <span className="font-medium text-red-500">Critical</span> when stock covers less than 80% of forecast, <span className="font-medium text-amber-500">Warning</span> at 80–120%, <span className="font-medium text-green-600">OK</span> above 120%. The forecast comes from the <span className="font-medium text-gray-500 dark:text-gray-400">gold_demand_vs_supply_gap</span> Gold view — a join of <span className="font-medium text-gray-500 dark:text-gray-400">demand_forecast_predictions</span> and <span className="font-medium text-gray-500 dark:text-gray-400">bronze_sap_mard_stock</span>. Reorder actions triggered here flow through the AI agent into the <span className="font-medium text-gray-500 dark:text-gray-400">stock_requests</span> Delta table and appear in the Actions feed.
          </p>
        </div>
        <span className="text-xs bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-400 px-2 py-1 rounded-full shrink-0">
          SAP MARD · Delta Bronze · 6M Forecast
        </span>
      </div>

      <div className="flex gap-3">
        {critical_count > 0 && (
          <div className="flex-1 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-lg p-4">
            <p className="text-sm font-semibold text-red-700 dark:text-red-400">
              {critical_count} SKU{critical_count > 1 ? "s" : ""} Critical
            </p>
            <p className="text-xs text-red-600 dark:text-red-300 mt-1">
              Stock covers &lt;25% of 6-month forecast demand
            </p>
          </div>
        )}
        {warning_count > 0 && (
          <div className="flex-1 bg-yellow-50 dark:bg-yellow-950/40 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
            <p className="text-sm font-semibold text-yellow-700 dark:text-yellow-400">
              {warning_count} SKU{warning_count > 1 ? "s" : ""} Warning
            </p>
            <p className="text-xs text-yellow-600 dark:text-yellow-300 mt-1">
              Stock covers 25–50% of 6-month forecast demand
            </p>
          </div>
        )}
        {critical_count === 0 && warning_count === 0 && (
          <div className="flex-1 bg-green-50 dark:bg-green-950/40 border border-green-200 dark:border-green-800 rounded-lg p-4">
            <p className="text-sm font-semibold text-green-700 dark:text-green-400">All SKUs adequately stocked</p>
          </div>
        )}
      </div>

      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg p-4 sm:p-5">
        <h2 className="text-base font-semibold mb-1">Forecast Demand vs Current Stock (Top 8 by Gap)</h2>
        <p className="text-xs text-gray-400 mb-3">Blue = 6M forecast · Green = current stock</p>
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

      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-800/60">
              <tr className="text-left text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                <th className="px-3 sm:px-4 py-3 font-medium">Product</th>
                <th className="px-3 sm:px-4 py-3 font-medium hidden sm:table-cell">Category</th>
                <th className="px-3 sm:px-4 py-3 font-medium text-right hidden sm:table-cell">6M Forecast</th>
                <th className="px-3 sm:px-4 py-3 font-medium text-right hidden sm:table-cell">Stock</th>
                <th className="px-3 sm:px-4 py-3 font-medium text-right">Coverage</th>
                <th className="px-3 sm:px-4 py-3 font-medium text-right hidden xs:table-cell">Gap</th>
                <th className="px-3 sm:px-4 py-3 font-medium">Risk</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {rows.map((r: InventoryRow) => {
                const gap = Number(r.stock_gap);
                const cov = Number(r.coverage_pct);
                return (
                  <tr key={r.material_number} className="hover:bg-gray-50 dark:hover:bg-gray-800/40">
                    <td className="px-3 sm:px-4 py-3 font-medium text-sm">{pName(r.product_description, r.material_number)}</td>
                    <td className="px-3 sm:px-4 py-3 hidden sm:table-cell">
                      <span className="text-xs bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded-full">
                        {pCat(r.product_category)}
                      </span>
                    </td>
                    <td className="px-3 sm:px-4 py-3 text-right hidden sm:table-cell">{Math.round(Number(r.forecast_qty_6m)).toLocaleString("en-US")}</td>
                    <td className="px-3 sm:px-4 py-3 text-right hidden sm:table-cell">{Math.round(Number(r.current_stock)).toLocaleString("en-US")}</td>
                    <td className="px-3 sm:px-4 py-3 text-right">
                      <span style={{ color: riskColor(r.gap_risk_level) }} className="font-medium">
                        {isNaN(cov) ? "—" : `${cov.toFixed(1)}%`}
                      </span>
                    </td>
                    <td className={`px-3 sm:px-4 py-3 text-right font-medium hidden xs:table-cell ${gap > 0 ? "text-red-500" : "text-green-500"}`}>
                      {gap > 0 ? "+" : ""}{Math.round(gap).toLocaleString("en-US")}
                    </td>
                    <td className="px-3 sm:px-4 py-3">
                      <RiskBadge level={r.gap_risk_level} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
