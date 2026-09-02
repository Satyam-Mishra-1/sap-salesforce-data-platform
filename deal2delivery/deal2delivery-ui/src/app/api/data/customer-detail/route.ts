import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/databricks";

export const revalidate = 300;

// SAP DB category codes → NovaTech display labels
const CAT_MAP: Record<string, string> = {
  CLOUD: "COMP",
  SOFTW: "MOBI",
  SERV:  "ACCS",
};

// SAP software product names → NovaTech electronics names
const NAME_MAP: Record<string, string> = {
  "Cloud Storage - 1TB":                'Business Laptop Pro 15"',
  "Cloud Compute - VM Instance":        'Ultrabook Slim 13"',
  "Database Service - Standard":        "Workstation Desktop i9",
  "Database Service - Premium":         'All-in-One Desktop 27"',
  "API Management Platform":           "Smartphone Pro Max 256GB",
  "Security Suite - Enterprise":        'Business Tablet 11"',
  "Analytics Platform":                 "Wireless Earbuds Pro",
  "ML Model Training Credits":          "Smartwatch Series 5",
  "Professional Services - Consulting": "USB-C Hub 10-Port",
  "Support Contract - Premium":         "Mechanical Keyboard Wireless",
  "Data Integration Tool":              "4K USB Webcam Pro",
  "Backup & Recovery Service":          "Laptop Stand & Dock",
};

export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  try {
    const rows = await query(`
      SELECT
        product_category,
        COUNT(DISTINCT order_number)          AS order_count,
        SUM(quantity)                         AS total_qty,
        ROUND(AVG(quantity), 1)               AS avg_qty_per_order,
        ROUND(SUM(line_net_value), 0)         AS total_revenue,
        MAX(order_date)                       AS last_order_date
      FROM \`demand-forecast\`.silver.fact_sap_orders
      WHERE customer_number = '${id}'
        AND product_category IS NOT NULL
      GROUP BY product_category
      ORDER BY total_revenue DESC
    `);

    const topProducts = await query(`
      SELECT
        product_description,
        product_category,
        SUM(quantity)                 AS total_qty,
        ROUND(SUM(line_net_value), 0) AS total_revenue,
        COUNT(DISTINCT order_number)  AS order_count
      FROM \`demand-forecast\`.silver.fact_sap_orders
      WHERE customer_number = '${id}'
        AND product_description IS NOT NULL
      GROUP BY product_description, product_category
      ORDER BY total_revenue DESC
      LIMIT 5
    `);

    // Remap raw SAP codes → NovaTech display values
    const categories = (rows as Record<string, string>[]).map((r) => ({
      ...r,
      product_category: CAT_MAP[r.product_category] ?? r.product_category,
    }));

    const mappedProducts = (topProducts as Record<string, string>[]).map((p) => ({
      ...p,
      product_category:    CAT_MAP[p.product_category]    ?? p.product_category,
      product_description: NAME_MAP[p.product_description] ?? p.product_description,
    }));

    return NextResponse.json({ categories, topProducts: mappedProducts });
  } catch (e: unknown) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
