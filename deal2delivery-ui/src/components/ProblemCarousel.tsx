"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import {
  ChevronLeft, ChevronRight,
  Link2, Users, TrendingUp, Eye, Lock, Search,
  Clock, Activity, Package,
  CheckCircle,
} from "lucide-react";

/* ── card data ─────────────────────────────────────────────── */

const CARDS = [
  {
    num: "01", color: "blue",   icon: <Link2 size={20} />,
    problem: "Siloed CRM & ERP Data",
    problemDesc: "Sales teams live in Salesforce. Operations live in SAP. Neither system sees the other — causing mis-forecasted demand, stock shortages, and revenue leakage from deals that never get fulfilled.",
    solution:    "Databricks Lakehouse ingests and joins both sources into a single Delta Lake. Unity Catalog governs access across dev, staging, and prod with fine-grained permissions.",
    features:    ["Delta Lake", "Unity Catalog", "Lakeflow DLT"],
  },
  {
    num: "02", color: "red",    icon: <Users size={20} />,
    problem: "Reactive Churn Management",
    problemDesc: "Sales reps discover a customer has churned only after they've gone silent for months. There's no early warning system — churn signals from support cases, sentiment, and order behaviour are invisible.",
    solution:    "XGBoost churn model trained on a composite behavioral label (inactivity + case burden + sentiment + revenue decline). Optuna-tuned with 5-fold CV. Predictions stored in Unity Catalog for governed consumption.",
    features:    ["MLflow", "Unity Catalog", "XGBoost + Optuna"],
  },
  {
    num: "03", color: "green",  icon: <TrendingUp size={20} />,
    problem: "Gut-feel Demand Planning",
    problemDesc: "Demand plans are built on intuition and last month's spreadsheet. SKU-level trends, seasonality, and customer buying cycles are buried in SAP tables nobody queries.",
    solution:    "XGBoost demand forecast model trained on 24 months of SAP order data with lag features (prev month, rolling 3 & 6 month avg). 6-month forward predictions written to a gold table and surfaced in the app.",
    features:    ["MLflow", "XGBoost", "Gold Delta Tables"],
  },
  {
    num: "04", color: "purple", icon: <Eye size={20} />,
    problem: "AI Inference is a Black Box",
    problemDesc: "When an ML model flags a customer as high-risk, nobody can explain why. Trust in AI predictions is low because the chain from raw data to decision is invisible.",
    solution:    "MLflow Tracing logs every customer scoring as a trace with nested spans — model input, churn probability, and a Databricks Foundation Model LLM explanation. The Traces tab shows the full chain per customer.",
    features:    ["MLflow Tracing", "Databricks Foundation Models", "SpanType.CHAIN"],
  },
  {
    num: "05", color: "orange", icon: <Lock size={20} />,
    problem: "Insights Locked Inside Databricks",
    problemDesc: "Business stakeholders — sales managers, account execs, finance — don't have Databricks access. Insights stay in internal dashboards that only data engineers can open.",
    solution:    "Next.js app on Vercel queries Databricks SQL REST API from server-side API routes. Stakeholders get a public URL with curated KPIs, ML predictions, and OpenAI GPT-4o explanations — no Databricks login required.",
    features:    ["Databricks SQL REST API", "SQL Result Cache", "Next.js ISR"],
  },
  {
    num: "06", color: "amber",  icon: <Search size={20} />,
    problem: "Non-Technical Users Can't Query Data",
    problemDesc: "Business questions like 'Which healthcare customers haven't ordered in 60 days?' require a data analyst to write SQL, schedule a Jira ticket, and wait a week for an answer.",
    solution:    "Databricks Genie AI/BI space backed by all 8 gold views. Users type natural language — Genie generates and runs SQL instantly. A self-improving LLM-as-a-Judge evaluation loop keeps answer quality high using Claude Opus.",
    features:    ["Genie AI/BI", "LLM-as-a-Judge", "Claude Opus"],
  },
  {
    num: "07", color: "cyan",   icon: <Clock size={20} />,
    problem: "Every Query Hits the Warehouse",
    problemDesc: "Without caching, every page load or tab switch sends a new query to the SQL warehouse — adding seconds of latency and burning unnecessary DBUs on repeated identical queries.",
    solution:    "Two-layer cache: Next.js ISR (5-min TTL at Vercel CDN) + Databricks SQL Warehouse Result Cache (24h TTL). Tab switching is instant after first load. Repeated identical queries cost zero additional DBUs.",
    features:    ["SQL Result Cache", "Delta Cache", "Next.js ISR"],
  },
  {
    num: "08", color: "indigo", icon: <Activity size={20} />,
    problem: "No Model Governance or Lineage",
    problemDesc: "ML models trained in ad-hoc notebooks are deployed without version control. Nobody knows which model version is in production, what data it was trained on, or how its accuracy has changed over time.",
    solution:    "Every training run is tracked in MLflow with full metrics, parameters, and artifacts. Models are registered in Unity Catalog with the @champion alias pattern — production always uses the best validated version.",
    features:    ["MLflow Experiments", "Unity Catalog Registry", "@champion alias"],
  },
  {
    num: "09", color: "orange", icon: <Package size={20} />,
    problem: "No Inventory Visibility Against Forecast",
    problemDesc: "Demand is forecasted in isolation — nobody can see which SKUs are critically understocked relative to the 6-month ML-predicted demand until purchase orders are already overdue.",
    solution:    "SAP MARD stock data is ingested to a bronze Delta table, joined with ML forecast predictions in a new gold view, and classified as Critical / Warning / OK per SKU. Surfaced in a dedicated Inventory page.",
    features:    ["SAP MARD Bronze", "gold_demand_vs_supply_gap", "Delta Lake"],
  },
  {
    num: "10", color: "cyan",   icon: <TrendingUp size={20} />,
    problem: "Static Demand Plans — No Scenario Modelling",
    problemDesc: "Sales managers can't answer 'what if we run a 20% promo on Cloud products next quarter?' Demand planning is a fixed output with no interactivity — scenarios exist only in spreadsheets.",
    solution:    "Scenario Simulator page lets users pick a product category and apply a % adjustment (−50% to +100%) against the XGBoost forecast in real time. Shows unit delta and estimated revenue impact instantly via SQL multiplier.",
    features:    ["demand_forecast_predictions", "SQL REST API", "Next.js interactive UI"],
  },
  {
    num: "11", color: "teal",   icon: <Users size={20} />,
    problem: "All Customers Look the Same",
    problemDesc: "High/Medium/Low churn tiers treat customers as a binary risk signal. Upsell opportunities, win-back plays, and loyalty investment decisions are invisible because there's no richer segmentation.",
    solution:    "K-Means RFM clustering groups customers into Champions, Loyal, At-Risk, Hibernating, and Prospects. Silhouette score and inertia tracked in MLflow. Segments appear as filters and colour-coded badges in the Customer Risk view.",
    features:    ["K-Means · scikit-learn", "MLflow tracking", "customer_segments table"],
  },
] as const;

