# Databricks notebook source
# DBTITLE 1,Customer Segmentation — K-Means RFM Clustering
# MAGIC %md
# MAGIC # Customer Segmentation — K-Means RFM Clustering
# MAGIC
# MAGIC Clusters customers into 5 behavioural segments using K-Means on RFM-style features:
# MAGIC - **Champions** — Recent, high-revenue, high-engagement
# MAGIC - **Loyal** — Regular buyers with positive sentiment
# MAGIC - **At-Risk** — Previously valuable, now going quiet
# MAGIC - **Hibernating** — Long dormant, low engagement
# MAGIC - **Prospects** — New or low-value, recent activity
# MAGIC
# MAGIC Output: `demand-forecast.gold_pres.customer_segments`
# MAGIC MLflow model: `demand-forecast.gold_pres.deal2delivery_customer_segments@champion`

# COMMAND ----------

# DBTITLE 1,Install Dependencies
# MAGIC %pip install scikit-learn mlflow --quiet

# COMMAND ----------

# DBTITLE 1,Configuration
import mlflow
import mlflow.sklearn
import numpy as np
import pandas as pd
from sklearn.cluster import KMeans
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import silhouette_score
from pyspark.sql import functions as F

CATALOG      = "demand-forecast"
GOLD_SCHEMA  = "gold_pres"
N_CLUSTERS   = 5
RANDOM_STATE = 42
MODEL_NAME   = f"{CATALOG}.{GOLD_SCHEMA}.deal2delivery_customer_segments"
OUTPUT_TABLE = f"`{CATALOG}`.{GOLD_SCHEMA}.customer_segments"

mlflow.set_experiment(f"/Users/vedanthbaliga21@gmail.com/deal2delivery-customer-segmentation")
print("Configuration loaded.")

# COMMAND ----------

# DBTITLE 1,Load Feature Data
features_df = spark.sql(f"""
    SELECT
        mch.customer_number,
        mch.customer_name,
        COALESCE(mch.total_order_revenue, 0)    AS total_order_revenue,
        COALESCE(mch.order_count, 0)            AS order_count,
        COALESCE(mch.days_since_last_order, 365) AS days_since_last_order,
        COALESCE(mch.avg_sentiment_score, 0)    AS avg_sentiment_score,
        COALESCE(mch.open_case_count, 0)        AS open_case_count,
        COALESCE(
            eng.engagements_last_90d, 0
        )                                       AS engagements_last_90d
    FROM `{CATALOG}`.{GOLD_SCHEMA}.metrics_customer_health mch
    LEFT JOIN (
        SELECT
            customer_number,
            COUNT(*) AS engagements_last_90d
        FROM `{CATALOG}`.{GOLD_SCHEMA}.gold_customer_engagement_360
        WHERE engagement_date >= DATE_SUB(current_date(), 90)
          AND customer_number IS NOT NULL
        GROUP BY customer_number
    ) eng ON mch.customer_number = eng.customer_number
    WHERE mch.customer_number IS NOT NULL
""").toPandas()

print(f"Loaded {len(features_df)} customers for segmentation.")
features_df.head()

# COMMAND ----------

# DBTITLE 1,Normalize Features
FEATURE_COLS = [
    "total_order_revenue",
    "order_count",
    "days_since_last_order",
    "avg_sentiment_score",
    "open_case_count",
    "engagements_last_90d",
]

X = features_df[FEATURE_COLS].values
scaler = StandardScaler()
X_scaled = scaler.fit_transform(X)
print(f"Feature matrix shape: {X_scaled.shape}")

# COMMAND ----------

# DBTITLE 1,K-Means Clustering + MLflow Logging
with mlflow.start_run(run_name="customer_segmentation_kmeans") as run:

    kmeans = KMeans(n_clusters=N_CLUSTERS, random_state=RANDOM_STATE, n_init=10)
    labels = kmeans.fit_predict(X_scaled)

    inertia   = kmeans.inertia_
    sil_score = silhouette_score(X_scaled, labels)

    mlflow.log_param("n_clusters",    N_CLUSTERS)
    mlflow.log_param("random_state",  RANDOM_STATE)
    mlflow.log_param("n_features",    len(FEATURE_COLS))
    mlflow.log_metric("inertia",      inertia)
    mlflow.log_metric("silhouette_score", sil_score)

    # Build a simple pipeline object wrapping scaler + kmeans for registration
    from sklearn.pipeline import Pipeline
    pipeline = Pipeline([("scaler", scaler), ("kmeans", kmeans)])

    mlflow.sklearn.log_model(
        sk_model=pipeline,
        artifact_path="model",
        registered_model_name=MODEL_NAME,
    )

    print(f"Inertia:           {inertia:.2f}")
    print(f"Silhouette score:  {sil_score:.4f}")

