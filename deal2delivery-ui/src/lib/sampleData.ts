import type {
  ForecastRow, ProductRow, Customer,
  SegmentStat, InventoryRow, InventoryResponse, SimulateRow,
} from "@/components/AppDataProvider";

export const SAMPLE_KPIS: Record<string, string> = {
  total_customers:        "70",
  total_revenue:          "9247832",
  at_risk_rule_based:     "13",
  avg_days_since_order:   "47",
  avg_revenue_per_customer: "132112",
};

// 24 months of monthly trend data
const MONTHS = [
  "2023-07","2023-08","2023-09","2023-10","2023-11","2023-12",
  "2024-01","2024-02","2024-03","2024-04","2024-05","2024-06",
  "2024-07","2024-08","2024-09","2024-10","2024-11","2024-12",
  "2025-01","2025-02","2025-03","2025-04","2025-05","2025-06",
];
const BASE_REV = 340000;
const SEASONAL: Record<string, number> = {
  "01":0.80,"02":0.86,"03":1.10,"04":0.92,"05":1.00,"06":1.14,
  "07":0.85,"08":0.81,"09":1.20,"10":1.28,"11":1.55,"12":1.38,
};
export const SAMPLE_TRENDS: Record<string, string>[] = MONTHS.map((p, i) => {
  const m = p.slice(-2);
  const growth = 1 + i * 0.008;
  const rev = Math.round(BASE_REV * (SEASONAL[m] ?? 1) * growth);
  const qty = Math.round(rev / 820);
  return { period: p, revenue: String(rev), qty: String(qty), active_customers: "58" };
});

// 6 future months of forecast
const FORECAST_MONTHS = ["2025-07","2025-08","2025-09","2025-10","2025-11","2025-12"];
const CATS = ["CLOUD","SOFTW","SERV"];
export const SAMPLE_FORECAST_ROWS: ForecastRow[] = FORECAST_MONTHS.flatMap((p) => {
  const [yr, mo] = p.split("-");
  return CATS.map((cat) => ({
    period: p, order_year: yr, order_month: mo,
    product_category: cat,
    predicted_qty: String(Math.round(60 + Math.random() * 40)),
    is_forecast: "true",
  }));
});

export const SAMPLE_PRODUCTS: ProductRow[] = [
  { product_description: "Cloud Storage - 1TB",               product_category: "CLOUD", revenue: "2140000", qty: "1430", growth_rate: "8.2",  quantity_last_90_days: "380", quantity_prev_90_days: "351" },
  { product_description: "Cloud Compute - VM Instance",       product_category: "CLOUD", revenue: "1820000", qty: "1210", growth_rate: "5.1",  quantity_last_90_days: "320", quantity_prev_90_days: "304" },
  { product_description: "Database Service - Standard",       product_category: "CLOUD", revenue: "1340000", qty: "890",  growth_rate: "-3.4", quantity_last_90_days: "215", quantity_prev_90_days: "223" },
  { product_description: "Database Service - Premium",        product_category: "CLOUD", revenue: "980000",  qty: "620",  growth_rate: "2.7",  quantity_last_90_days: "165", quantity_prev_90_days: "160" },
  { product_description: "API Management Platform",           product_category: "SOFTW", revenue: "870000",  qty: "1140", growth_rate: "12.4", quantity_last_90_days: "310", quantity_prev_90_days: "276" },
  { product_description: "Security Suite - Enterprise",       product_category: "SOFTW", revenue: "620000",  qty: "820",  growth_rate: "-1.8", quantity_last_90_days: "198", quantity_prev_90_days: "202" },
  { product_description: "Analytics Platform",                product_category: "SOFTW", revenue: "540000",  qty: "710",  growth_rate: "6.9",  quantity_last_90_days: "195", quantity_prev_90_days: "183" },
  { product_description: "ML Model Training Credits",         product_category: "SOFTW", revenue: "390000",  qty: "960",  growth_rate: "18.3", quantity_last_90_days: "280", quantity_prev_90_days: "237" },
  { product_description: "Professional Services - Consulting",product_category: "SERV",  revenue: "290000",  qty: "2100", growth_rate: "-5.2", quantity_last_90_days: "490", quantity_prev_90_days: "517" },
  { product_description: "Support Contract - Premium",        product_category: "SERV",  revenue: "140000",  qty: "1850", growth_rate: "1.1",  quantity_last_90_days: "460", quantity_prev_90_days: "455" },
  { product_description: "Data Integration Tool",             product_category: "SERV",  revenue: "88000",   qty: "1420", growth_rate: "3.4",  quantity_last_90_days: "365", quantity_prev_90_days: "353" },
  { product_description: "Backup & Recovery Service",         product_category: "SERV",  revenue: "61000",   qty: "980",  growth_rate: "-2.1", quantity_last_90_days: "235", quantity_prev_90_days: "240" },
];

