"""
Silver Layer: Unified Customer Dimension
Combines SAP KNA1 customer master with Salesforce accounts for a complete customer view.
All column names are human-readable.
"""

from pyspark import pipelines as dp
from pyspark.sql import functions as F

@dp.materialized_view(
    comment="Unified customer dimension combining SAP customer master (KNA1) and Salesforce accounts with human-readable column names."
)
@dp.expect_or_drop("valid_customer_number", "customer_number IS NOT NULL")
@dp.expect("valid_customer_name", "customer_name IS NOT NULL")
def dim_customer_unified():
    """
    Merges SAP KNA1 customers with Salesforce accounts via sap_customer_id link.
    Transforms SAP technical column names to business-friendly names.
    """
    # Read SAP bronze customers
    sap_customers = spark.read.table("`demand-forecast`.sap_bronze.bronze_sap_kna1_customers")
    
    # Transform SAP column names to human-readable (using only existing columns)
    sap_transformed = sap_customers.select(
        F.col("KUNNR").alias("customer_number"),
        F.col("NAME1").alias("customer_name"),
        F.col("LAND1").alias("country_code"),
        F.col("BRSCH").alias("industry_code"),
        F.col("KTOKD").alias("account_group"),
        F.col("WAERS").alias("currency"),
        F.col("KLIMK").cast("decimal(15,2)").alias("credit_limit"),
        F.col("ZTERM").alias("payment_terms"),
        F.col("STCEG").alias("tax_number"),
        F.to_date(F.col("ERDAT"), "yyyyMMdd").alias("created_date"),
        F.col("ERNAM").alias("created_by"),
        F.col("LOEVM").alias("deletion_flag"),
        F.col("SPERR").alias("central_posting_block"),
        F.col("SALESFORCE_ACCOUNT_ID").alias("salesforce_account_id"),
        F.col("bronze_ingestion_timestamp"),
        F.lit("SAP").alias("source_system")
    )
    
    # Read Salesforce accounts from silver layer
    sf_accounts = spark.read.table("`demand-forecast`.silver.dim_account").select(
        F.col("account_id").alias("salesforce_account_id"),
        F.col("account_name").alias("sf_account_name"),
        F.col("industry").alias("sf_industry"),
        F.col("annual_revenue").alias("sf_annual_revenue"),
        F.col("number_of_employees").alias("sf_number_of_employees"),
        F.col("owner_id").alias("sf_owner_id"),
        F.col("account_type").alias("sf_account_type"),
        F.col("billing_country").alias("sf_billing_country"),
        F.col("billing_state").alias("sf_billing_state"),
        F.col("billing_city").alias("sf_billing_city"),
        F.col("billing_street").alias("sf_billing_street"),
        F.col("billing_postal_code").alias("sf_billing_postal_code"),
        F.col("phone").alias("sf_phone"),
        F.col("website").alias("sf_website")
    )
    
    # Left join SAP with Salesforce (some SAP customers may not have SF accounts)
    unified = sap_transformed.join(
        sf_accounts,
        on="salesforce_account_id",
        how="left"
    )
    
    # Use Salesforce address/phone when available, with fallback labels
    unified = unified.withColumn(
        "city",
        F.coalesce(F.col("sf_billing_city"), F.lit("N/A"))
    ).withColumn(
        "street_address",
        F.coalesce(F.col("sf_billing_street"), F.lit("N/A"))
    ).withColumn(
        "postal_code",
        F.coalesce(F.col("sf_billing_postal_code"), F.lit("N/A"))
    ).withColumn(
        "phone_number",
        F.coalesce(F.col("sf_phone"), F.lit("N/A"))
    )
    
    # Add unified customer metadata
    unified = unified.withColumn("silver_processed_timestamp", F.current_timestamp())
    
    return unified
