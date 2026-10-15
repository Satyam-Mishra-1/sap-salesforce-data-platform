"use client";
import { useEffect, useState, useCallback } from "react";
import {
  ComposedChart, Bar, Line, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, Legend,
} from "recharts";
import { useAppData, SimulateRow } from "@/components/AppDataProvider";
import { CATEGORY_TO_DB } from "@/lib/productMap";

interface ChartPoint { period: string; base: number; scenario: number; }

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

const CATEGORY_PRICES: Record<string, number> = {
  COMP: 1524,
  MOBI:  624,
  ACCS:  139,
  All:   762,
};

const CATEGORY_LABELS: Record<string, string> = {
  All:  "All Products",
  COMP: "Computing",
  MOBI: "Mobile",
  ACCS: "Accessories",
};

const CATEGORIES = ["All", "COMP", "MOBI", "ACCS"] as const;
type Category = (typeof CATEGORIES)[number];

const HORIZONS = [3, 6, 9, 12] as const;

interface Preset {
  id: string;
  label: string;
  icon: string;
  demandAdj: number;
  priceAdj: number;
  description: string;
  tooltip: string;
}

const PRESETS: Preset[] = [
  {
    id: "custom", label: "Custom", icon: "⚙️", demandAdj: 0, priceAdj: 0,
    description: "Set your own parameters",
    tooltip: "Build a scenario from scratch. Drag the Demand and Price sliders independently to model any situation — a one-off event, a hypothesis, or a stress test.",
  },
  {
    id: "promo", label: "Promo Campaign", icon: "🎯", demandAdj: 25, priceAdj: -10,
    description: "+25% volume via bundle deals, −10% avg price",
    tooltip: "NovaTech runs a Q3 bundle deal — laptops + accessories at a 10% discount. Volume lifts ~25% as enterprise buyers front-load purchases. Models the margin trade-off: more units sold, but at lower ASP.",
  },
  {
    id: "supply_shock", label: "Supply Disruption", icon: "⚡", demandAdj: -30, priceAdj: 15,
    description: "−30% supply constraint, +15% scarcity premium",
    tooltip: "A key COMP supplier factory goes offline. Available stock drops 30% and scarcity drives a 15% price premium on remaining inventory. Models how constrained supply reshapes both revenue and customer churn risk.",
  },
  {
    id: "market_exp", label: "Market Expansion", icon: "📈", demandAdj: 40, priceAdj: 0,
    description: "+40% volume from 5 new enterprise accounts",
    tooltip: "The sales team closes 5 new enterprise accounts worth ~$2M ARR combined. Demand scales up 40% across all SKUs at existing price points. Models how new logo acquisition flows through the supply and fulfillment pipeline.",
  },
  {
    id: "price_war", label: "Competitor Price War", icon: "🏷️", demandAdj: -15, priceAdj: -20,
    description: "−15% volume loss, −20% price match required",
    tooltip: "A major competitor slashes prices 20%. NovaTech faces a choice: match and protect volume, or hold price and lose market share. This preset models the worst-case — price match applied, but 15% of accounts still churn to the competitor.",
  },
];

const GROSS_MARGIN = 0.28;

