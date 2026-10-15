# Databricks notebook source
# MAGIC %md
# MAGIC # Deal2Delivery — Churn Inference with MLflow Tracing
# MAGIC
# MAGIC Batch-scores all customers using the `@champion` churn model and logs every
# MAGIC prediction as an **MLflow trace** — making the Traces tab come alive with
# MAGIC per-customer churn analysis chains.
# MAGIC
# MAGIC **Trace structure per customer:**
# MAGIC ```
# MAGIC score_customer  [CHAIN]
# MAGIC   ├── model_prediction  [retriever] → churn_probability, risk_tier
# MAGIC   └── llm_explanation   [llm]       → plain-English risk narrative
# MAGIC ```
# MAGIC
# MAGIC **Run all cells top to bottom. No edits needed.**

# COMMAND ----------

# MAGIC %pip install openai -q

# COMMAND ----------

import mlflow
import mlflow.sklearn
import pandas as pd
import numpy as np
from mlflow.entities import SpanType
from databricks.sdk import WorkspaceClient

MODEL_NAME  = "demand-forecast.gold_pres.deal2delivery_churn_model"
EXPERIMENT  = "/Users/vedanthbaliga21@gmail.com/deal2delivery-churn-v2"
OUTPUT_TBL  = "`demand-forecast`.gold_pres.churn_predictions_traced"

mlflow.set_experiment(EXPERIMENT)
w = WorkspaceClient()
print("✅ Setup complete")

# COMMAND ----------

# DBTITLE 1,1. Load champion model from Unity Catalog
model = mlflow.sklearn.load_model(f"models:/{MODEL_NAME}@champion")
print(f"✅ Loaded {MODEL_NAME}@champion")

# COMMAND ----------

# DBTITLE 1,2. Load customer features from gold views
features_df = spark.sql("""
  WITH customer_base AS (
    SELECT
      customer_number, customer_name, country_code, city, sf_industry,
      total_order_revenue, order_count, avg_order_line_value,
      days_since_last_order, total_interactions,
      positive_interactions, negative_interactions, escalated_interactions,
      COALESCE(avg_sentiment_score, 0.5) AS avg_sentiment_score,
      open_case_count, total_cases,
      COALESCE(avg_resolution_days, 0)   AS avg_resolution_days,
      lifetime_opportunity_value, won_opportunities
    FROM `demand-forecast`.gold_pres.metrics_customer_health
  ),
  engagement AS (
    SELECT
      customer_number,
      COUNT(CASE WHEN DATEDIFF(CURRENT_DATE(), DATE(engagement_date)) <= 30  THEN 1 END) AS eng_30d,
      COUNT(CASE WHEN DATEDIFF(CURRENT_DATE(), DATE(engagement_date)) <= 90  THEN 1 END) AS eng_90d,
      AVG(CASE  WHEN DATEDIFF(CURRENT_DATE(), DATE(engagement_date)) <= 30
                THEN sentiment_score END)                                                 AS sentiment_30d,
      COUNT(CASE WHEN DATEDIFF(CURRENT_DATE(), DATE(engagement_date)) <= 30
                  AND priority = 'High' THEN 1 END)                                      AS hi_pri_30d,
      COUNT(DISTINCT channel)                                                             AS channel_diversity,
      COALESCE(DATEDIFF(CURRENT_DATE(), MAX(DATE(engagement_date))), 999)                AS days_since_eng
    FROM `demand-forecast`.gold_pres.gold_customer_engagement_360
    GROUP BY customer_number
  )
  SELECT
    cb.*,
    COALESCE(e.eng_30d, 0)           AS engagements_last_30d,
    COALESCE(e.eng_90d, 0)           AS engagements_last_90d,
    COALESCE(e.sentiment_30d, 0.5)   AS sentiment_last_30d,
    COALESCE(e.hi_pri_30d, 0)        AS high_priority_last_30d,
    COALESCE(e.channel_diversity, 0) AS channel_diversity,
    COALESCE(e.days_since_eng, 999)  AS days_since_last_engagement,
    CASE WHEN cb.days_since_last_order <= 30 THEN 'Very Recent'
         WHEN cb.days_since_last_order <= 60 THEN 'Recent'
         WHEN cb.days_since_last_order <= 90 THEN 'Moderate'
         ELSE 'At Risk' END AS recency_segment,
    CASE WHEN cb.order_count >= 10 THEN 'High'
         WHEN cb.order_count >= 5  THEN 'Medium'
         ELSE 'Low' END AS frequency_segment,
    CASE WHEN cb.total_order_revenue >= 200000 THEN 'High Value'
         WHEN cb.total_order_revenue >= 100000 THEN 'Medium Value'
         ELSE 'Low Value' END AS monetary_segment,
    CASE WHEN cb.negative_interactions > cb.positive_interactions THEN 1 ELSE 0 END AS negative_sentiment_flag,
    CASE WHEN cb.open_case_count > 0 THEN 1 ELSE 0 END AS has_open_cases,
    CASE WHEN cb.days_since_last_order > 60 THEN 1 ELSE 0 END AS inactive_flag,
    CASE WHEN cb.total_interactions > 0
         THEN CAST(cb.positive_interactions AS DOUBLE) / cb.total_interactions
         ELSE 0.0 END AS positive_interaction_ratio
  FROM customer_base cb
  LEFT JOIN engagement e ON cb.customer_number = e.customer_number
""").toPandas()

cat_cols = ['recency_segment','frequency_segment','monetary_segment','country_code','city','sf_industry']
exclude  = ['customer_number','customer_name']
num_cols = [c for c in features_df.columns if c not in exclude + cat_cols]
for c in num_cols: features_df[c] = pd.to_numeric(features_df[c], errors='coerce').fillna(0)
for c in cat_cols: features_df[c] = features_df[c].fillna('UNKNOWN').astype(str)

