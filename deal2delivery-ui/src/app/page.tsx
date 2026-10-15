import {
  Database, CheckCircle, XCircle, TrendingDown,
  AlertTriangle, Users, DollarSign, Package, Calendar,
  ArrowRight, Zap,
} from "lucide-react";
import { ProblemCarousel } from "@/components/ProblemCarousel";
import Link from "next/link";

export default function Story() {
  return (
    <div className="max-w-4xl mx-auto space-y-16">

      {/* ── Hero ─────────────────────────────────────────────────── */}
      <div className="space-y-6 pt-4">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-xs bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400 px-3 py-1 rounded-full font-medium">
            Databricks DAIS 2026 Hackathon
          </span>
          <span className="text-xs bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 px-3 py-1 rounded-full">
            Real World Problem · Real Data · Real ML
          </span>
        </div>

        <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight leading-tight">
          The Gap Between<br />
          <span className="bg-gradient-to-r from-blue-500 to-emerald-500 bg-clip-text text-transparent">
            Deal and Delivery
          </span>
        </h1>

        <div className="border-l-4 border-blue-500 pl-5 py-1 space-y-2">
          <p className="text-lg sm:text-xl italic text-gray-500 dark:text-gray-400 leading-relaxed">
            "A deal closes in Salesforce on Friday. Delivery stalls in SAP on Monday.
            The customer churns by next quarter — and nobody saw it coming."
          </p>
          <p className="text-base font-semibold text-gray-800 dark:text-gray-100">
            Deal2Delivery was built to close that gap. Permanently.
          </p>
        </div>
      </div>

      {/* ── Problems Carousel ────────────────────────────────────── */}
      <div className="space-y-5">
        <div>
          <h2 className="text-2xl font-bold">11 Problems. 11 Databricks Solutions.</h2>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
            Every problem we identified has a direct Databricks feature behind its solution.
          </p>
        </div>
        <ProblemCarousel />
      </div>

      {/* ── Company ──────────────────────────────────────────────── */}
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold">Meet NovaTech Electronics</h2>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
            A company that looks successful on paper — and is quietly losing customers it never noticed leaving.
          </p>
        </div>

        <div className="grid sm:grid-cols-3 gap-3">
          {[
            { icon: Users,     value: "70",    label: "Enterprise clients",  color: "blue"   },
            { icon: DollarSign,value: "$9.2M", label: "Annual revenue",      color: "green"  },
            { icon: Package,   value: "12",    label: "Electronics SKUs",    color: "orange" },
            { icon: Calendar,  value: "24",    label: "Months of history",   color: "purple" },
            { icon: TrendingDown, value: "~18%", label: "Silent churn rate", color: "red"    },
            { icon: AlertTriangle, value: "3",  label: "Systems, 0 bridges", color: "amber"  },
          ].map(({ icon: Icon, value, label, color }) => (
            <div key={label} className={`rounded-xl border p-4 ${statBg(color)}`}>
              <Icon size={20} className={`${statIcon(color)} mb-2`} />
              <p className="text-2xl font-extrabold">{value}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{label}</p>
            </div>
          ))}
        </div>

        <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
          NovaTech Electronics sells computing devices, mobile hardware, and accessories to 70 enterprise
          clients across tech, finance, and professional services. Their account managers live in{" "}
          <span className="font-semibold text-blue-600 dark:text-blue-400">Salesforce CRM</span>.
          Warehouse stock, order fulfilment, and procurement run in{" "}
          <span className="font-semibold text-orange-600 dark:text-orange-400">SAP HANA</span>.
          These two systems have never spoken to each other — and that silence is costing the business
          in ways nobody can even measure, because the data is split across systems that refuse to meet.
        </p>
      </div>

      {/* ── The Silence Between Systems ──────────────────────────── */}
      <div className="space-y-5">
        <div>
          <h2 className="text-2xl font-bold">The Silence Between Systems</h2>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
            Each system knows half the truth. Neither knows enough to act.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <SiloCard
            color="blue"
            system="Salesforce CRM"
            role="The customer-facing half"
            knows={[
              "Who bought what and when",
              "Open opportunities & pipeline",
              "Support cases & sentiment scores",
              "Customer lifetime value estimates",
            ]}
            blind={[
              "Is the product actually in stock?",
              "Has fulfilment already failed?",
              "What's the procurement lead time?",
              "Are we over-committed on inventory?",
            ]}
          />
          <SiloCard
            color="orange"
            system="SAP HANA ERP"
            role="The operations half"
            knows={[
              "Warehouse stock levels per SKU",
              "Order execution & fulfilment status",
              "Procurement orders & lead times",
              "Product-level demand history",
            ]}
            blind={[
              "Is this customer about to churn?",
              "What deals are closing this quarter?",
              "Which accounts are high risk?",
              "Why did revenue drop last month?",
            ]}
          />
        </div>

        <div className="bg-gray-50 dark:bg-gray-900/60 border border-gray-200 dark:border-gray-800 rounded-xl p-5">
          <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed text-center">
            The result: stock shortages appear only after deals fail. Churn is discovered only after
            customers go quiet. Demand plans are built on intuition. And when the AI flags a risk,
            nobody can explain why — so nobody acts.
            <span className="font-semibold text-gray-800 dark:text-gray-100"> This is the deal-to-delivery gap.</span>
          </p>
        </div>
      </div>

      {/* ── The 4 Symptoms ───────────────────────────────────────── */}
      <div className="space-y-5">
        <div>
          <h2 className="text-2xl font-bold">What the Gap Costs, Week by Week</h2>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
            Four real scenarios from NovaTech's operations — none of them visible without unified data.
          </p>
        </div>

        <div className="space-y-4">
          {[
            {
              num: "01",
              color: "red",
              title: "The Invisible Stockout",
              scene: "Monday, 9 AM. A sales rep closes a $200K laptop order in Salesforce.",
              problem: "The warehouse in SAP has 12 units. The order is for 80. Nobody knows this until the customer calls three weeks later asking where their devices are.",
              cost: "Fulfilment failure, expediting fees, damaged relationship.",
            },
            {
              num: "02",
              color: "amber",
              title: "The Silent Churn",
              scene: "A top-tier client hasn't placed an order in 94 days.",
              problem: "Their SAP interaction log shows 4 unresolved support tickets and a billing dispute. Their Salesforce account shows 'Active'. The account manager has no idea.",
              cost: "Full account lost. $180K ARR gone before anyone noticed.",
            },
            {
              num: "03",
              color: "orange",
              title: "The Gut-Feel Forecast",
              scene: "Q4 demand planning meeting. The ops team asks: what do we order?",
              problem: "SKU-level trend data sits in SAP tables. The analyst who knows the queries is on leave. The plan is based on last year's spreadsheet and instinct.",
              cost: "Over-stock on slow-moving accessories. Stockout on flagship laptops.",
            },
            {
              num: "04",
              color: "purple",
              title: "The Unexplained Flag",
              scene: "The ML model flags a customer as 87% churn risk.",
              problem: "The sales manager asks: why? The data scientist says: it's a combination of 12 features across inactivity, sentiment, and case burden. The manager doesn't act.",
              cost: "High-risk customer churns. The model was right. No one trusted it.",
            },
          ].map((s) => (
            <div key={s.num} className={`rounded-xl border p-5 space-y-2 ${symptomBg(s.color)}`}>
              <div className="flex items-center gap-3">
                <span className={`text-xs font-mono font-bold ${symptomNum(s.color)}`}>{s.num}</span>
                <h3 className="font-bold text-base">{s.title}</h3>
              </div>
              <p className={`text-xs font-medium italic ${symptomNum(s.color)}`}>{s.scene}</p>
              <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">{s.problem}</p>
              <div className="flex items-start gap-2">
                <TrendingDown size={13} className="text-red-500 mt-0.5 shrink-0" />
                <p className="text-xs font-medium text-red-600 dark:text-red-400">{s.cost}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── How We Solve It ──────────────────────────────────────── */}
      <div className="space-y-5">
        <div>
          <h2 className="text-2xl font-bold">How Deal2Delivery Solves It</h2>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
            One lakehouse. Both systems. Every insight. No excuses.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 gap-3">
          {[
            { icon: Database, title: "Unified data", desc: "SAP HANA + Salesforce CRM ingested into a single Delta Lakehouse — one source of truth, governed by Unity Catalog.", color: "blue" },
            { icon: Zap, title: "Proactive churn detection", desc: "XGBoost model trained on 30+ behavioural signals flags at-risk customers weeks before they go silent.", color: "purple" },
            { icon: Package, title: "Inventory intelligence", desc: "SAP MARD stock joined with 6-month ML demand forecast. Critical gaps visible before the sales call is even made.", color: "orange" },
            { icon: Users, title: "Explainable AI", desc: "Every churn flag comes with an GPT-4o explanation in plain English. Sales reps trust it because they understand it.", color: "green" },
          ].map(({ icon: Icon, title, desc, color }) => (
            <div key={title} className={`rounded-xl border p-4 space-y-2 ${statBg(color)}`}>
              <div className="flex items-center gap-2">
                <Icon size={16} className={statIcon(color)} />
                <p className="font-semibold text-sm">{title}</p>
              </div>
              <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── CTA ──────────────────────────────────────────────────── */}
      <div className="border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/30 rounded-xl p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <p className="font-bold text-base">Ready to see the live data?</p>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            Every chart and ML prediction below is live from Databricks.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 shrink-0">
          <Link href="/dashboard" className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors">
            Dashboard <ArrowRight size={14} />
          </Link>
          <Link href="/about" className="flex items-center gap-1.5 px-4 py-2 border border-gray-300 dark:border-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
            Architecture
          </Link>
        </div>
      </div>

    </div>
  );
}

/* ── Helpers ─────────────────────────────────────────────────── */

function SiloCard({ color, system, role, knows, blind }: {
  color: "blue" | "orange"; system: string; role: string;
  knows: string[]; blind: string[];
}) {
  const border = color === "blue" ? "border-blue-200 dark:border-blue-800" : "border-orange-200 dark:border-orange-800";
  const bg     = color === "blue" ? "bg-blue-50 dark:bg-blue-950/30"       : "bg-orange-50 dark:bg-orange-950/30";
  const head   = color === "blue" ? "text-blue-700 dark:text-blue-400"     : "text-orange-700 dark:text-orange-400";
  return (
    <div className={`border ${border} ${bg} rounded-xl p-5 space-y-4`}>
      <div>
        <p className={`font-bold text-sm ${head}`}>{system}</p>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{role}</p>
      </div>
      <div className="space-y-1.5">
        <p className="text-xs font-semibold text-green-600 dark:text-green-400">Knows</p>
        {knows.map((k) => (
          <div key={k} className="flex items-start gap-2 text-xs text-gray-600 dark:text-gray-400">
            <CheckCircle size={12} className="text-green-500 mt-0.5 shrink-0" />{k}
          </div>
        ))}
      </div>
      <div className="space-y-1.5">
        <p className="text-xs font-semibold text-red-500">Blind to</p>
        {blind.map((b) => (
          <div key={b} className="flex items-start gap-2 text-xs text-gray-600 dark:text-gray-400">
            <XCircle size={12} className="text-red-400 mt-0.5 shrink-0" />{b}
          </div>
        ))}
      </div>
    </div>
  );
}

function statBg(c: string) {
  return {
    blue:   "border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/20",
    green:  "border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950/20",
    orange: "border-orange-200 dark:border-orange-800 bg-orange-50 dark:bg-orange-950/20",
    purple: "border-purple-200 dark:border-purple-800 bg-purple-50 dark:bg-purple-950/20",
    red:    "border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/20",
    amber:  "border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/20",
  }[c] ?? "";
}
function statIcon(c: string) {
  return {
    blue:   "text-blue-500",   green:  "text-green-500",
    orange: "text-orange-500", purple: "text-purple-500",
    red:    "text-red-500",    amber:  "text-amber-500",
  }[c] ?? "text-gray-500";
}
function symptomBg(c: string) {
  return {
    red:    "border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/20",
    amber:  "border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/20",
    orange: "border-orange-200 dark:border-orange-800 bg-orange-50 dark:bg-orange-950/20",
    purple: "border-purple-200 dark:border-purple-800 bg-purple-50 dark:bg-purple-950/20",
  }[c] ?? "";
}
function symptomNum(c: string) {
  return {
    red:    "text-red-600 dark:text-red-400",
    amber:  "text-amber-600 dark:text-amber-400",
    orange: "text-orange-600 dark:text-orange-400",
    purple: "text-purple-600 dark:text-purple-400",
  }[c] ?? "text-gray-500";
}
