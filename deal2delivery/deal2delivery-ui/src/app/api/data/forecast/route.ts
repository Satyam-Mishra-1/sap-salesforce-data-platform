import { NextResponse } from "next/server";
import { query } from "@/lib/databricks";

export const revalidate = 300;

export async function GET() {
  try {
    // Try ML predictions table first (created by demand_forecast_model.py notebook)
    const rows = await query(`
      SELECT
        period, order_year, order_month,
        product_category,
        ROUND(SUM(predicted_qty), 0) AS predicted_qty,
        CAST(MAX(is_forecast) AS STRING) AS is_forecast
      FROM \`demand-forecast\`.gold_pres.demand_forecast_predictions
      GROUP BY period, order_year, order_month, product_category
      ORDER BY order_year, order_month, product_category
    `);
    return NextResponse.json({ source: "ml_model", rows });
  } catch {
    // Fallback: use rolling average from gold view as simple forecast
    try {
      const rows = await query(`
        SELECT
          CONCAT(order_year, '-', LPAD(CAST(order_month AS STRING), 2, '0')) AS period,
          order_year, order_month, product_category,
          ROUND(SUM(total_quantity_ordered), 0) AS predicted_qty,
          'false' AS is_forecast
        FROM \`demand-forecast\`.gold_pres.gold_product_demand_forecast
        GROUP BY order_year, order_month, product_category
        ORDER BY order_year, order_month, product_category
      `);
      return NextResponse.json({ source: "historical_only", rows });
    } catch (e: unknown) {
      return NextResponse.json({ error: (e as Error).message }, { status: 500 });
    }
  }
}
