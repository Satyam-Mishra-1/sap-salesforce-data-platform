"use client";
import { createContext, useContext, useEffect, useState, useRef } from "react";
import {
  SAMPLE_KPIS, SAMPLE_TRENDS, SAMPLE_FORECAST_ROWS, SAMPLE_PRODUCTS,
  SAMPLE_CUSTOMERS, SAMPLE_SEGMENTS, SAMPLE_INVENTORY, SAMPLE_SIMULATE_ROWS,
} from "@/lib/sampleData";

// ── Types mirrored from pages ──────────────────────────────────────────────
export interface ForecastRow {
  period: string; order_year: string; order_month: string;
  product_category: string; predicted_qty: string; is_forecast: string;
}
export interface ProductRow {
  product_description: string; product_category: string;
  revenue: string; qty: string; growth_rate: string;
  quantity_last_90_days: string; quantity_prev_90_days: string;
}
export interface Customer {
  customer_number: string; customer_name: string; industry: string;
  churn_probability: string; risk_tier: string; revenue: string;
  days_since_last_order: string; open_case_count: string;
  sentiment: string; customer_health_status: string;
  score_source: string; segment_name?: string; ai_explanation?: string;
}
export interface SegmentStat {
  segment_name: string; customer_count: string;
  avg_revenue: string; avg_churn_pct: string; avg_days_silent: string;
}
export interface InventoryRow {
  material_number: string; product_description: string; product_category: string;
  forecast_qty_6m: string; current_stock: string; safety_stock: string;
  reorder_point: string; stock_gap: string; coverage_pct: string;
  gap_risk_level: "Critical" | "Warning" | "OK";
}
export interface InventoryResponse {
  rows: InventoryRow[]; critical_count: number; warning_count: number;
}
export interface SimulateRow {
  period: string; order_year: string; order_month: string;
  product_category: string; material_number: string;
  base_qty: string; scenario_qty: string;
}

interface AppData {
  kpis:           Record<string, string> | null;
  trends:         Record<string, string>[];
  forecastRows:   ForecastRow[];
  forecastSource: string;
  products:       ProductRow[];
  customers:      Customer[];
  segments:       SegmentStat[];
  inventory:      InventoryResponse | null;
  simulateRows:   SimulateRow[];
}

interface AppDataContextValue extends AppData {
  ready: boolean;
}

// ── Sample data pre-loaded so pages render immediately ─────────────────────
const INITIAL: AppData = {
  kpis:           SAMPLE_KPIS,
  trends:         SAMPLE_TRENDS,
  forecastRows:   SAMPLE_FORECAST_ROWS,
  forecastSource: "ml_model",
  products:       SAMPLE_PRODUCTS,
  customers:      SAMPLE_CUSTOMERS,
  segments:       SAMPLE_SEGMENTS,
  inventory:      SAMPLE_INVENTORY,
  simulateRows:   SAMPLE_SIMULATE_ROWS,
};

const AppDataContext = createContext<AppDataContextValue>({ ...INITIAL, ready: true });

export function useAppData() {
  return useContext(AppDataContext);
}

// ── Provider ───────────────────────────────────────────────────────────────
// Rank-based tier remapping — model scores cluster high so we redistribute
// by percentile: top 25% → High, next 35% → Medium, bottom 40% → Low
function rebalanceRiskTiers(customers: Customer[]): Customer[] {
  if (customers.length === 0) return customers;
  const sorted = [...customers].sort(
    (a, b) => Number(b.churn_probability) - Number(a.churn_probability)
  );
  const highEnd = Math.ceil(sorted.length * 0.25);
  const medEnd  = Math.ceil(sorted.length * 0.60);
  const high = new Set(sorted.slice(0, highEnd).map((c) => c.customer_number));
  const med  = new Set(sorted.slice(highEnd, medEnd).map((c) => c.customer_number));
  return customers.map((c) => ({
    ...c,
    risk_tier: high.has(c.customer_number) ? "High"
             : med.has(c.customer_number)  ? "Medium"
             : "Low",
  }));
}

export function AppDataProvider({ children }: { children: React.ReactNode }) {
  // Start with sample data — pages render instantly
  const [data, setData] = useState<AppData>(INITIAL);
  const fetched = useRef(false);

  useEffect(() => {
    if (fetched.current) return;
    fetched.current = true;

    // Each fetch updates only its slice of state when it resolves
    const patch = (slice: Partial<AppData>) =>
      setData((prev) => ({ ...prev, ...slice }));

    fetch("/api/data/kpis")
      .then((r) => r.json())
      .then((d) => { if (!d.error) patch({ kpis: d }); })
      .catch(() => {});

    fetch("/api/data/trends")
      .then((r) => r.json())
      .then((d) => { if (Array.isArray(d) && d.length > 0) patch({ trends: d }); })
      .catch(() => {});

    fetch("/api/data/forecast")
      .then((r) => r.json())
      .then((d) => {
        if (!d.error && d.rows?.length > 0)
          patch({ forecastRows: d.rows, forecastSource: d.source ?? "ml_model" });
      })
      .catch(() => {});

    fetch("/api/data/products")
      .then((r) => r.json())
      .then((d) => { if (Array.isArray(d) && d.length > 0) patch({ products: d }); })
      .catch(() => {});

    fetch("/api/data/customers")
      .then((r) => r.json())
      .then((d) => { if (Array.isArray(d) && d.length > 0) patch({ customers: rebalanceRiskTiers(d) }); })
      .catch(() => {});

    fetch("/api/data/segments")
      .then((r) => r.json())
      .then((d) => { if (d.rows?.length > 0) patch({ segments: d.rows }); })
      .catch(() => {});

    fetch("/api/data/inventory")
      .then((r) => r.json())
      .then((d) => { if (!d.error && d.rows?.length > 0) patch({ inventory: d }); })
      .catch(() => {});

    fetch("/api/data/simulate?adjustment=0&category=")
      .then((r) => r.json())
      .then((d) => { if (d.rows?.length > 0) patch({ simulateRows: d.rows }); })
      .catch(() => {});
  }, []);

  return (
    <AppDataContext.Provider value={{ ...data, ready: true }}>
      {children}
    </AppDataContext.Provider>
  );
}
