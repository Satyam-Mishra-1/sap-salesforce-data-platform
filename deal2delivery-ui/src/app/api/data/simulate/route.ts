import { NextResponse } from "next/server";
import { query } from "@/lib/databricks";

export const revalidate = 60;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const rawAdj  = searchParams.get("adjustment") ?? "0";
  const category = searchParams.get("category") ?? "";

  // Validate adjustment is a safe integer in range
  const adjustment = Math.max(-50, Math.min(100, Math.round(Number(rawAdj) || 0)));

  const ALLOWED_CATEGORIES = ["CLOUD", "SOFTW", "SERV"];
  const categoryFilter =
    category && ALLOWED_CATEGORIES.includes(category)
      ? `AND product_category = '${category}'`
      : "";

  try {
    const rows = await query(`
      SELECT
        period,
        order_year,
        order_month,
        product_category,
        material_number,
        CAST(predicted_qty AS DOUBLE)                                     AS base_qty,
        ROUND(CAST(predicted_qty AS DOUBLE) * (1 + ${adjustment} / 100.0)) AS scenario_qty,
        is_forecast
      FROM \`demand-forecast\`.gold_pres.demand_forecast_predictions
      WHERE CAST(is_forecast AS STRING) = 'true'
        ${categoryFilter}
      ORDER BY order_year, order_month, material_number
    `);

    return NextResponse.json({ adjustment, rows });
  } catch (e: unknown) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
