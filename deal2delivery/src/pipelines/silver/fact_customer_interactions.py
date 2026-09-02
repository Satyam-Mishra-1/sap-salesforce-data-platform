"""
Silver Layer: Customer Interactions Fact Table
SAP ZCUST_INTERACTIONS data enriched with customer context.
All column names are human-readable. Critical for chatbot context and sentiment analysis.
"""

from pyspark import pipelines as dp
from pyspark.sql import functions as F

@dp.materialized_view(
    comment="Customer interactions from SAP with sentiment scores and full customer context. Human-readable column names."
)
@dp.expect_or_drop("valid_interaction_id", "interaction_id IS NOT NULL")
@dp.expect("valid_customer_number", "customer_number IS NOT NULL")
@dp.expect("valid_sentiment_score", "sentiment_score BETWEEN -1 AND 1")
def fact_customer_interactions():
    """
    Transforms SAP ZCUST_INTERACTIONS to readable format and enriches with customer data.
    Used for chatbot context, sentiment analysis, and churn prediction.
    """
    # Read ZCUST_INTERACTIONS from bronze
    interactions = spark.read.table("`demand-forecast`.sap_bronze.bronze_sap_zcust_interactions")
    
    # Combine date and time into timestamp
    interactions_with_timestamp = interactions.withColumn(
        "full_timestamp",
        F.to_timestamp(
            F.concat(
                F.col("INTERACTION_DATE"), 
                F.lit(" "), 
                F.col("INTERACTION_TIME")
            ),
            "yyyy-MM-dd HH:mm:ss"
        )
    )
    
    # Transform column names to human-readable
    interactions_transformed = interactions_with_timestamp.select(
        F.col("INTERACTION_ID").alias("interaction_id"),
        F.col("KUNNR").alias("customer_number"),
        F.col("full_timestamp").alias("interaction_timestamp"),
        F.to_date(F.col("INTERACTION_DATE")).alias("interaction_date"),
        F.col("INTERACTION_TYPE").alias("interaction_type"),
        F.col("INTERACTION_DESC").alias("interaction_description"),
        F.col("CHANNEL").alias("channel"),
        F.col("SENTIMENT_SCORE").cast("decimal(3,2)").alias("sentiment_score"),
        F.col("DURATION_MINUTES").cast("int").alias("duration_minutes"),
        F.col("STATUS").alias("interaction_status"),
        F.col("PRIORITY").alias("priority"),
        F.col("NOTES").alias("interaction_notes"),
        F.col("HANDLED_BY").alias("handled_by"),
        F.col("FOLLOW_UP_REQUIRED").alias("follow_up_required"),
        F.col("CUSTOMER_INITIATED").alias("customer_initiated"),
        F.col("SALESFORCE_ACCOUNT_ID").alias("salesforce_account_id")
    )
    
    # Derive escalation flag from priority
    interactions_transformed = interactions_transformed.withColumn(
        "is_escalated",
        F.when(F.col("priority").isin("HIGH", "URGENT", "CRITICAL"), True).otherwise(False)
    )
    
    # Categorize sentiment
    interactions_transformed = interactions_transformed.withColumn(
        "sentiment_category",
        F.when(F.col("sentiment_score") >= 0.5, "Positive")
         .when(F.col("sentiment_score") >= 0, "Neutral")
         .when(F.col("sentiment_score") >= -0.5, "Negative")
         .otherwise("Very Negative")
    )
    
    # Read customer dimension for enrichment
    customers = spark.read.table("dim_customer_unified").select(
        F.col("customer_number"),
        F.col("customer_name"),
        F.col("country_code"),
        F.col("city"),
        F.col("account_group"),
        F.col("credit_limit"),
        F.col("sf_industry"),
        F.col("sf_owner_id")
    )
    
    # Join with customer data
    enriched_interactions = interactions_transformed.join(
        customers,
        on="customer_number",
        how="left"
    )
    
    # Add time dimensions
    enriched_interactions = enriched_interactions.withColumn("interaction_year", F.year("interaction_date")) \
        .withColumn("interaction_quarter", F.quarter("interaction_date")) \
        .withColumn("interaction_month", F.month("interaction_date")) \
        .withColumn("interaction_day_of_week", F.dayofweek("interaction_date")) \
        .withColumn("interaction_hour", F.hour("interaction_timestamp"))
    
    # Calculate response time metric
    enriched_interactions = enriched_interactions.withColumn(
        "response_category",
        F.when(F.col("duration_minutes") <= 5, "Quick")
         .when(F.col("duration_minutes") <= 15, "Normal")
         .when(F.col("duration_minutes") <= 30, "Extended")
         .otherwise("Very Long")
    )
    
    # Add row metadata
    enriched_interactions = enriched_interactions.withColumn("silver_processed_timestamp", F.current_timestamp())
    
    return enriched_interactions
