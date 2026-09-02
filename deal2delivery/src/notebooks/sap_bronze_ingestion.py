# Databricks notebook source
# DBTITLE 1,SAP HANA Bronze Ingestion
# MAGIC %md
# MAGIC # SAP HANA Bronze Ingestion
# MAGIC
# MAGIC Reads all 4 SAP HANA tables and writes them to bronze Delta tables in `demand-forecast.sap_bronze` schema:
# MAGIC - KNA1 (Customer Master) → bronze_sap_kna1_customers
# MAGIC - VBAK (Sales Order Headers) → bronze_sap_vbak_orders  
# MAGIC - VBAP (Sales Order Items) → bronze_sap_vbap_order_items
# MAGIC - ZCUST_INTERACTIONS (Customer Interactions) → bronze_sap_zcust_interactions
# MAGIC
# MAGIC All tables include:
# MAGIC - bronze_ingestion_timestamp (current_timestamp)
# MAGIC - source_system identifier
# MAGIC - Change Data Feed enabled
# MAGIC - Overwrite mode for full refresh

# COMMAND ----------

# DBTITLE 1,Install hdbcli
# MAGIC %pip install hdbcli --quiet

# COMMAND ----------

# DBTITLE 1,Setup and Connection
from pyspark.sql import functions as F
from pyspark.sql.types import *
from hdbcli import dbapi
from datetime import datetime

# SAP HANA connection configuration
SAP_HANA_CONFIG = {
    "host": "8728177d-4ea3-4981-b036-ea7036d5e7d9.hana.prod-ap21.hanacloud.ondemand.com",
    "port": 443,
    "user": "DBADMIN",
    "password": "Ved8256%"
}

# Target schema (backtick-quoted for hyphenated catalog name)
TARGET_SCHEMA = "`demand-forecast`.sap_bronze"

print(f"Configuration loaded. Target schema: {TARGET_SCHEMA}")

# COMMAND ----------

# DBTITLE 1,Create Bronze Schema
# Create the bronze schema if it doesn't exist
spark.sql(f"CREATE SCHEMA IF NOT EXISTS {TARGET_SCHEMA}")
print(f"✓ Schema {TARGET_SCHEMA} ready")

# COMMAND ----------

# DBTITLE 1,Helper Function: Read SAP Table
def read_sap_table_to_delta(table_name, target_table_name, source_system_id):
    """
    Reads a table from SAP HANA and writes to Delta with metadata.
    Uses pandas as intermediate for better type handling.
    
    Args:
        table_name: Source SAP HANA table name
        target_table_name: Target Delta table name (without schema)
        source_system_id: Source system identifier for metadata
    """
    import pandas as pd
    
    print(f"\n{'='*80}")
    print(f"Processing: {table_name} → {TARGET_SCHEMA}.{target_table_name}")
    print(f"{'='*80}")
    
    # Connect to SAP HANA
    conn = dbapi.connect(
        address=SAP_HANA_CONFIG["host"],
        port=SAP_HANA_CONFIG["port"],
        user=SAP_HANA_CONFIG["user"],
        password=SAP_HANA_CONFIG["password"],
        encrypt=True,
        sslValidateCertificate=False
    )
    
    # Read into pandas DataFrame for better type handling
    query = f"SELECT * FROM {table_name}"
    pdf = pd.read_sql(query, conn)
    conn.close()
    
    print(f"✓ Read {len(pdf):,} rows from SAP HANA table {table_name}")
    
    # Convert pandas to Spark DataFrame
    df = spark.createDataFrame(pdf)
    
    # Add bronze layer metadata
    df = df.withColumn("bronze_ingestion_timestamp", F.current_timestamp()) \
           .withColumn("source_system", F.lit(source_system_id))
    
    # Write to Delta with Change Data Feed enabled
    full_table_name = f"{TARGET_SCHEMA}.{target_table_name}"
    
    df.write \
        .format("delta") \
        .mode("overwrite") \
        .option("overwriteSchema", "true") \
        .option("delta.enableChangeDataFeed", "true") \
        .saveAsTable(full_table_name)
    
    # Verify write
    count = spark.table(full_table_name).count()
    print(f"✓ Wrote {count:,} rows to {full_table_name}")
    print(f"✓ Change Data Feed: ENABLED")
    
    return count

print("Helper function defined.")

# COMMAND ----------

# DBTITLE 1,Ingest KNA1 (Customer Master)
# KNA1 - Customer Master
kna1_count = read_sap_table_to_delta(
    table_name="KNA1",
    target_table_name="bronze_sap_kna1_customers",
    source_system_id="SAP_HANA_KNA1"
)

# COMMAND ----------

# DBTITLE 1,Ingest VBAK (Sales Order Headers)
# VBAK - Sales Order Headers
vbak_count = read_sap_table_to_delta(
    table_name="VBAK",
    target_table_name="bronze_sap_vbak_orders",
    source_system_id="SAP_HANA_VBAK"
)

# COMMAND ----------

# DBTITLE 1,Ingest VBAP (Sales Order Items)
# VBAP - Sales Order Line Items
vbap_count = read_sap_table_to_delta(
    table_name="VBAP",
    target_table_name="bronze_sap_vbap_order_items",
    source_system_id="SAP_HANA_VBAP"
)

# COMMAND ----------

# DBTITLE 1,Ingest ZCUST_INTERACTIONS
# ZCUST_INTERACTIONS - Customer Interactions
zcust_count = read_sap_table_to_delta(
    table_name="ZCUST_INTERACTIONS",
    target_table_name="bronze_sap_zcust_interactions",
    source_system_id="SAP_HANA_ZCUST_INTERACTIONS"
)

# COMMAND ----------

# DBTITLE 1,Ingest MARD_STOCK (Inventory)
# MARD_STOCK - Material stock per plant (inventory levels)
mard_count = read_sap_table_to_delta(
    table_name="MARD_STOCK",
    target_table_name="bronze_sap_mard_stock",
    source_system_id="SAP_HANA_MARD_STOCK"
)

# COMMAND ----------

# DBTITLE 1,Summary Report
# Print summary
print("\n" + "="*80)
print("BRONZE INGESTION COMPLETE")
print("="*80)
print(f"\n📊 Record Counts:")
print(f"   • bronze_sap_kna1_customers:        {kna1_count:>6,} rows")
print(f"   • bronze_sap_vbak_orders:          {vbak_count:>6,} rows")
print(f"   • bronze_sap_vbap_order_items:     {vbap_count:>6,} rows")
print(f"   • bronze_sap_zcust_interactions:   {zcust_count:>6,} rows")
print(f"   • bronze_sap_mard_stock:           {mard_count:>6,} rows")
print(f"\n📍 Schema: {TARGET_SCHEMA}")
print(f"✓ All tables written with Change Data Feed enabled")
print(f"✓ Metadata columns added: bronze_ingestion_timestamp, source_system")
print("\n" + "="*80)