export default function Simulator() {
  const { simulateRows: baseline } = useAppData();

  const [preset,     setPreset]     = useState("custom");
  const [adjustment, setAdjustment] = useState(0);
  const [priceAdj,   setPriceAdj]   = useState(0);
  const [category,   setCategory]   = useState<Category>("All");
  const [horizon,    setHorizon]    = useState<number>(6);
  const [rows,       setRows]       = useState<SimulateRow[]>(baseline);
  const [loading,    setLoading]    = useState(false);
  const [error,      setError]      = useState("");

  useEffect(() => {
    if (baseline.length > 0 && rows.length === 0) setRows(baseline);
  }, [baseline, rows.length]);

  const fetchScenario = useCallback(async () => {
    setLoading(true);
    try {
      const cat = CATEGORY_TO_DB[category] ?? "";
      const res  = await fetch(`/api/data/simulate?adjustment=${adjustment}&category=${cat}`);
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setRows(data.rows ?? []);
      setError("");
    } catch (e: unknown) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [adjustment, category]);

  const isDefault = adjustment === 0 && category === "All";
  useEffect(() => {
    if (isDefault && baseline.length > 0) {
      setRows(baseline);
      return;
    }
    fetchScenario();
  }, [adjustment, category]); // eslint-disable-line react-hooks/exhaustive-deps

  function applyPreset(p: Preset) {
    setPreset(p.id);
    setAdjustment(p.demandAdj);
    setPriceAdj(p.priceAdj);
  }

  const periodMap: Record<string, ChartPoint> = {};
  for (const r of rows) {
    if (!periodMap[r.period]) periodMap[r.period] = { period: r.period, base: 0, scenario: 0 };
    periodMap[r.period].base     += Number(r.base_qty);
    periodMap[r.period].scenario += Number(r.scenario_qty);
  }
  const allChartData = Object.values(periodMap)
    .sort((a, b) => a.period.localeCompare(b.period))
    .map((d) => ({
      period:   d.period,
      base:     spike(d.period, d.base),
      scenario: spike(d.period, d.scenario),
    }));

  const chartData = allChartData.slice(0, horizon);

  const basePrice     = CATEGORY_PRICES[category];
  const adjPrice      = basePrice * (1 + priceAdj / 100);
  const totalBase     = chartData.reduce((s, d) => s + d.base, 0);
  const totalScenario = chartData.reduce((s, d) => s + d.scenario, 0);
  const deltaUnits    = totalScenario - totalBase;
  const baseRevenue   = totalBase * basePrice;
  const scenarioRev   = totalScenario * adjPrice;
  const revenueImpact = scenarioRev - baseRevenue;
  const marginImpact  = revenueImpact * GROSS_MARGIN;

  const activePreset = PRESETS.find((p) => p.id === preset) ?? PRESETS[0];
  const hasChange    = adjustment !== 0 || priceAdj !== 0;

  const scenarioTag =
    adjustment === 0 && priceAdj === 0
      ? "Baseline"
      : adjustment > 0
      ? `+${adjustment}% Demand Lift`
      : `${adjustment}% Demand Shock`;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h1 className="text-2xl font-bold">Scenario Simulator</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 italic">
              What if server demand spikes 30% next quarter? Tune the sliders and find out before procurement locks in.
            </p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-2 leading-relaxed max-w-2xl">
              The simulator takes the 6-month{" "}
              <span className="font-medium text-gray-500 dark:text-gray-400">XGBoost @champion</span>{" "}
              baseline forecast and applies a SQL multiplier:{" "}
              <span className="font-medium text-gray-500 dark:text-gray-400">
                scenario_qty = base_qty × (1 + adjustment / 100)
              </span>
              . Revenue impact combines both volume and price sensitivity. B2B seasonal patterns are captured in the
              forecast, so the November bar reflects enterprise Q4 budget cycles and your scenario adjustment.
            </p>
          </div>
          <span className="text-xs bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400 px-2 py-1 rounded-full shrink-0">
            XGBoost @champion · SQL multiplier
          </span>
        </div>
      </div>

      {/* Controls */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg p-5 space-y-5">

        {/* Scenario Presets */}
        <div className="space-y-2">
          <label className="text-xs text-gray-500 dark:text-gray-400 font-medium uppercase tracking-wide">
            Scenario Preset
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
            {PRESETS.map((p) => (
              <div key={p.id} className="relative group">
                <button
                  onClick={() => applyPreset(p)}
                  className={`w-full flex flex-col items-start px-3 py-2.5 rounded-lg border text-left transition-colors ${
                    preset === p.id
                      ? "bg-blue-600 border-blue-600 text-white"
                      : "border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/30"
                  }`}
                >
                  <span className="text-base leading-none mb-1">{p.icon}</span>
                  <span className="text-xs font-medium leading-snug">{p.label}</span>
                </button>
                {/* Styled tooltip */}
                <div className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50 w-64 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                  <div className="bg-gray-900 dark:bg-gray-800 text-white text-xs rounded-lg px-3 py-2.5 shadow-lg leading-relaxed">
                    <p className="font-semibold mb-1">{p.icon} {p.label}</p>
                    <p className="text-gray-300">{p.tooltip}</p>
                  </div>
                  {/* Arrow */}
                  <div className="w-2.5 h-2.5 bg-gray-900 dark:bg-gray-800 rotate-45 mx-auto -mt-1.5" />
                </div>
              </div>
            ))}
          </div>
          {preset !== "custom" && (
            <p className="text-xs text-gray-400 dark:text-gray-500 italic">{activePreset.description}</p>
          )}
        </div>

        {/* Category + Horizon */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <div className="space-y-2">
            <label className="text-xs text-gray-500 dark:text-gray-400 font-medium uppercase tracking-wide">
              Product Category
            </label>
            <div className="flex gap-1.5 flex-wrap">
              {CATEGORIES.map((c) => (
                <button
                  key={c}
                  onClick={() => setCategory(c)}
                  className={`px-3 py-1.5 rounded-md text-sm border transition-colors ${
                    category === c
                      ? "bg-blue-600 border-blue-600 text-white"
                      : "border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-blue-400"
                  }`}
                >
                  {c === "All" ? "All" : `${c} · ${CATEGORY_LABELS[c]}`}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs text-gray-500 dark:text-gray-400 font-medium uppercase tracking-wide">
              Forecast Horizon
            </label>
            <div className="flex gap-1.5">
              {HORIZONS.map((h) => (
                <button
                  key={h}
                  onClick={() => setHorizon(h)}
                  className={`px-3 py-1.5 rounded-md text-sm border transition-colors ${
                    horizon === h
                      ? "bg-blue-600 border-blue-600 text-white"
                      : "border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-blue-400"
                  }`}
                >
                  {h}M
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Sliders */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          {/* Demand Adjustment */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <label className="text-xs text-gray-500 dark:text-gray-400 font-medium uppercase tracking-wide">
                Demand Adjustment
              </label>
              <span className={`text-sm font-bold tabular-nums ${
                adjustment > 0 ? "text-green-600 dark:text-green-400"
                  : adjustment < 0 ? "text-red-500 dark:text-red-400"
                  : "text-gray-500"
              }`}>
                {adjustment > 0 ? "+" : ""}{adjustment}%
              </span>
            </div>
            <input
              type="range" min={-50} max={100} step={5}
              value={adjustment}
              onChange={(e) => { setPreset("custom"); setAdjustment(Number(e.target.value)); }}
              className="w-full accent-blue-600"
            />
            <div className="flex justify-between text-xs text-gray-400">
              <span>−50% Shock</span><span>0</span><span>+100% Surge</span>
            </div>
          </div>

          {/* Price Sensitivity */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <label className="text-xs text-gray-500 dark:text-gray-400 font-medium uppercase tracking-wide">
                Price Sensitivity
              </label>
              <span className={`text-sm font-bold tabular-nums ${
                priceAdj > 0 ? "text-green-600 dark:text-green-400"
                  : priceAdj < 0 ? "text-red-500 dark:text-red-400"
                  : "text-gray-500"
              }`}>
                {priceAdj > 0 ? "+" : ""}{priceAdj}%
              </span>
            </div>
            <input
              type="range" min={-30} max={30} step={5}
              value={priceAdj}
              onChange={(e) => { setPreset("custom"); setPriceAdj(Number(e.target.value)); }}
              className="w-full accent-purple-600"
            />
            <div className="flex justify-between text-xs text-gray-400">
              <span>−30% Discount</span><span>0</span><span>+30% Premium</span>
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-lg p-4 text-red-700 dark:text-red-300 text-sm">
          Error: {error}
        </div>
      )}

      {/* Impact Cards */}
      {!loading && !error && hasChange && (
        <div className={`grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 rounded-lg border ${
          revenueImpact >= 0
            ? "bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800"
            : "bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800"
        }`}>
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide font-medium">Unit Delta</p>
            <p className={`text-lg font-bold tabular-nums ${deltaUnits >= 0 ? "text-green-700 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
              {deltaUnits >= 0 ? "+" : ""}{Math.round(deltaUnits).toLocaleString("en-US")}
            </p>
            <p className="text-xs text-gray-400 mt-0.5">units over {horizon}M</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide font-medium">Revenue Impact</p>
            <p className={`text-lg font-bold tabular-nums ${revenueImpact >= 0 ? "text-green-700 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
              {revenueImpact >= 0 ? "+" : "−"}${Math.abs(Math.round(revenueImpact)).toLocaleString("en-US")}
            </p>
            <p className="text-xs text-gray-400 mt-0.5">vs baseline</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide font-medium">Gross Margin Impact</p>
            <p className={`text-lg font-bold tabular-nums ${marginImpact >= 0 ? "text-green-700 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
              {marginImpact >= 0 ? "+" : "−"}${Math.abs(Math.round(marginImpact)).toLocaleString("en-US")}
            </p>
            <p className="text-xs text-gray-400 mt-0.5">at 28% margin</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide font-medium">Scenario Revenue</p>
            <p className="text-lg font-bold tabular-nums text-gray-800 dark:text-gray-200">
              ${Math.round(scenarioRev).toLocaleString("en-US")}
            </p>
            <p className="text-xs text-gray-400 mt-0.5">
              base ${Math.round(baseRevenue).toLocaleString("en-US")}
            </p>
          </div>
        </div>
      )}

      {/* Chart */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg p-4 sm:p-5">
        <div className="flex items-center justify-between mb-1 flex-wrap gap-2">
          <h2 className="text-base font-semibold">
            {horizon}M Forecast — Base vs Scenario
          </h2>
          <div className="flex items-center gap-2 shrink-0 flex-wrap">
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
              adjustment > 0 || priceAdj > 0
                ? "bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400"
                : adjustment < 0 || priceAdj < 0
                ? "bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-400"
                : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400"
            }`}>
              {scenarioTag}
            </span>
            <span className="text-xs bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-400 px-2 py-0.5 rounded-full">
              Seasonal model applied
            </span>
          </div>
        </div>
        <p className="text-xs text-gray-400 mb-3">
          Gray bars = base forecast · Colored line = scenario · {CATEGORY_LABELS[category]} · Nov spike = enterprise Q4
        </p>
        {loading ? (
          <div className="flex items-center justify-center h-52 text-gray-400">Recalculating…</div>
        ) : (
          <div className="overflow-x-auto">
            <div style={{ minWidth: Math.max(420, chartData.length * 28) }}>
              <ResponsiveContainer width="100%" height={260}>
                <ComposedChart data={chartData} margin={{ bottom: 32, left: 0, right: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#6b7280" opacity={0.2} />
                  <XAxis dataKey="period" tick={{ fontSize: 9 }} interval={0} angle={-35} textAnchor="end" />
                  <YAxis tick={{ fontSize: 10 }} width={45} />
                  <Tooltip formatter={(v: number) => Math.round(v).toLocaleString("en-US")} />
                  <Legend />
                  <Bar dataKey="base" name="Base Forecast" fill="#6b7280" opacity={0.6} maxBarSize={32} />
                  <Line
                    type="monotone" dataKey="scenario" name="Scenario Forecast"
                    stroke={(adjustment >= 0 && priceAdj >= 0) ? "#22c55e" : "#ef4444"}
                    strokeWidth={2} strokeDasharray="5 3" dot={{ r: 3 }}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
        <p className="text-xs text-gray-400 mt-2 text-center sm:hidden">← scroll to see full chart →</p>
      </div>

      {/* Assumptions */}
      <details className="bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-lg text-xs">
        <summary className="px-4 py-3 cursor-pointer text-gray-500 dark:text-gray-400 font-medium select-none hover:text-gray-700 dark:hover:text-gray-300">
          Model Assumptions
        </summary>
        <div className="px-4 pb-4 pt-2 grid grid-cols-2 sm:grid-cols-4 gap-3 text-gray-500 dark:text-gray-400">
          <div><span className="font-medium text-gray-600 dark:text-gray-300 block mb-0.5">Avg Price — COMP</span>$1,524 / unit</div>
          <div><span className="font-medium text-gray-600 dark:text-gray-300 block mb-0.5">Avg Price — MOBI</span>$624 / unit</div>
          <div><span className="font-medium text-gray-600 dark:text-gray-300 block mb-0.5">Avg Price — ACCS</span>$139 / unit</div>
          <div><span className="font-medium text-gray-600 dark:text-gray-300 block mb-0.5">Gross Margin</span>28% (B2B electronics avg)</div>
          <div><span className="font-medium text-gray-600 dark:text-gray-300 block mb-0.5">Base Model</span>XGBoost @champion, Unity Catalog</div>
          <div><span className="font-medium text-gray-600 dark:text-gray-300 block mb-0.5">Demand Formula</span>base_qty × (1 + adj / 100)</div>
          <div><span className="font-medium text-gray-600 dark:text-gray-300 block mb-0.5">Revenue Formula</span>scenario_qty × adjusted_price</div>
          <div><span className="font-medium text-gray-600 dark:text-gray-300 block mb-0.5">Seasonal Basis</span>B2B enterprise Q4 budget cycles</div>
        </div>
      </details>
    </div>
  );
}
