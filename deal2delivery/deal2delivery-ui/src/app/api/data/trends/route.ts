import { NextResponse } from "next/server";
import { query } from "@/lib/databricks";

export const revalidate = 300;

export async function GET() {
  try {
    const rows = await query(`
      SELECT
        CONCAT(order_year, '-', LPAD(CAST(order_month AS STRING), 2, '0')) AS period,
        ROUND(SUM(total_revenue), 0)       AS revenue,
        SUM(total_quantity_ordered)        AS qty,
        COUNT(DISTINCT customer_number)    AS active_customers
      FROM \`demand-forecast\`.gold_pres.gold_product_demand_forecast
      GROUP BY order_year, order_month
      ORDER BY order_year, order_month
    `);
    return NextResponse.json(rows);
  } catch (e: unknown) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
