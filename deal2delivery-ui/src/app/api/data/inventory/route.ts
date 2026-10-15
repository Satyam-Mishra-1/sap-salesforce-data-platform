import { NextResponse } from "next/server";
import { query } from "@/lib/databricks";

export const revalidate = 300;

export async function GET() {
  try {
    const rows = await query(`
      SELECT
        material_number,
        product_description,
        product_category,
        CAST(forecast_qty_6m  AS DOUBLE) AS forecast_qty_6m,
        CAST(current_stock    AS DOUBLE) AS current_stock,
        CAST(safety_stock     AS DOUBLE) AS safety_stock,
        CAST(reorder_point    AS DOUBLE) AS reorder_point,
        CAST(stock_gap        AS DOUBLE) AS stock_gap,
        CAST(coverage_pct     AS DOUBLE) AS coverage_pct,
        gap_risk_level
      FROM \`demand-forecast\`.gold_pres.gold_demand_vs_supply_gap
      ORDER BY stock_gap DESC
    `);

    const critical_count = rows.filter((r) => r["gap_risk_level"] === "Critical").length;
    const warning_count  = rows.filter((r) => r["gap_risk_level"] === "Warning").length;

    return NextResponse.json({ rows, critical_count, warning_count });
  } catch (e: unknown) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