export const SAMPLE_CUSTOMERS: Customer[] = [
  { customer_number:"C001", customer_name:"Apex Technologies",    industry:"Technology",          churn_probability:"0.87", risk_tier:"High",   revenue:"420000", days_since_last_order:"94",  open_case_count:"4", sentiment:"-0.4", customer_health_status:"At Risk",    score_source:"ml", segment_name:"Hibernating" },
  { customer_number:"C002", customer_name:"Meridian Finance",     industry:"Financial Services",  churn_probability:"0.79", risk_tier:"High",   revenue:"318000", days_since_last_order:"78",  open_case_count:"3", sentiment:"-0.2", customer_health_status:"At Risk",    score_source:"ml", segment_name:"At-Risk" },
  { customer_number:"C003", customer_name:"Solaris Healthcare",   industry:"Healthcare",          churn_probability:"0.71", risk_tier:"High",   revenue:"267000", days_since_last_order:"61",  open_case_count:"5", sentiment:"-0.5", customer_health_status:"At Risk",    score_source:"ml", segment_name:"Hibernating" },
  { customer_number:"C004", customer_name:"Nova Retail Group",    industry:"Retail",              churn_probability:"0.64", risk_tier:"High",   revenue:"198000", days_since_last_order:"55",  open_case_count:"2", sentiment:"-0.1", customer_health_status:"At Risk",    score_source:"ml", segment_name:"At-Risk" },
  { customer_number:"C005", customer_name:"Quantum Logistics",    industry:"Logistics",           churn_probability:"0.58", risk_tier:"Medium", revenue:"445000", days_since_last_order:"42",  open_case_count:"1", sentiment:"0.1",  customer_health_status:"Needs Attention", score_source:"ml", segment_name:"At-Risk" },
  { customer_number:"C006", customer_name:"Titan Manufacturing",  industry:"Manufacturing",       churn_probability:"0.51", risk_tier:"Medium", revenue:"382000", days_since_last_order:"38",  open_case_count:"2", sentiment:"0.0",  customer_health_status:"Needs Attention", score_source:"ml", segment_name:"At-Risk" },
  { customer_number:"C007", customer_name:"Iris Consulting",      industry:"Professional Services",churn_probability:"0.44", risk_tier:"Medium", revenue:"231000", days_since_last_order:"31",  open_case_count:"1", sentiment:"0.2",  customer_health_status:"Needs Attention", score_source:"ml", segment_name:"Loyal" },
  { customer_number:"C008", customer_name:"Harbor Energy",        industry:"Energy",              churn_probability:"0.39", risk_tier:"Medium", revenue:"290000", days_since_last_order:"28",  open_case_count:"0", sentiment:"0.3",  customer_health_status:"Needs Attention", score_source:"ml", segment_name:"Loyal" },
  { customer_number:"C009", customer_name:"Crestwood Pharma",     industry:"Healthcare",          churn_probability:"0.21", risk_tier:"Low",    revenue:"567000", days_since_last_order:"14",  open_case_count:"0", sentiment:"0.6",  customer_health_status:"Healthy",    score_source:"ml", segment_name:"Champions" },
  { customer_number:"C010", customer_name:"BlueWave Digital",     industry:"Technology",          churn_probability:"0.15", risk_tier:"Low",    revenue:"634000", days_since_last_order:"8",   open_case_count:"0", sentiment:"0.7",  customer_health_status:"Healthy",    score_source:"ml", segment_name:"Champions" },
  { customer_number:"C011", customer_name:"Summit Aerospace",     industry:"Aerospace",           churn_probability:"0.12", risk_tier:"Low",    revenue:"489000", days_since_last_order:"11",  open_case_count:"1", sentiment:"0.5",  customer_health_status:"Healthy",    score_source:"ml", segment_name:"Champions" },
  { customer_number:"C012", customer_name:"Orion Financial",      industry:"Financial Services",  churn_probability:"0.09", risk_tier:"Low",    revenue:"721000", days_since_last_order:"6",   open_case_count:"0", sentiment:"0.8",  customer_health_status:"Healthy",    score_source:"ml", segment_name:"Champions" },
];

