# Databricks notebook source
# MAGIC %md
# MAGIC # Deal2Delivery — Churn Model v2
# MAGIC
# MAGIC **Improvements over v1:**
# MAGIC - Composite behavioral churn label (5 weighted signals, not just open_case_count)
# MAGIC - Optuna Bayesian hyperparameter tuning (15 trials)
# MAGIC - Stratified 5-fold cross-validation
# MAGIC - Predictions saved to gold table for Next.js app
# MAGIC
# MAGIC **Run all cells top to bottom. No edits needed.**

# COMMAND ----------

# MAGIC %pip install optuna -q

# COMMAND ----------

import mlflow
import mlflow.sklearn
import pandas as pd
import numpy as np
import xgboost as xgb
import optuna

from sklearn.model_selection import StratifiedKFold, cross_val_score
from sklearn.compose import ColumnTransformer
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OrdinalEncoder
from sklearn.metrics import roc_auc_score, f1_score, accuracy_score
from mlflow.models.signature import infer_signature
from mlflow import MlflowClient

optuna.logging.set_verbosity(optuna.logging.WARNING)
mlflow.set_experiment("/Users/vedanthbaliga21@gmail.com/deal2delivery-churn-v2")
print("✅ Imports OK")

# COMMAND ----------

# DBTITLE 1,1. Build features directly from gold views
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

print(f"✅ Loaded {len(features_df)} customers, {len(features_df.columns)} columns")

# COMMAND ----------

# DBTITLE 1,2. Composite behavioral churn label
def norm(s, lo, hi):
    return (s.clip(lo, hi) - lo) / (hi - lo + 1e-9)

inactivity = norm(features_df['days_since_last_order'].fillna(999), 0, 365)
case_load  = norm(features_df['open_case_count'].fillna(0), 0, 8)
sent_risk  = 1 - norm(features_df['avg_sentiment_score'].fillna(0.5), -1, 1)
neg_ratio  = features_df['negative_interactions'].fillna(0) / (features_df['total_interactions'].fillna(1) + 1)
neg_risk   = norm(neg_ratio, 0, 1)
rev_cap    = features_df['total_order_revenue'].quantile(0.9)
rev_risk   = 1 - norm(features_df['total_order_revenue'].fillna(0), 0, rev_cap)

churn_score = (
    0.35 * inactivity +
    0.20 * case_load  +
    0.20 * sent_risk  +
    0.15 * neg_risk   +
    0.10 * rev_risk
)

# Auto-adjust threshold to ensure at least 10 positives for 5-fold CV
threshold = 0.45
if (churn_score > threshold).sum() < 10:
    threshold = float(churn_score.quantile(0.30))
    print(f"⚠️  Threshold adjusted to {threshold:.3f} to ensure enough positives")

features_df['churn_label'] = (churn_score > threshold).astype(int)
features_df['churn_score'] = churn_score.round(4)

pos = features_df['churn_label'].sum()
print(f"✅ Churn positives: {pos} ({pos/len(features_df)*100:.1f}%)  |  Healthy: {len(features_df)-pos}")

# COMMAND ----------

# DBTITLE 1,3. Prepare X / y
cat_cols = ['recency_segment','frequency_segment','monetary_segment',
            'country_code','city','sf_industry']
exclude  = ['customer_number','customer_name','churn_label','churn_score']
num_cols = [c for c in features_df.columns if c not in exclude + cat_cols]

for c in num_cols:
    features_df[c] = pd.to_numeric(features_df[c], errors='coerce').fillna(0)
for c in cat_cols:
    features_df[c] = features_df[c].fillna('UNKNOWN').astype(str)

X = features_df[num_cols + cat_cols]
y = features_df['churn_label']

preprocessor = ColumnTransformer(
    [('cat', OrdinalEncoder(handle_unknown='use_encoded_value', unknown_value=-1), cat_cols)],
    remainder='passthrough'
)
print(f"✅ X shape: {X.shape}   Positive rate: {y.mean():.2%}")

# COMMAND ----------

# DBTITLE 1,4. Optuna hyperparameter tuning (15 trials)
def objective(trial):
    params = dict(
        max_depth        = trial.suggest_int('max_depth', 2, 6),
        learning_rate    = trial.suggest_float('lr', 0.01, 0.3, log=True),
        n_estimators     = trial.suggest_int('n_est', 50, 300),
        min_child_weight = trial.suggest_int('mcw', 1, 10),
        subsample        = trial.suggest_float('sub', 0.5, 1.0),
        colsample_bytree = trial.suggest_float('col', 0.5, 1.0),
        gamma            = trial.suggest_float('gamma', 0.0, 5.0),
        reg_alpha        = trial.suggest_float('alpha', 0.0, 2.0),
        reg_lambda       = trial.suggest_float('lam', 0.0, 2.0),
    )
    pipe = Pipeline([
        ('pre', preprocessor),
        ('m', xgb.XGBClassifier(
            **params, objective='binary:logistic', eval_metric='auc',
            random_state=42, verbosity=0,
            scale_pos_weight=(len(y) - y.sum()) / (y.sum() + 1e-9)
        ))
    ])
    try:
        cv = StratifiedKFold(n_splits=5, shuffle=True, random_state=42)
        return float(cross_val_score(pipe, X, y, cv=cv, scoring='roc_auc').mean())
    except Exception:
        return 0.5

