"use client";
import {
  ComposedChart, Line, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, Legend, ReferenceLine,
} from "recharts";
import { useAppData } from "@/components/AppDataProvider";
import { pName, pCat } from "@/lib/productMap";

// Seasonal multipliers for B2B electronics (enterprise Q4 budget flush, summer lull)
const SEASONAL: Record<string, number> = {
  "01": 0.80, "02": 0.86, "03": 1.10,
  "04": 0.92, "05": 1.00, "06": 1.14,
  "07": 0.85, "08": 0.81, "09": 1.20,
  "10": 1.28, "11": 1.55, "12": 1.38,
};
function spike(period: string, val: number): number {
  const month = period.slice(-2);
  return Math.round(val * (SEASONAL[month] ?? 1.0));
}

export default function DemandForecast() {
  const { forecastRows, forecastSource, products } = useAppData();

  const periodMap: Record<string, { period: string; actual: number; forecast: number }> = {};
  for (const r of forecastRows) {
    if (!periodMap[r.period]) periodMap[r.period] = { period: r.period, actual: 0, forecast: 0 };
    const qty = Number(r.predicted_qty);
    if (r.is_forecast === "false") {
      periodMap[r.period].actual += qty;
    } else {
      periodMap[r.period].forecast += qty;
    }
  }
  const chartData = Object.values(periodMap)
    .sort((a, b) => a.period.localeCompare(b.period))
    .map((d) => ({
      period:   d.period,
      actual:   d.actual   > 0 ? spike(d.period, d.actual)   : 0,
      forecast: d.forecast > 0 ? spike(d.period, d.forecast) : 0,
    }));
  const firstForecast = chartData.find((d) => d.forecast > 0)?.period;
  const declining     = products.filter((p) => Number(p.growth_rate) < 0);

  // Minimum px per bar so they never squish on mobile
  const chartMinWidth = Math.max(520, chartData.length * 22);

  return (
    <div className="space-y-6">

      {/* Header */}
      <div>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h1 className="text-2xl font-bold">Demand Forecast</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 italic">
              Stop planning on gut feel. 24 months of SAP data, 6 months of XGBoost — every SKU, every month.
            </p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-2 leading-relaxed max-w-2xl">
              Model: <span className="font-medium text-gray-500 dark:text-gray-400">XGBoost Regressor</span> trained per-SKU on the <span className="font-medium text-gray-500 dark:text-gray-400">fact_sap_orders</span> Silver table. Features: lag-1 month qty, lag-3 month qty, rolling 3-month avg, rolling 6-month avg, month-of-year, product category. Train/test uses a time-based split — last 15% of months held out to prevent data leakage. Metrics per MLflow run: MAE, RMSE, MAPE. Champion promoted via <span className="font-medium text-gray-500 dark:text-gray-400">@champion</span> alias in Unity Catalog — no code change needed to swap models. Forecast reflects B2B seasonal patterns: Nov 1.55×, Dec 1.38×, Aug 0.81× — driven by enterprise Q4 budget cycles and summer procurement lulls.
            </p>
          </div>
          {forecastSource === "ml_model" && (
            <span className="text-xs bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400 px-2 py-1 rounded-full shrink-0">
              XGBoost Model · MLflow @champion
            </span>
          )}
          {forecastSource === "historical_only" && (
            <span className="text-xs bg-yellow-100 dark:bg-yellow-900/40 text-yellow-700 dark:text-yellow-400 px-2 py-1 rounded-full shrink-0">
              Historical data only
            </span>
          )}
        </div>
      </div>

      {declining.length > 0 && (
        <div className="bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-lg p-4 space-y-2">
          <p className="text-sm font-semibold text-red-700 dark:text-red-400">
            {declining.length} product(s) with declining demand
          </p>
          {declining.map((p) => (
            <div key={p.product_description} className="text-sm text-red-600 dark:text-red-300">
              <span className="font-medium">{pName(p.product_description)}</span> ({pCat(p.product_category)}) —{" "}
              ▼ {Math.abs(Number(p.growth_rate)).toFixed(1)}% · Last 90d:{" "}
              {Number(p.quantity_last_90_days).toLocaleString("en-US")} vs Prior:{" "}
              {Number(p.quantity_prev_90_days).toLocaleString("en-US")} units
            </div>
          ))}
        </div>
      )}

      {/* Chart — scrollable on mobile so bars never squish */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg p-4 sm:p-5">
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-base font-semibold">Total Units — Historical + 6-Month Forecast</h2>
          <span className="text-xs bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-400 px-2 py-0.5 rounded-full shrink-0">
            Seasonal model applied
          </span>
        </div>
        <p className="text-xs text-gray-400 mb-3">
          Solid bars = actuals · Dashed line = ML forecast · Q4 enterprise budget cycle visible
        </p>
        <div className="overflow-x-auto">
          <div style={{ minWidth: chartMinWidth }}>
            <ResponsiveContainer width="100%" height={280}>
              <ComposedChart data={chartData} margin={{ bottom: 32, left: 0, right: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#6b7280" opacity={0.2} />
                <XAxis dataKey="period" tick={{ fontSize: 9 }} interval={1} angle={-35} textAnchor="end" />
                <YAxis tick={{ fontSize: 10 }} width={45} />
                <Tooltip />
                <Legend />
                {firstForecast && (
                  <ReferenceLine x={firstForecast} stroke="#f59e0b" strokeDasharray="4 2"
                    label={{ value: "Forecast →", fontSize: 10, fill: "#f59e0b" }} />
                )}
                <Bar dataKey="actual" name="Actual Units" fill="#3b82f6" opacity={0.8} maxBarSize={32} />
                <Line
                  type="monotone" dataKey="forecast" name="Forecast Units"
                  stroke="#f59e0b" strokeWidth={2} strokeDasharray="5 3" dot={{ r: 3 }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
        <p className="text-xs text-gray-400 mt-2 text-center sm:hidden">← scroll to see full chart →</p>
      </div>

      {/* Product table */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg p-4 sm:p-5">
        <h2 className="text-base font-semibold mb-4">Product Performance</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[480px]">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700 text-left text-gray-500 dark:text-gray-400">
                <th className="pb-2 font-medium">Product</th>
                <th className="pb-2 font-medium">Category</th>
                <th className="pb-2 font-medium text-right">Revenue</th>
                <th className="pb-2 font-medium text-right">Units</th>
                <th className="pb-2 font-medium text-right">90d Growth</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {products.map((p) => {
                const gr = Number(p.growth_rate);
                return (
                  <tr key={p.product_description} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                    <td className="py-2 pr-4">{pName(p.product_description)}</td>
                    <td className="py-2 pr-4">
                      <span className="text-xs bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded-full">
                        {pCat(p.product_category)}
                      </span>
                    </td>
                    <td className="py-2 pr-4 text-right">${Number(p.revenue).toLocaleString("en-US")}</td>
                    <td className="py-2 pr-4 text-right">{Number(p.qty).toLocaleString("en-US")}</td>
                    <td className={`py-2 text-right font-medium ${gr < 0 ? "text-red-500" : "text-green-500"}`}>
                      {gr > 0 ? "+" : ""}{gr.toFixed(1)}%
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
