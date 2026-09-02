# Databricks notebook source
# MAGIC %md
# MAGIC # Deal2Delivery — Demand Forecast Model
# MAGIC
# MAGIC XGBoost time-series demand forecast per SKU.
# MAGIC - Uses lag features already in `gold_product_demand_forecast`
# MAGIC - Generates 6-month forward predictions saved to gold table
# MAGIC - Registered to MLflow Unity Catalog as `@champion`
# MAGIC
# MAGIC **No pip installs needed. Run all cells top to bottom.**

# COMMAND ----------

import mlflow
import mlflow.sklearn
import pandas as pd
import numpy as np
import xgboost as xgb

from sklearn.compose import ColumnTransformer
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OrdinalEncoder
from sklearn.metrics import mean_absolute_error, mean_squared_error
from mlflow.models.signature import infer_signature
from mlflow import MlflowClient

mlflow.set_experiment("/Users/vedanthbaliga21@gmail.com/deal2delivery-demand-forecast")
print("✅ Imports OK")

# COMMAND ----------

# DBTITLE 1,1. Load data from gold view
df = spark.sql("""
  SELECT
    material_number,
    product_description,
    product_category,
    order_year,
    order_month,
    SUM(total_quantity_ordered)      AS qty,
    AVG(avg_unit_price)              AS avg_price,
    COUNT(DISTINCT customer_number)  AS unique_customers,
    MAX(rolling_3month_avg_quantity) AS rolling_3m,
    MAX(prev_month_quantity)         AS prev_month,
    MAX(prev_quarter_quantity)       AS prev_quarter
  FROM `demand-forecast`.gold_pres.gold_product_demand_forecast
  GROUP BY material_number, product_description, product_category, order_year, order_month
  ORDER BY material_number, order_year, order_month
""").toPandas()

for c in ['qty','avg_price','unique_customers','rolling_3m','prev_month','prev_quarter']:
    df[c] = pd.to_numeric(df[c], errors='coerce')

print(f"✅ Loaded {len(df)} rows  |  SKUs: {df['material_number'].nunique()}  |  Months: {df[['order_year','order_month']].drop_duplicates().shape[0]}")

# COMMAND ----------

# DBTITLE 1,2. Feature engineering
df = df.sort_values(['material_number','order_year','order_month']).reset_index(drop=True)

# Lag features by SKU
df['lag_1'] = df.groupby('material_number')['qty'].shift(1)
df['lag_2'] = df.groupby('material_number')['qty'].shift(2)
df['lag_3'] = df.groupby('material_number')['qty'].shift(3)
df['roll_3'] = df.groupby('material_number')['qty'].transform(
    lambda x: x.shift(1).rolling(3, min_periods=1).mean())
df['roll_6'] = df.groupby('material_number')['qty'].transform(
    lambda x: x.shift(1).rolling(6, min_periods=1).mean())

# Time features
df['month_sin'] = np.sin(2 * np.pi * df['order_month'] / 12)
df['month_cos'] = np.cos(2 * np.pi * df['order_month'] / 12)
df['time_idx']  = (df['order_year'] - df['order_year'].min()) * 12 + df['order_month']

# Fill nulls per SKU
for c in ['lag_1','lag_2','lag_3','roll_3','roll_6','avg_price','unique_customers',
          'rolling_3m','prev_month','prev_quarter']:
    df[c] = df.groupby('material_number')[c].transform(lambda x: x.fillna(x.median()))

df = df.dropna(subset=['qty']).reset_index(drop=True)
print(f"✅ After feature engineering: {len(df)} rows")

# COMMAND ----------

# DBTITLE 1,3. Train / test split + model
cat_cols  = ['material_number','product_category']
feat_cols = ['order_year','order_month','month_sin','month_cos','time_idx',
             'lag_1','lag_2','lag_3','roll_3','roll_6',
             'avg_price','unique_customers','prev_month','prev_quarter'] + cat_cols

X, y = df[feat_cols], df['qty']

# Time-based split — last 15% as test (most recent months)
split = int(len(df) * 0.85)
X_tr, X_te = X.iloc[:split], X.iloc[split:]
y_tr, y_te = y.iloc[:split], y.iloc[split:]

preprocessor = ColumnTransformer(
    [('cat', OrdinalEncoder(handle_unknown='use_encoded_value', unknown_value=-1), cat_cols)],
    remainder='passthrough'
)
model = xgb.XGBRegressor(
    n_estimators=200, max_depth=5, learning_rate=0.05,
    subsample=0.8, colsample_bytree=0.8,
    min_child_weight=3, random_state=42, verbosity=0
)
pipe = Pipeline([('pre', preprocessor), ('m', model)])
pipe.fit(X_tr, y_tr)

y_pred_te = pipe.predict(X_te)
mae  = mean_absolute_error(y_te, y_pred_te)
rmse = float(np.sqrt(mean_squared_error(y_te, y_pred_te)))
mape = float(np.mean(np.abs((y_te.values - y_pred_te) / (np.abs(y_te.values) + 1))) * 100)

print(f"✅ Test MAE  : {mae:.2f} units")
print(f"   Test RMSE : {rmse:.2f} units")
print(f"   Test MAPE : {mape:.2f}%")

# Refit on full dataset before registration
pipe.fit(X, y)

# COMMAND ----------

# DBTITLE 1,4. Log to MLflow + register @champion
MODEL_NAME = "demand-forecast.gold_pres.deal2delivery_demand_forecast"
sig = infer_signature(X, pipe.predict(X))