study = optuna.create_study(direction='maximize')
study.optimize(objective, n_trials=15, show_progress_bar=True)
print(f"\n✅ Best CV AUC : {study.best_value:.4f}")
print(f"   Best params : {study.best_params}")

# COMMAND ----------

# DBTITLE 1,5. Train final model + evaluate
best = study.best_params
final_pipe = Pipeline([
    ('pre', preprocessor),
    ('m', xgb.XGBClassifier(
        **best, objective='binary:logistic', eval_metric='auc',
        random_state=42, verbosity=0,
        scale_pos_weight=(len(y) - y.sum()) / (y.sum() + 1e-9)
    ))
])

cv = StratifiedKFold(n_splits=5, shuffle=True, random_state=42)
cv_auc = cross_val_score(final_pipe, X, y, cv=cv, scoring='roc_auc')
cv_f1  = cross_val_score(final_pipe, X, y, cv=cv, scoring='f1')

final_pipe.fit(X, y)
y_proba = final_pipe.predict_proba(X)[:, 1]
y_pred  = final_pipe.predict(X)

print(f"✅ CV AUC  : {cv_auc.mean():.4f} +/- {cv_auc.std():.4f}")
print(f"   CV F1   : {cv_f1.mean():.4f} +/- {cv_f1.std():.4f}")
print(f"   Train AUC (full data): {roc_auc_score(y, y_proba):.4f}")

xgb_model = final_pipe.named_steps['m']
fi = pd.DataFrame({'feature': num_cols + cat_cols,
                   'importance': xgb_model.feature_importances_})
print("\n🔝 Top 10 features:")
print(fi.sort_values('importance', ascending=False).head(10).to_string(index=False))

# COMMAND ----------

# DBTITLE 1,6. Log to MLflow + register @champion
MODEL_NAME = "demand-forecast.gold_pres.deal2delivery_churn_model"
sig = infer_signature(X, y_proba)

with mlflow.start_run(run_name="churn-v2-optuna-champion") as run:
    mlflow.log_params(best)
    mlflow.log_metrics({
        "cv_auc_mean":    float(cv_auc.mean()),
        "cv_auc_std":     float(cv_auc.std()),
        "cv_f1_mean":     float(cv_f1.mean()),
        "train_auc":      float(roc_auc_score(y, y_proba)),
        "train_f1":       float(f1_score(y, y_pred)),
        "train_accuracy": float(accuracy_score(y, y_pred)),
        "positive_rate":  float(y.mean()),
    })
    mlflow.sklearn.log_model(final_pipe, "model", signature=sig,
                             registered_model_name=MODEL_NAME)
    run_id = run.info.run_id

client = MlflowClient()
versions = client.get_latest_versions(MODEL_NAME)
latest   = max(versions, key=lambda v: int(v.version)).version
client.set_registered_model_alias(MODEL_NAME, "champion", latest)
client.update_registered_model(MODEL_NAME,
    description="Churn v2: composite behavioral label + Optuna XGBoost + 5-fold CV.")

print(f"✅ Registered: {MODEL_NAME}@champion  (version {latest})")
print(f"   Run ID: {run_id}")

# COMMAND ----------

# DBTITLE 1,7. Save predictions to gold table (used by Next.js via SQL)
pred_df = features_df[['customer_number','customer_name','sf_industry','churn_score']].copy()
pred_df['churn_probability'] = y_proba.round(4)
pred_df['churn_prediction']  = y_pred.tolist()
pred_df['risk_tier'] = pd.cut(
    pred_df['churn_probability'],
    bins=[0, 0.35, 0.60, 1.01],
    labels=['Low', 'Medium', 'High']
).astype(str)
pred_df['model_version']   = str(latest)
pred_df['prediction_date'] = pd.Timestamp.today().date().isoformat()

spark.createDataFrame(pred_df).write.mode("overwrite") \
    .saveAsTable("`demand-forecast`.gold_pres.churn_predictions")

print(f"✅ Saved to demand-forecast.gold_pres.churn_predictions")
print(pred_df[['customer_name','sf_industry','churn_probability','risk_tier']]
      .sort_values('churn_probability', ascending=False).head(10).to_string(index=False))