export const SAMPLE_SEGMENTS: SegmentStat[] = [
  { segment_name:"Champions",   customer_count:"18", avg_revenue:"524000", avg_churn_pct:"8.2",  avg_days_silent:"9"  },
  { segment_name:"Loyal",       customer_count:"22", avg_revenue:"298000", avg_churn_pct:"24.1", avg_days_silent:"26" },
  { segment_name:"At-Risk",     customer_count:"14", avg_revenue:"187000", avg_churn_pct:"58.3", avg_days_silent:"44" },
  { segment_name:"Hibernating", customer_count:"10", avg_revenue:"143000", avg_churn_pct:"76.4", avg_days_silent:"82" },
  { segment_name:"Prospects",   customer_count:"6",  avg_revenue:"67000",  avg_churn_pct:"18.7", avg_days_silent:"15" },
];

const INV_SKUS = [
  { mat:"P100001", desc:"Cloud Storage - 1TB",                cat:"CLOUD", fc:420, stk:280, ss:80,  rp:120 },
  { mat:"P100002", desc:"Cloud Compute - VM Instance",        cat:"CLOUD", fc:310, stk:410, ss:60,  rp:100 },
  { mat:"P100003", desc:"Database Service - Standard",        cat:"CLOUD", fc:260, stk:90,  ss:50,  rp:90  },
  { mat:"P100004", desc:"Database Service - Premium",         cat:"CLOUD", fc:180, stk:220, ss:40,  rp:70  },
  { mat:"P100005", desc:"API Management Platform",            cat:"SOFTW", fc:340, stk:180, ss:70,  rp:110 },
  { mat:"P100006", desc:"Security Suite - Enterprise",        cat:"SOFTW", fc:240, stk:310, ss:50,  rp:90  },
  { mat:"P100007", desc:"Analytics Platform",                 cat:"SOFTW", fc:210, stk:270, ss:45,  rp:80  },
  { mat:"P100008", desc:"ML Model Training Credits",          cat:"SOFTW", fc:290, stk:60,  ss:55,  rp:95  },
  { mat:"P100009", desc:"Professional Services - Consulting", cat:"SERV",  fc:620, stk:810, ss:120, rp:200 },
  { mat:"P100010", desc:"Support Contract - Premium",         cat:"SERV",  fc:540, stk:490, ss:100, rp:180 },
  { mat:"P100011", desc:"Data Integration Tool",              cat:"SERV",  fc:420, stk:380, ss:80,  rp:140 },
  { mat:"P100012", desc:"Backup & Recovery Service",          cat:"SERV",  fc:290, stk:340, ss:60,  rp:100 },
];

function riskLevel(stk: number, fc: number): "Critical" | "Warning" | "OK" {
  const pct = (stk / fc) * 100;
  return pct < 80 ? "Critical" : pct < 120 ? "Warning" : "OK";
}

export const SAMPLE_INVENTORY: InventoryResponse = (() => {
  const rows: InventoryRow[] = INV_SKUS.map((s) => {
    const gap = s.stk - s.fc;
    const cov = Math.round((s.stk / s.fc) * 100);
    return {
      material_number: s.mat, product_description: s.desc, product_category: s.cat,
      forecast_qty_6m: String(s.fc), current_stock: String(s.stk),
      safety_stock: String(s.ss), reorder_point: String(s.rp),
      stock_gap: String(gap), coverage_pct: String(cov),
      gap_risk_level: riskLevel(s.stk, s.fc),
    };
  });
  return {
    rows,
    critical_count: rows.filter((r) => r.gap_risk_level === "Critical").length,
    warning_count:  rows.filter((r) => r.gap_risk_level === "Warning").length,
  };
})();

export const SAMPLE_SIMULATE_ROWS: SimulateRow[] = FORECAST_MONTHS.flatMap((p) => {
  const [yr, mo] = p.split("-");
  return CATS.map((cat, ci) => ({
    period: p, order_year: yr, order_month: mo,
    product_category: cat, material_number: `P10000${ci + 1}`,
    base_qty: String(Math.round(55 + Math.random() * 35)),
    scenario_qty: String(Math.round(55 + Math.random() * 35)),
  }));
});
