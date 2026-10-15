import { NextResponse } from "next/server";
import { query } from "@/lib/databricks";

export const revalidate = 300;

export async function GET() {
  try {
    const rows = await query(`
      SELECT
        cs.segment_name,
        COUNT(*)                                                          AS customer_count,
        ROUND(AVG(mch.total_order_revenue))                               AS avg_revenue,
        ROUND(AVG(CAST(cp.churn_probability AS DOUBLE)) * 100, 1)         AS avg_churn_pct,
        ROUND(AVG(mch.days_since_last_order))                             AS avg_days_silent
      FROM \`demand-forecast\`.gold_pres.customer_segments cs
      JOIN \`demand-forecast\`.gold_pres.metrics_customer_health mch
        ON cs.customer_number = mch.customer_number
      LEFT JOIN \`demand-forecast\`.gold_pres.churn_predictions cp
        ON cs.customer_number = cp.customer_number
      GROUP BY cs.segment_name
      ORDER BY avg_revenue DESC
    `);
    return NextResponse.json({ rows });
  } catch (e: unknown) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