/* ── colour palette ─────────────────────────────────────────── */

type CardColor = typeof CARDS[number]["color"];

const PALETTE: Record<CardColor, { border: string; bg: string; badge: string; icon: string; num: string }> = {
  blue:   { border: "border-blue-200 dark:border-blue-800",     bg: "bg-blue-50 dark:bg-blue-950/20",     badge: "bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-300",       icon: "text-blue-500",   num: "text-blue-400 dark:text-blue-600"    },
  red:    { border: "border-red-200 dark:border-red-800",       bg: "bg-red-50 dark:bg-red-950/20",       badge: "bg-red-100 dark:bg-red-900/40 text-red-800 dark:text-red-300",           icon: "text-red-500",    num: "text-red-400 dark:text-red-600"      },
  green:  { border: "border-green-200 dark:border-green-800",   bg: "bg-green-50 dark:bg-green-950/20",   badge: "bg-green-100 dark:bg-green-900/40 text-green-800 dark:text-green-300",   icon: "text-green-500",  num: "text-green-400 dark:text-green-600"  },
  purple: { border: "border-purple-200 dark:border-purple-800", bg: "bg-purple-50 dark:bg-purple-950/20", badge: "bg-purple-100 dark:bg-purple-900/40 text-purple-800 dark:text-purple-300", icon: "text-purple-500", num: "text-purple-400 dark:text-purple-600" },
  orange: { border: "border-orange-200 dark:border-orange-800", bg: "bg-orange-50 dark:bg-orange-950/20", badge: "bg-orange-100 dark:bg-orange-900/40 text-orange-800 dark:text-orange-300", icon: "text-orange-500", num: "text-orange-400 dark:text-orange-600" },
  amber:  { border: "border-amber-200 dark:border-amber-800",   bg: "bg-amber-50 dark:bg-amber-950/20",   badge: "bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300",   icon: "text-amber-500",  num: "text-amber-400 dark:text-amber-600"  },
  cyan:   { border: "border-cyan-200 dark:border-cyan-800",     bg: "bg-cyan-50 dark:bg-cyan-950/20",     badge: "bg-cyan-100 dark:bg-cyan-900/40 text-cyan-800 dark:text-cyan-300",       icon: "text-cyan-500",   num: "text-cyan-400 dark:text-cyan-600"    },
  indigo: { border: "border-indigo-200 dark:border-indigo-800", bg: "bg-indigo-50 dark:bg-indigo-950/20", badge: "bg-indigo-100 dark:bg-indigo-900/40 text-indigo-800 dark:text-indigo-300", icon: "text-indigo-500", num: "text-indigo-400 dark:text-indigo-600" },
  teal:   { border: "border-teal-200 dark:border-teal-800",     bg: "bg-teal-50 dark:bg-teal-950/20",     badge: "bg-teal-100 dark:bg-teal-900/40 text-teal-800 dark:text-teal-300",       icon: "text-teal-500",   num: "text-teal-400 dark:text-teal-600"    },
};