META_COLS  = ['customer_number','customer_name']
FEAT_COLS  = num_cols + cat_cols
X          = features_df[FEAT_COLS]
meta       = features_df[META_COLS]

print(f"✅ {len(features_df)} customers ready for scoring")

# COMMAND ----------

# DBTITLE 1,3. LLM helper — Databricks Foundation Models
from openai import OpenAI

_llm_client = None

def get_llm_client():
    global _llm_client
    if _llm_client is None:
        token    = dbutils.notebook.entry_point.getDbutils().notebook().getContext().apiToken().get()
        host     = spark.conf.get("spark.databricks.workspaceUrl")
        _llm_client = OpenAI(
            api_key  = token,
            base_url = f"https://{host}/serving-endpoints"
        )
    return _llm_client

def call_llm(prompt: str, model: str = "databricks-meta-llama-3-3-70b-instruct") -> str:
    """Call Databricks Foundation Models via OpenAI-compatible API."""
    try:
        client = get_llm_client()
        resp = client.chat.completions.create(
            model    = model,
            messages = [
                {"role": "system", "content": "You are a CRM analyst. Be concise and data-specific."},
                {"role": "user",   "content": prompt},
            ],
            max_tokens  = 120,
            temperature = 0.3,
        )
        return resp.choices[0].message.content.strip()
    except Exception as ex:
        return f"[LLM unavailable: {type(ex).__name__}]"

# COMMAND ----------

# DBTITLE 1,4. Traced scoring — one MLflow trace per customer
def build_explanation_prompt(row: pd.Series, prob: float, tier: str) -> str:
    return (
        f"Customer: {row['customer_name']} | Industry: {row['sf_industry']} | "
        f"Revenue: ${float(row['total_order_revenue']):,.0f} | "
        f"Days since last order: {int(row['days_since_last_order'])} | "
        f"Open cases: {int(row['open_case_count'])} | "
        f"Avg sentiment: {float(row['avg_sentiment_score']):.2f} | "
        f"Churn probability: {prob:.0%} ({tier} risk).\n"
        f"In 2 sentences: why is this customer at risk and what one action should the sales team take?"
    )

results = []

for idx, row in features_df.iterrows():
    customer_id   = row['customer_number']
    customer_name = row['customer_name']

    with mlflow.start_run(run_name=f"score_{customer_id}", nested=False):
        # ── CHAIN span wraps the full customer analysis ───────────────
        with mlflow.start_span(
            name      = "score_customer",
            span_type = SpanType.CHAIN,
        ) as chain_span:
            chain_span.set_inputs({"customer_id": customer_id, "customer_name": customer_name})

            # ── Model prediction span ──────────────────────────────────
            with mlflow.start_span(
                name      = "model_prediction",
                span_type = SpanType.RETRIEVER,
            ) as pred_span:
                feat_row = X.iloc[[idx]]
                pred_span.set_inputs(feat_row.to_dict(orient="records")[0])

                prob  = float(model.predict_proba(feat_row)[0, 1])
                tier  = "High" if prob > 0.60 else "Medium" if prob > 0.35 else "Low"
                pred_span.set_outputs({"churn_probability": round(prob, 4), "risk_tier": tier})

            # ── LLM explanation span (High + Medium only) ──────────────
            explanation = ""
            if tier in ("High", "Medium"):
                with mlflow.start_span(
                    name      = "llm_explanation",
                    span_type = SpanType.LLM,
                ) as llm_span:
                    prompt = build_explanation_prompt(row, prob, tier)
                    llm_span.set_inputs({"prompt": prompt})
                    explanation = call_llm(prompt)
                    llm_span.set_outputs({"explanation": explanation})

            chain_span.set_outputs({
                "churn_probability": round(prob, 4),
                "risk_tier":         tier,
                "has_explanation":   bool(explanation),
            })

        mlflow.log_metrics({
            "churn_probability": round(prob, 4),
            "is_high_risk":      1 if tier == "High" else 0,
        })
        mlflow.set_tags({
            "customer_id":   customer_id,
            "customer_name": customer_name,
            "industry":      str(row["sf_industry"]),
            "risk_tier":     tier,
        })

    results.append({
        "customer_number":   customer_id,
        "customer_name":     customer_name,
        "sf_industry":       row["sf_industry"],
        "churn_probability": round(prob, 4),
        "risk_tier":         tier,
        "churn_score":       round(prob, 4),
        "ai_explanation":    explanation,
        "model_version":     "champion",
        "scored_at":         pd.Timestamp.now().isoformat(),
    })
    print(f"  {customer_name:<40} prob={prob:.3f}  tier={tier}")

print(f"\n✅ Scored {len(results)} customers — traces logged to {EXPERIMENT}")

# COMMAND ----------

# DBTITLE 1,5. Save enriched predictions to gold table
result_df = pd.DataFrame(results)
spark.createDataFrame(result_df).write.mode("overwrite").saveAsTable(OUTPUT_TBL)

high   = (result_df.risk_tier == "High").sum()
medium = (result_df.risk_tier == "Medium").sum()
low    = (result_df.risk_tier == "Low").sum()
has_ex = (result_df.ai_explanation != "").sum()

print(f"✅ Saved to demand-forecast.gold_pres.churn_predictions_traced")
print(f"   High: {high}  Medium: {medium}  Low: {low}")
print(f"   AI explanations generated: {has_ex}")
print(f"\nView traces at:")
print(f"  {spark.conf.get('spark.databricks.workspaceUrl')}/ml/experiments/traces")
print(f"\nSample explanations:")
print(result_df[result_df.ai_explanation != ""][["customer_name","risk_tier","churn_probability","ai_explanation"]].head(5).to_string(index=False))