with mlflow.start_run(run_name="demand-forecast-xgb-v1") as run:
    mlflow.log_metrics({"test_mae": mae, "test_rmse": rmse, "test_mape": mape})
    mlflow.log_params({"n_estimators": 200, "max_depth": 5, "learning_rate": 0.05,
                       "features": str(feat_cols)})
    mlflow.sklearn.log_model(pipe, "model", signature=sig,
                             registered_model_name=MODEL_NAME)
    run_id = run.info.run_id

client = MlflowClient()
versions = client.get_latest_versions(MODEL_NAME)
latest   = max(versions, key=lambda v: int(v.version)).version
client.set_registered_model_alias(MODEL_NAME, "champion", latest)
client.update_registered_model(MODEL_NAME,
    description="XGBoost demand forecast. Input: SKU + month + lag features. Output: predicted monthly qty.")

print(f"✅ Registered: {MODEL_NAME}@champion  (version {latest})")
print(f"   Run ID: {run_id}")

# COMMAND ----------

# DBTITLE 1,5. Generate 6-month forward predictions + save to gold table
# Build future rows for each SKU for next 6 months
skus = df[['material_number','product_description','product_category']].drop_duplicates()
last = df.groupby('material_number').agg(
    last_year=('order_year','last'), last_month=('order_month','last'),
    last_qty=('qty','last'), roll_3=('roll_3','last'), roll_6=('roll_6','last'),
    avg_price=('avg_price','last'), unique_customers=('unique_customers','last'),
    prev_month=('lag_1','last'), prev_quarter=('lag_3','last'), time_idx=('time_idx','last')
).reset_index()

future_rows = []
for _, sku_row in last.iterrows():
    yr, mo = int(sku_row['last_year']), int(sku_row['last_month'])
    prev_qtys = [float(sku_row['last_qty'])] * 3
    r3, r6 = float(sku_row['roll_3']), float(sku_row['roll_6'])
    tidx = int(sku_row['time_idx'])
    for i in range(1, 7):
        mo += 1
        if mo > 12:
            mo = 1
            yr += 1
        tidx += 1
        row = {
            'material_number':  sku_row['material_number'],
            'product_category': skus[skus.material_number == sku_row['material_number']]['product_category'].iloc[0],
            'order_year':       yr,
            'order_month':      mo,
            'month_sin':        np.sin(2 * np.pi * mo / 12),
            'month_cos':        np.cos(2 * np.pi * mo / 12),
            'time_idx':         tidx,
            'lag_1':            prev_qtys[-1],
            'lag_2':            prev_qtys[-2] if len(prev_qtys) >= 2 else prev_qtys[-1],
            'lag_3':            prev_qtys[-3] if len(prev_qtys) >= 3 else prev_qtys[-1],
            'roll_3':           r3,
            'roll_6':           r6,
            'avg_price':        float(sku_row['avg_price']),
            'unique_customers': float(sku_row['unique_customers']),
            'prev_month':       prev_qtys[-1],
            'prev_quarter':     prev_qtys[-3] if len(prev_qtys) >= 3 else prev_qtys[-1],
        }
        future_rows.append(row)
        predicted = max(0, float(pipe.predict(pd.DataFrame([row]))[0]))
        r3 = (r3 * 2 + predicted) / 3
        r6 = (r6 * 5 + predicted) / 6
        prev_qtys.append(predicted)

future_df = pd.DataFrame(future_rows)
future_df['predicted_qty'] = np.maximum(0, pipe.predict(future_df[feat_cols]).round(1))
future_df['period'] = future_df['order_year'].astype(str) + '-' + future_df['order_month'].astype(str).str.zfill(2)
future_df['model_version']   = str(latest)
future_df['prediction_date'] = pd.Timestamp.today().date().isoformat()
future_df['is_forecast'] = True

# Historical actuals
hist_df = df[['material_number','product_category','order_year','order_month','qty']].copy()
hist_df['period'] = hist_df['order_year'].astype(str) + '-' + hist_df['order_month'].astype(str).str.zfill(2)
hist_df = hist_df.rename(columns={'qty': 'predicted_qty'})
hist_df['model_version']   = str(latest)
hist_df['prediction_date'] = pd.Timestamp.today().date().isoformat()
hist_df['is_forecast'] = False

# Merge descriptions
hist_df = hist_df.merge(skus, on=['material_number','product_category'], how='left')
save_df = pd.concat([
    hist_df[['material_number','product_description','product_category',
             'order_year','order_month','period','predicted_qty',
             'model_version','prediction_date','is_forecast']],
    future_df[['material_number','product_category',
               'order_year','order_month','period','predicted_qty',
               'model_version','prediction_date','is_forecast']]
        .merge(skus[['material_number','product_description']], on='material_number', how='left')
], ignore_index=True)

spark.createDataFrame(save_df).write.mode("overwrite") \
    .saveAsTable("`demand-forecast`.gold_pres.demand_forecast_predictions")

print(f"✅ Saved to demand-forecast.gold_pres.demand_forecast_predictions")
print(f"   Historical rows : {hist_df.shape[0]}")
print(f"   Forecast rows   : {future_df.shape[0]}  (6 months x {skus.shape[0]} SKUs)")
print(f"\nSample forecasts:")
print(future_df[['material_number','period','predicted_qty']].head(12).to_string(index=False))