/* ── ProblemCard ────────────────────────────────────────────── */

function ProblemCard({ card }: { card: typeof CARDS[number] }) {
  const p = PALETTE[card.color];
  return (
    <div className={`border ${p.border} ${p.bg} rounded-xl p-6 flex flex-col gap-4 h-full`}>
      <div className="flex items-center gap-3">
        <div className={p.icon}>{card.icon}</div>
        <div>
          <p className={`text-xs font-bold font-mono ${p.num}`}>{card.num}</p>
          <p className="font-bold text-sm leading-snug">{card.problem}</p>
        </div>
      </div>
      <div className="space-y-1">
        <p className="text-xs font-semibold text-red-500 uppercase tracking-wide">The Problem</p>
        <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">{card.problemDesc}</p>
      </div>
      <div className="space-y-1">
        <p className="text-xs font-semibold text-green-600 dark:text-green-400 uppercase tracking-wide">Databricks Solution</p>
        <p className="text-xs text-gray-700 dark:text-gray-300 leading-relaxed">{card.solution}</p>
      </div>
      <div className="flex flex-wrap gap-1.5 mt-auto pt-1">
        {card.features.map((f) => (
          <span key={f} className={`text-xs px-2 py-0.5 rounded-full font-medium ${p.badge}`}>{f}</span>
        ))}
      </div>
    </div>
  );
}

/* ── Carousel ───────────────────────────────────────────────── */

const TOTAL = CARDS.length;
const AUTO_MS = 5000;

export function ProblemCarousel() {
  const [index, setIndex]     = useState(0);
  const [paused, setPaused]   = useState(false);
  const [dir, setDir]         = useState<1 | -1>(1); // for animation direction hint
  const timerRef              = useRef<ReturnType<typeof setTimeout> | null>(null);

  const go = useCallback((next: number, direction: 1 | -1 = 1) => {
    setDir(direction);
    setIndex(((next % TOTAL) + TOTAL) % TOTAL);
  }, []);

  const prev = () => go(index - 1, -1);
  const next = () => go(index + 1,  1);

  // Auto-advance
  useEffect(() => {
    if (paused) return;
    timerRef.current = setTimeout(() => go(index + 1, 1), AUTO_MS);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [index, paused, go]);

  // Keyboard navigation
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft")  prev();
      if (e.key === "ArrowRight") next();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  });

  return (
    <div
      className="space-y-4"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {/* Counter + progress bar */}
      <div className="flex items-center justify-between">
        <span className="text-xs text-gray-400 tabular-nums">{index + 1} / {TOTAL}</span>
        <div className="flex-1 mx-4 h-1 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
          <div
            className="h-full bg-blue-500 rounded-full transition-all duration-500"
            style={{ width: `${((index + 1) / TOTAL) * 100}%` }}
          />
        </div>
        <span className="text-xs text-gray-400">{paused ? "paused" : "auto"}</span>
      </div>

      {/* Card + arrows */}
      <div className="flex items-center gap-3">
        <button
          onClick={prev}
          aria-label="Previous"
          className="shrink-0 w-9 h-9 flex items-center justify-center rounded-full border border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:border-blue-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
        >
          <ChevronLeft size={18} />
        </button>

        {/* Sliding viewport */}
        <div className="flex-1 overflow-hidden rounded-xl">
          <div
            className="flex transition-transform duration-400 ease-in-out"
            style={{ transform: `translateX(-${index * 100}%)` }}
          >
            {CARDS.map((card) => (
              <div key={card.num} className="w-full shrink-0">
                <ProblemCard card={card} />
              </div>
            ))}
          </div>
        </div>

        <button
          onClick={next}
          aria-label="Next"
          className="shrink-0 w-9 h-9 flex items-center justify-center rounded-full border border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:border-blue-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
        >
          <ChevronRight size={18} />
        </button>
      </div>

      {/* Dot indicators */}
      <div className="flex justify-center gap-1.5">
        {CARDS.map((card, i) => (
          <button
            key={card.num}
            onClick={() => go(i, i > index ? 1 : -1)}
            aria-label={`Go to problem ${i + 1}`}
            className={`rounded-full transition-all duration-300 ${
              i === index
                ? "w-5 h-2 bg-blue-500"
                : "w-2 h-2 bg-gray-300 dark:bg-gray-600 hover:bg-gray-400 dark:hover:bg-gray-500"
            }`}
          />
        ))}
      </div>

      {/* Quick-jump labels (problem titles, clickable) */}
      <div className="flex flex-wrap gap-1.5 justify-center">
        {CARDS.map((card, i) => {
          const p = PALETTE[card.color];
          return (
            <button
              key={card.num}
              onClick={() => go(i, i > index ? 1 : -1)}
              className={`text-xs px-2 py-0.5 rounded-full border transition-all ${
                i === index
                  ? `${p.border} ${p.badge} font-semibold`
                  : "border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:border-gray-400"
              }`}
            >
              {card.num}
            </button>
          );
        })}
      </div>
    </div>
  );
}