run_id = run.info.run_id

# Set @champion alias
client = mlflow.MlflowClient()
latest = client.get_registered_model(MODEL_NAME).latest_versions
if latest:
    client.set_registered_model_alias(MODEL_NAME, "champion", latest[-1].version)
    print(f"Set @champion → version {latest[-1].version}")

# COMMAND ----------

# DBTITLE 1,Name Segments from Cluster Centroids
# Inverse-transform centroids back to original scale for interpretability
centroids_orig = scaler.inverse_transform(kmeans.cluster_centers_)
centroid_df = pd.DataFrame(centroids_orig, columns=FEATURE_COLS)
centroid_df["cluster_id"] = range(N_CLUSTERS)

# Score each centroid: high revenue + low days + high orders = Champions
# Rank on composite: revenue_rank - days_rank + orders_rank - open_cases_rank + sentiment_rank
centroid_df["revenue_rank"]    = centroid_df["total_order_revenue"].rank()
centroid_df["days_rank"]       = centroid_df["days_since_last_order"].rank(ascending=False)
centroid_df["orders_rank"]     = centroid_df["order_count"].rank()
centroid_df["sentiment_rank"]  = centroid_df["avg_sentiment_score"].rank()
centroid_df["cases_rank"]      = centroid_df["open_case_count"].rank(ascending=False)
centroid_df["composite"]       = (
    centroid_df["revenue_rank"] * 0.35 +
    centroid_df["days_rank"]    * 0.25 +
    centroid_df["orders_rank"]  * 0.20 +
    centroid_df["sentiment_rank"] * 0.10 +
    centroid_df["cases_rank"]   * 0.10
)

sorted_clusters = centroid_df.sort_values("composite", ascending=False)["cluster_id"].tolist()

SEGMENT_NAMES = {
    sorted_clusters[0]: "Champions",
    sorted_clusters[1]: "Loyal",
    sorted_clusters[2]: "At-Risk",
    sorted_clusters[3]: "Hibernating",
    sorted_clusters[4]: "Prospects",
}

print("Segment assignments:")
for cid, name in SEGMENT_NAMES.items():
    row = centroid_df[centroid_df["cluster_id"] == cid].iloc[0]
    print(f"  Cluster {cid} → {name:<15} | rev={row['total_order_revenue']:.0f}  days={row['days_since_last_order']:.0f}  orders={row['order_count']:.1f}")

# COMMAND ----------

# DBTITLE 1,Compute RFM Score and Assign Segments
features_df["cluster_id"]    = labels
features_df["segment_name"]  = features_df["cluster_id"].map(SEGMENT_NAMES)

# RFM score: 0–100 composite of recency, frequency, monetary (higher = better)
rev_pct  = features_df["total_order_revenue"].rank(pct=True)
freq_pct = features_df["order_count"].rank(pct=True)
rec_pct  = (1 - features_df["days_since_last_order"].rank(pct=True))  # lower days = higher score

features_df["rfm_score"] = ((rev_pct * 0.4 + freq_pct * 0.3 + rec_pct * 0.3) * 100).round(1)

result_df = features_df[["customer_number", "segment_name", "cluster_id", "rfm_score"]].copy()
print(f"Segment distribution:\n{result_df['segment_name'].value_counts()}")

# COMMAND ----------

# DBTITLE 1,Write customer_segments to Gold Table
spark_result = spark.createDataFrame(result_df) \
    .withColumn("model_version", F.lit(run_id)) \
    .withColumn("segmentation_date", F.current_date())

spark_result.write \
    .format("delta") \
    .mode("overwrite") \
    .option("overwriteSchema", "true") \
    .saveAsTable(OUTPUT_TABLE)

count = spark.table(OUTPUT_TABLE).count()
print(f"Written {count} rows to {OUTPUT_TABLE}")
display(spark.table(OUTPUT_TABLE).groupBy("segment_name").count().orderBy("count", ascending=False))
