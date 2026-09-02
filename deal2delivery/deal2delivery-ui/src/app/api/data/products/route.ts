import { NextResponse } from "next/server";
import { query } from "@/lib/databricks";

export const revalidate = 300;

export async function GET() {
  try {
    // Query silver fact table directly — avoids window-function aggregation issues
    // with gold_product_demand_forecast view
    const rows = await query(`
      SELECT
        product_description,
        product_category,
        ROUND(SUM(line_net_value), 0)                                          AS revenue,
        SUM(quantity)                                                           AS qty,
        COUNT(DISTINCT order_number)                                            AS order_count,
        ROUND(
          (
            SUM(CASE WHEN order_date >= DATE_SUB(CURRENT_DATE, 90)
                     THEN quantity ELSE 0 END) -
            SUM(CASE WHEN order_date >= DATE_SUB(CURRENT_DATE, 180)
                      AND order_date <  DATE_SUB(CURRENT_DATE, 90)
                     THEN quantity ELSE 0 END)
          ) / NULLIF(
            SUM(CASE WHEN order_date >= DATE_SUB(CURRENT_DATE, 180)
                      AND order_date <  DATE_SUB(CURRENT_DATE, 90)
                     THEN quantity ELSE 0 END)
          , 0) * 100
        , 1)                                                                    AS growth_rate,
        SUM(CASE WHEN order_date >= DATE_SUB(CURRENT_DATE, 90)
                 THEN quantity ELSE 0 END)                                      AS quantity_last_90_days,
        SUM(CASE WHEN order_date >= DATE_SUB(CURRENT_DATE, 180)
                  AND order_date <  DATE_SUB(CURRENT_DATE, 90)
                 THEN quantity ELSE 0 END)                                      AS quantity_prev_90_days
      FROM \`demand-forecast\`.silver.fact_sap_orders
      WHERE product_description IS NOT NULL
      GROUP BY product_description, product_category
      ORDER BY revenue DESC
    `);
    return NextResponse.json(rows);
  } catch (e: unknown) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
