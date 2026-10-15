"use client";
import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { ThemeToggle } from "./ThemeToggle";
import { useAppData } from "./AppDataProvider";

const NAV = [
  { href: "/",                label: "Backdrop",       desc: "NovaTech story · the gap · 11 problems → Databricks solutions"    },
  { href: "/about",           label: "Architecture",   desc: "SAP+Salesforce pipeline · Bronze/Silver/Gold · Unity Catalog · CI/CD" },
  { href: "/dashboard",       label: "Dashboard",      desc: "Live KPIs · revenue trend · inventory health · GPT-4o AI insights" },
  { href: "/demand-forecast", label: "Forecast",       desc: "6-month XGBoost SKU demand predictions from SAP history"          },
  { href: "/simulator",       label: "Simulator",      desc: "What-if: adjust demand sliders → see stock impact in real time"   },
  { href: "/customer-risk",   label: "Customer Risk",  desc: "ML churn scores · SHAP explanations · flag & escalate actions"    },
  { href: "/genie",           label: "Oracle",         desc: "GPT-4o agent: query Databricks · reorder · flag customers · alerts" },
  { href: "/actions",         label: "War Room",       desc: "Audit trail of all AI-triggered operations persisted to Delta"    },
];

export function NavBar() {
  const path  = usePathname();
  const [open, setOpen] = useState(false);
  const { customers, inventory } = useAppData();

  const highRisk    = customers.filter((c) => c.risk_tier === "High").length;
  const critical    = inventory?.critical_count ?? 0;
  const totalAlerts = highRisk + critical;

  const BADGES: Record<string, number> = {
    "/customer-risk": highRisk,
    "/dashboard":     critical,
  };

  const linkCls = (href: string) =>
    `px-3 py-1.5 rounded-md text-sm transition-colors ${
      path === href
        ? "bg-gray-100 dark:bg-gray-800 font-medium text-gray-900 dark:text-gray-100"
        : "text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
    }`;

  const mobileLinkCls = (href: string) =>
    `block px-3 py-2.5 rounded-md text-sm font-medium transition-colors ${
      path === href
        ? "bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100"
        : "text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800/60"
    }`;

  return (
    <nav className="sticky top-0 z-40 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950">
      <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">

        {/* Logo + alert badge */}
        <div className="flex items-center gap-2.5 shrink-0">
          <span className="font-bold text-base tracking-tight">Deal2Delivery</span>
          {totalAlerts > 0 && (
            <span className="inline-flex items-center gap-1.5 text-xs bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 px-2 py-0.5 rounded-full font-semibold border border-red-200 dark:border-red-800">
              <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse shrink-0" />
              {totalAlerts} alert{totalAlerts !== 1 ? "s" : ""}
            </span>
          )}
        </div>

        {/* Desktop links */}
        <div className="hidden md:flex items-center gap-1 overflow-x-auto">
          {NAV.map((l) => (
            <Link key={l.href} href={l.href} className={linkCls(l.href)} title={l.desc}>
              <span className="flex items-center gap-1">
                {l.label}
                {(BADGES[l.href] ?? 0) > 0 && (
                  <span className="inline-flex items-center justify-center min-w-[16px] h-4 px-1 text-[10px] font-bold bg-red-500 text-white rounded-full leading-none">
                    {BADGES[l.href]}
                  </span>
                )}
              </span>
            </Link>
          ))}
        </div>

        {/* Right side */}
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <button
            onClick={() => setOpen((o) => !o)}
            className="md:hidden p-2 rounded-md text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            aria-label="Toggle menu"
          >
            {open ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      {/* Mobile dropdown */}
      {open && (
        <div className="md:hidden border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 px-3 py-2 space-y-0.5">
          {NAV.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={mobileLinkCls(l.href)}
              onClick={() => setOpen(false)}
            >
              <span className="flex items-center gap-2">
                <span>{l.label}</span>
                {(BADGES[l.href] ?? 0) > 0 && (
                  <span className="inline-flex items-center justify-center min-w-[16px] h-4 px-1 text-[10px] font-bold bg-red-500 text-white rounded-full leading-none">
                    {BADGES[l.href]}
                  </span>
                )}
              </span>
              <span className="block text-xs text-gray-400 dark:text-gray-500 font-normal mt-0.5">{l.desc}</span>
            </Link>
          ))}
        </div>
      )}
    </nav>
  );
}
