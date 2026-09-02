import { NextResponse } from "next/server";
import { query } from "@/lib/databricks";

export const revalidate = 300;

export async function GET() {
  try {
    // Best: traced predictions with pre-computed LLM explanations
    const rows = await query(`
      SELECT
        ct.customer_number,
        ct.customer_name,
        ct.sf_industry          AS industry,
        ct.churn_probability,
        ct.risk_tier,
        ct.churn_score,
        ct.ai_explanation,
        mch.total_order_revenue AS revenue,
        mch.days_since_last_order,
        mch.open_case_count,
        mch.avg_sentiment_score AS sentiment,
        mch.customer_health_status,
        'ml_traced'             AS score_source,
        cs.segment_name
      FROM \`demand-forecast\`.gold_pres.churn_predictions_traced ct
      LEFT JOIN \`demand-forecast\`.gold_pres.metrics_customer_health mch
        ON ct.customer_number = mch.customer_number
      LEFT JOIN \`demand-forecast\`.gold_pres.customer_segments cs
        ON ct.customer_number = cs.customer_number
      ORDER BY CAST(ct.churn_probability AS DOUBLE) DESC
    `);
    return NextResponse.json(rows);
  } catch {
    try {
      // Fallback 1: plain ML predictions (no explanations)
      const rows = await query(`
        SELECT
          cp.customer_number,
          cp.customer_name,
          cp.sf_industry          AS industry,
          cp.churn_probability,
          cp.risk_tier,
          cp.churn_score,
          NULL                    AS ai_explanation,
          mch.total_order_revenue AS revenue,
          mch.days_since_last_order,
          mch.open_case_count,
          mch.avg_sentiment_score AS sentiment,
          mch.customer_health_status,
          'ml'                    AS score_source,
          cs.segment_name
        FROM \`demand-forecast\`.gold_pres.churn_predictions cp
        LEFT JOIN \`demand-forecast\`.gold_pres.metrics_customer_health mch
          ON cp.customer_number = mch.customer_number
        LEFT JOIN \`demand-forecast\`.gold_pres.customer_segments cs
          ON cp.customer_number = cs.customer_number
        ORDER BY CAST(cp.churn_probability AS DOUBLE) DESC
      `);
      return NextResponse.json(rows);
    } catch {
      try {
        // Fallback 2: rule-based flags
        const rows = await query(`
          SELECT
            mch.customer_number, mch.customer_name,
            mch.sf_industry              AS industry,
            CASE WHEN churn_risk_flag THEN 0.75 ELSE 0.25 END AS churn_probability,
            CASE WHEN churn_risk_flag THEN 'High' ELSE 'Low'  END AS risk_tier,
            NULL AS churn_score, NULL AS ai_explanation,
            mch.total_order_revenue      AS revenue,
            mch.days_since_last_order,   mch.open_case_count,
            mch.avg_sentiment_score      AS sentiment,
            mch.customer_health_status,
            'rule_based'                 AS score_source,
            cs.segment_name
          FROM \`demand-forecast\`.gold_pres.metrics_customer_health mch
          LEFT JOIN \`demand-forecast\`.gold_pres.customer_segments cs
            ON mch.customer_number = cs.customer_number
          ORDER BY churn_risk_flag DESC, days_since_last_order DESC
        `);
        return NextResponse.json(rows);
      } catch (e: unknown) {
        return NextResponse.json({ error: (e as Error).message }, { status: 500 });
      }
    }
  }
}
