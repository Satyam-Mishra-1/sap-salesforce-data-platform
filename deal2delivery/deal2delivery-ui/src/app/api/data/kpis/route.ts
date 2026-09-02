import { NextResponse } from "next/server";
import { query } from "@/lib/databricks";

export const revalidate = 300; // 5-min ISR — Layer 1 cache

export async function GET() {
  try {
    const rows = await query(`
      SELECT
        COUNT(*)                                                AS total_customers,
        ROUND(SUM(total_order_revenue), 0)                     AS total_revenue,
        SUM(CASE WHEN churn_risk_flag THEN 1 ELSE 0 END)       AS at_risk_rule_based,
        ROUND(AVG(days_since_last_order), 0)                   AS avg_days_since_order,
        ROUND(AVG(total_order_revenue), 0)                     AS avg_revenue_per_customer
      FROM \`demand-forecast\`.gold_pres.metrics_customer_health
    `);
    return NextResponse.json(rows[0] ?? {});
  } catch (e: unknown) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
