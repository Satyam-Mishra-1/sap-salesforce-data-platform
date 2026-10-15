import {
  Database, Layers, Star, Brain, Globe, MessageSquare,
  ArrowRight, CheckCircle, TrendingUp,
  Package, BarChart3, Cpu, DollarSign, Users, Calendar,
  GitBranch, Shield, Zap, RefreshCw,
} from "lucide-react";
import Link from "next/link";

export default function About() {
  return (
    <div className="max-w-5xl mx-auto space-y-12">

      {/* ── Header ───────────────────────────────────────────────── */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-3xl font-bold tracking-tight">Architecture & Platform</h1>
          <span className="text-xs bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400 px-3 py-1 rounded-full font-medium">
            Databricks DAIS 2026 Hackathon
          </span>
        </div>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Technical reference — pipeline, ML models, Genie AI/BI, consumption layers, and CI/CD.{" "}
          <Link href="/" className="text-blue-600 dark:text-blue-400 hover:underline">
            Read the backdrop →
          </Link>
        </p>

        {/* Stats */}
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 pt-2">
          {[
            { icon: Users,     value: "70",    label: "Customers"      },
            { icon: DollarSign,value: "$9.2M", label: "Revenue"        },
            { icon: Package,   value: "12",    label: "SKUs"           },
            { icon: Calendar,  value: "24mo",  label: "History"        },
            { icon: BarChart3, value: "8",     label: "Gold Views"     },
            { icon: Cpu,       value: "3",     label: "ML Models"      },
          ].map(({ icon: Icon, value, label }) => (
            <div key={label} className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg p-3 text-center">
              <Icon size={16} className="mx-auto text-blue-500 mb-1" />
              <p className="text-lg font-bold">{value}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
            </div>
          ))}
        </div>

        {/* Tech badges */}
        <div className="flex flex-wrap gap-2 pt-1">
          {[
            { label: "Databricks",    bg: "bg-red-100 dark:bg-red-900/30",      text: "text-red-700 dark:text-red-400"      },
            { label: "Delta Lake",    bg: "bg-blue-100 dark:bg-blue-900/30",    text: "text-blue-700 dark:text-blue-400"    },
            { label: "MLflow",        bg: "bg-indigo-100 dark:bg-indigo-900/30",text: "text-indigo-700 dark:text-indigo-400"},
            { label: "Unity Catalog", bg: "bg-purple-100 dark:bg-purple-900/30",text: "text-purple-700 dark:text-purple-400"},
            { label: "XGBoost",       bg: "bg-green-100 dark:bg-green-900/30",  text: "text-green-700 dark:text-green-400"  },
            { label: "scikit-learn",  bg: "bg-orange-100 dark:bg-orange-900/30",text: "text-orange-700 dark:text-orange-400"},
            { label: "Optuna",        bg: "bg-teal-100 dark:bg-teal-900/30",    text: "text-teal-700 dark:text-teal-400"    },
            { label: "Lakeflow DLT",  bg: "bg-cyan-100 dark:bg-cyan-900/30",    text: "text-cyan-700 dark:text-cyan-400"    },
            { label: "Genie AI/BI",   bg: "bg-orange-100 dark:bg-orange-900/30",text: "text-orange-700 dark:text-orange-400"},
            { label: "Next.js 14",    bg: "bg-gray-100 dark:bg-gray-800",       text: "text-gray-700 dark:text-gray-300"    },
            { label: "OpenAI GPT-4o", bg: "bg-violet-100 dark:bg-violet-900/30",text: "text-violet-700 dark:text-violet-400"},
            { label: "Vercel",        bg: "bg-gray-100 dark:bg-gray-800",       text: "text-gray-700 dark:text-gray-300"    },
            { label: "GitHub Actions",bg: "bg-slate-100 dark:bg-slate-800",     text: "text-slate-700 dark:text-slate-300"  },
          ].map((t) => (
            <span key={t.label} className={`text-xs font-medium px-2.5 py-0.5 rounded-full ${t.bg} ${t.text}`}>
              {t.label}
            </span>
          ))}
        </div>
      </div>

      {/* ── Pipeline ─────────────────────────────────────────────── */}
      <Section title="Data Pipeline — Bronze → Silver → Gold → ML" icon={<Layers size={18} className="text-blue-500" />}>
        <div className="space-y-1">
          {[
            {
              step: 1, label: "Data Sources", sub: "Raw inputs",
              color: "gray" as const, icon: <Database size={14} />,
              tags: ["SAP HANA — KNA1, VBAK, VBAP, ZCUST_INTERACTIONS, MARD_STOCK", "Salesforce CRM — Accounts, Opportunities, Cases"],
            },
            {
              step: 2, label: "Bronze Layer", sub: "Weekly ingestion · sap_bronze schema",
              color: "amber" as const, icon: <Database size={14} />,
              tags: ["bronze_sap_kna1_customers", "bronze_sap_vbak_orders", "bronze_sap_vbap_order_items", "bronze_sap_zcust_interactions", "bronze_sap_mard_stock"],
            },
            {
              step: 3, label: "Silver — Lakeflow DLT", sub: "Spark Declarative Pipeline · serverless",
              color: "blue" as const, icon: <Layers size={14} />,
              tags: ["dim_customer_unified", "fact_sap_orders", "fact_customer_interactions", "fact_opportunity", "fact_case"],
            },
            {
              step: 4, label: "Gold Layer", sub: "Business views · gold_pres schema",
              color: "yellow" as const, icon: <Star size={14} />,
              tags: ["gold_customer_360", "gold_sales_to_fulfillment_pipeline", "gold_demand_vs_supply_gap", "metrics_customer_health", "metrics_sales_performance", "metrics_product_trends"],
            },
            {
              step: 5, label: "ML Models", sub: "MLflow · Unity Catalog · @champion alias",
              color: "purple" as const, icon: <Brain size={14} />,
              tags: ["deal2delivery_churn_model @champion", "deal2delivery_demand_forecast @champion", "deal2delivery_customer_segments @champion"],
            },
          ].map((stage, i, arr) => (
            <div key={stage.step} className="flex gap-3">
              <div className="flex flex-col items-center w-7 shrink-0">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0 ${stepColor(stage.color)}`}>
                  {stage.step}
                </div>
                {i < arr.length - 1 && <div className="w-0.5 flex-1 min-h-3 bg-gray-200 dark:bg-gray-700 my-1" />}
              </div>
              <div className={`flex-1 rounded-lg border p-3 mb-2 ${stageBg(stage.color)}`}>
                <div className="flex flex-wrap items-center gap-2 mb-2">
                  <span className={stageIcon(stage.color)}>{stage.icon}</span>
                  <span className="font-semibold text-sm">{stage.label}</span>
                  <span className="text-xs text-gray-500 dark:text-gray-400">{stage.sub}</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {stage.tags.map((t) => (
                    <span key={t} className={`text-xs px-2 py-0.5 rounded-full ${stageTag(stage.color)}`}>{t}</span>
                  ))}
                </div>
              </div>
            </div>
          ))}

          <div className="flex gap-3 pl-10 mt-1">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 flex-1">
              {[
                {
                  label: "Next.js App on Vercel", icon: <Globe size={14} />, color: "green" as const,
                  sub: "Public · business stakeholders",
                  tags: ["Dashboard + KPIs", "Demand Forecast", "Scenario Simulator", "Inventory Gap", "Customer Risk + Segments", "OpenAI GPT-4o insights"],
                },
                {
                  label: "Databricks Genie AI/BI", icon: <MessageSquare size={14} />, color: "orange" as const,
                  sub: "Internal · data teams",
                  tags: ["Natural language queries", "AI/BI Dashboards", "LLM-as-a-Judge evaluation", "Claude Opus remediation"],
                },
              ].map((s) => (
                <div key={s.label} className={`rounded-lg border p-3 ${stageBg(s.color)}`}>
                  <div className="flex items-center gap-2 mb-2">
                    <span className={stageIcon(s.color)}>{s.icon}</span>
                    <div>
                      <p className="font-semibold text-sm">{s.label}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{s.sub}</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {s.tags.map((t) => (
                      <span key={t} className={`text-xs px-2 py-0.5 rounded-full ${stageTag(s.color)}`}>{t}</span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Section>

      {/* ── ML Models ────────────────────────────────────────────── */}
      <Section title="ML Models" icon={<Brain size={18} className="text-purple-500" />}>
        <div className="grid md:grid-cols-2 gap-4">
          <ModelCard
            name="Customer Segmentation"
            type="K-Means Clustering (k=5)"
            registry="deal2delivery_customer_segments@champion"
            color="teal"
            highlights={[
              "5 RFM segments: Champions, Loyal, At-Risk, Hibernating, Prospects",
              "Features: revenue, order count, days silent, sentiment, open cases, engagement",
              "StandardScaler — prevents revenue dominating clustering",
              "RFM score (0–100): recency 30% + frequency 30% + monetary 40%",
            ]}
            metrics={["Inertia tracked", "Silhouette score", "6 features", "customer_segments table"]}
          />
          <ModelCard
            name="Churn Prediction v2"
            type="XGBoost Classifier"
            registry="deal2delivery_churn_model@champion"
            color="purple"
            highlights={[
              "Composite behavioral label — 5 weighted signals",
              "Inactivity 35% · Cases 20% · Sentiment 20% · Neg ratio 15% · Revenue 10%",
              "Optuna Bayesian hyperparameter search — 15 trials",
              "Stratified 5-fold CV · Output: probability + High/Medium/Low tier",
            ]}
            metrics={["CV AUC tracked", "CV F1 tracked", "30+ features", "MLflow Traced"]}
          />
          <ModelCard
            name="Demand Forecast"
            type="XGBoost Regressor"
            registry="deal2delivery_demand_forecast@champion"
            color="blue"
            highlights={[
              "Per-SKU monthly quantity forecast using lag features",
              "Lag features: prev month, prev quarter, rolling 3 & 6 month avg",
              "Time-based train/test split — last 15% of months as test",
              "6-month forward predictions → demand_forecast_predictions gold table",
            ]}
            metrics={["MAE tracked", "RMSE tracked", "MAPE tracked", "12 SKUs × 6M"]}
          />
        </div>
      </Section>

      {/* ── Genie ────────────────────────────────────────────────── */}
      <Section title="Genie AI/BI — Natural Language Analytics" icon={<MessageSquare size={18} className="text-orange-500" />}>
        <div className="grid md:grid-cols-2 gap-6">
          <div className="space-y-3">
            <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
              Databricks Genie space backed by all Gold views. Business users ask questions in plain
              English — Genie generates SQL and returns data-driven answers. A self-improving evaluation
              loop runs LLM-as-a-Judge scorers on every conversation.
            </p>
            {["Which customers haven't ordered in 90 days?",
              "What's the revenue trend for computing products?",
              "Show me top 5 customers by lifetime value",
              "Which SKUs are critically understocked?",
            ].map((q) => (
              <div key={q} className="flex items-start gap-2 text-sm">
                <MessageSquare size={13} className="text-orange-400 mt-0.5 shrink-0" />
                <span className="text-gray-600 dark:text-gray-400 italic">"{q}"</span>
              </div>
            ))}
          </div>
          <div className="space-y-2">
            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">LLM-as-a-Judge Scorers</p>
            {[
              { scorer: "RelevanceToQuery",       desc: "Response addresses the question"   },
              { scorer: "RetrievalGroundedness",  desc: "Answer grounded in actual data"    },
              { scorer: "genie_response_quality", desc: "Data-driven, not vague"            },
              { scorer: "genie_sql_quality",      desc: "Correct aggregations, no SELECT *" },
              { scorer: "Safety",                 desc: "No harmful content"                },
              { scorer: "has_response",           desc: "Non-empty answer returned"         },
              { scorer: "no_error",               desc: "Completed without errors"          },
            ].map(({ scorer, desc }) => (
              <div key={scorer} className="flex items-start gap-2 text-xs">
                <CheckCircle size={12} className="text-green-500 mt-0.5 shrink-0" />
                <span>
                  <span className="font-mono text-gray-800 dark:text-gray-200">{scorer}</span>
                  <span className="text-gray-500 dark:text-gray-400"> — {desc}</span>
                </span>
              </div>
            ))}
          </div>
        </div>
      </Section>

      {/* ── App Pages ────────────────────────────────────────────── */}
      <Section title="App Pages" icon={<Globe size={18} className="text-blue-500" />}>
        <div className="space-y-2">
          {[
            { page: "Story",          href: "/story",         icon: <Shield size={14} />,     color: "blue",
              desc: "The business backdrop — NovaTech Electronics, the deal-to-delivery gap, pain points and Databricks solutions." },
            { page: "Dashboard",      href: "/",              icon: <TrendingUp size={14} />, color: "blue",
              desc: "Live KPIs, monthly revenue & units trend charts, GPT-4o insight strip." },
            { page: "Demand Forecast",href: "/demand-forecast",icon: <BarChart3 size={14} />, color: "purple",
              desc: "24-month actuals + 6-month XGBoost forecast overlay. Declining SKU alerts. Product performance table." },
            { page: "Simulator",      href: "/simulator",     icon: <TrendingUp size={14} />, color: "green",
              desc: "Drag a slider −50% to +100% to model demand scenarios. Unit delta + estimated revenue impact." },
            { page: "Inventory",      href: "/inventory",     icon: <Package size={14} />,    color: "orange",
              desc: "SAP MARD stock vs 6-month ML forecast per SKU. Critical / Warning / OK gap classification." },
            { page: "Customer Risk",  href: "/customer-risk", icon: <Users size={14} />,      color: "red",
              desc: "XGBoost churn scores, K-Means RFM segments, one-click GPT-4o risk explanation per customer." },
          ].map((p) => (
            <Link key={p.page} href={p.href}
              className="flex gap-3 border border-gray-200 dark:border-gray-800 rounded-lg p-3 hover:border-blue-300 dark:hover:border-blue-700 transition-colors group">
              <div className="shrink-0 w-7 h-7 rounded-md bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-gray-500 group-hover:bg-blue-50 dark:group-hover:bg-blue-900/30 group-hover:text-blue-500 transition-colors">
                {p.icon}
              </div>
              <div>
                <p className="font-semibold text-sm group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                  {p.page} →
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{p.desc}</p>
              </div>
            </Link>
          ))}
        </div>
      </Section>

      {/* ── CI/CD ────────────────────────────────────────────────── */}
      <Section title="CI/CD — GitHub Actions + Databricks Asset Bundles" icon={<GitBranch size={18} className="text-slate-500" />}>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {[
            { branch: "feature/*", target: "—",       trigger: "PR to develop",            color: "gray"   },
            { branch: "develop",   target: "dev",     trigger: "Push (auto-deploy)",       color: "blue"   },
            { branch: "main",      target: "staging", trigger: "Push (auto-deploy)",       color: "yellow" },
            { branch: "manual",    target: "prod",    trigger: "workflow_dispatch",        color: "green"  },
          ].map((r) => (
            <div key={r.branch} className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg p-3 text-center text-xs space-y-1">
              <p className="font-mono font-bold text-gray-800 dark:text-gray-200">{r.branch}</p>
              <ArrowRight size={11} className="mx-auto text-gray-400" />
              <span className={`inline-block px-2 py-0.5 rounded-full font-medium ${
                r.color === "blue"   ? "bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300"     :
                r.color === "yellow" ? "bg-yellow-100 dark:bg-yellow-900/40 text-yellow-700 dark:text-yellow-300" :
                r.color === "green"  ? "bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300"   :
                "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400"
              }`}>{r.target || "—"}</span>
              <p className="text-gray-500 dark:text-gray-400">{r.trigger}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* ── Caching ──────────────────────────────────────────────── */}
      <Section title="Performance — Three-Layer Cache" icon={<Zap size={18} className="text-yellow-500" />}>
        <div className="grid sm:grid-cols-3 gap-3">
          {[
            { layer: "Layer 1", name: "Next.js ISR",               color: "blue",  ttl: "5 min",    icon: <RefreshCw size={14} />, desc: "API responses cached at Vercel CDN. Tab switches within 5 min hit zero Databricks queries." },
            { layer: "Layer 2", name: "Databricks SQL Result Cache",color: "red",   ttl: "24 h",     icon: <Database size={14} />,  desc: "Identical queries return in ~200ms from warehouse cache — no re-execution on Delta." },
            { layer: "Layer 3", name: "Delta Cache",                color: "green", ttl: "In-memory",icon: <Layers size={14} />,    desc: "Hot table data cached on cluster SSD. Repeated reads skip cloud storage entirely." },
          ].map((c) => (
            <div key={c.name} className={`border rounded-lg p-4 space-y-2 ${cacheBg(c.color)}`}>
              <div className="flex items-start justify-between">
                <div>
                  <p className={`text-xs font-bold ${cacheText(c.color)}`}>{c.layer}</p>
                  <p className="font-semibold text-sm mt-0.5">{c.name}</p>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${cacheBg(c.color)} ${cacheText(c.color)}`}>{c.ttl}</span>
              </div>
              <div className={cacheText(c.color)}>{c.icon}</div>
              <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">{c.desc}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* ── Footer ───────────────────────────────────────────────── */}
      <div className="border-t border-gray-200 dark:border-gray-800 pt-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <p className="font-semibold">Deal2Delivery</p>
          <p className="text-sm text-gray-500 dark:text-gray-400">Databricks DAIS 2026 Community Virtual Hackathon</p>
        </div>
      </div>

    </div>
  );
}

/* ── Sub-components ──────────────────────────────────────────── */

function Section({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 border-b border-gray-200 dark:border-gray-800 pb-3">
        {icon}
        <h2 className="text-lg font-semibold">{title}</h2>
      </div>
      {children}
    </div>
  );
}

type StageColor = "gray" | "amber" | "blue" | "yellow" | "purple" | "green" | "orange";

function stepColor(c: StageColor) {
  return { gray:"bg-gray-500", amber:"bg-amber-500", blue:"bg-blue-500", yellow:"bg-yellow-500", purple:"bg-purple-500", green:"bg-green-500", orange:"bg-orange-500" }[c];
}
function stageBg(c: StageColor) {
  return {
    gray:   "border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/40",
    amber:  "border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30",
    blue:   "border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/30",
    yellow: "border-yellow-200 dark:border-yellow-800 bg-yellow-50 dark:bg-yellow-950/30",
    purple: "border-purple-200 dark:border-purple-800 bg-purple-50 dark:bg-purple-950/30",
    green:  "border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950/30",
    orange: "border-orange-200 dark:border-orange-800 bg-orange-50 dark:bg-orange-950/30",
  }[c];
}
function stageIcon(c: StageColor) {
  return { gray:"text-gray-500", amber:"text-amber-600", blue:"text-blue-600", yellow:"text-yellow-600", purple:"text-purple-600", green:"text-green-600", orange:"text-orange-600" }[c];
}
function stageTag(c: StageColor) {
  return {
    gray:   "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300",
    amber:  "bg-amber-100 dark:bg-amber-900/50 text-amber-800 dark:text-amber-300",
    blue:   "bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-300",
    yellow: "bg-yellow-100 dark:bg-yellow-900/50 text-yellow-800 dark:text-yellow-300",
    purple: "bg-purple-100 dark:bg-purple-900/50 text-purple-800 dark:text-purple-300",
    green:  "bg-green-100 dark:bg-green-900/50 text-green-800 dark:text-green-300",
    orange: "bg-orange-100 dark:bg-orange-900/50 text-orange-800 dark:text-orange-300",
  }[c];
}
function cacheBg(c: string) {
  return { blue:"border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/20", red:"border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/20", green:"border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950/20" }[c] ?? "";
}
function cacheText(c: string) {
  return { blue:"text-blue-600 dark:text-blue-400", red:"text-red-600 dark:text-red-400", green:"text-green-600 dark:text-green-400" }[c] ?? "";
}

function ModelCard({ name, type, registry, color, highlights, metrics }: {
  name: string; type: string; registry: string; color: "purple" | "blue" | "teal";
  highlights: string[]; metrics: string[];
}) {
  const s = {
    purple: { border:"border-purple-200 dark:border-purple-800", bg:"bg-purple-50 dark:bg-purple-950/20", badge:"bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300", text:"text-purple-600 dark:text-purple-400" },
    blue:   { border:"border-blue-200 dark:border-blue-800",     bg:"bg-blue-50 dark:bg-blue-950/20",     badge:"bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300",     text:"text-blue-600 dark:text-blue-400"   },
    teal:   { border:"border-teal-200 dark:border-teal-800",     bg:"bg-teal-50 dark:bg-teal-950/20",     badge:"bg-teal-100 dark:bg-teal-900/40 text-teal-700 dark:text-teal-300",     text:"text-teal-600 dark:text-teal-400"   },
  }[color];
  return (
    <div className={`border ${s.border} ${s.bg} rounded-lg p-4 space-y-3`}>
      <div>
        <p className="font-bold text-sm">{name}</p>
        <p className={`text-xs font-medium mt-0.5 ${s.text}`}>{type}</p>
        <p className="text-xs font-mono text-gray-500 dark:text-gray-400 mt-1">{registry}</p>
      </div>
      <div className="space-y-1.5">
        {highlights.map((h) => (
          <div key={h} className="flex items-start gap-1.5 text-xs text-gray-700 dark:text-gray-300">
            <CheckCircle size={11} className="text-green-500 mt-0.5 shrink-0" />{h}
          </div>
        ))}
      </div>
      <div className="flex flex-wrap gap-1">
        {metrics.map((m) => (
          <span key={m} className={`text-xs px-2 py-0.5 rounded-full ${s.badge}`}>{m}</span>
        ))}
      </div>
    </div>
  );
}
