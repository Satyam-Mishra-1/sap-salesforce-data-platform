"""
Silver Layer: SAP Orders Fact Table
Combines SAP VBAK (order headers) and VBAP (line items) with customer context.
All column names are human-readable.
"""

from pyspark import pipelines as dp
from pyspark.sql import functions as F
from pyspark.sql.window import Window

@dp.materialized_view(
    comment="SAP orders fact combining VBAK headers, VBAP line items, and customer attributes with human-readable column names."
)
@dp.expect_or_drop("valid_order_number", "order_number IS NOT NULL")
@dp.expect_or_drop("valid_line_item_number", "line_item_number IS NOT NULL")
@dp.expect("valid_customer_number", "customer_number IS NOT NULL")
@dp.expect("positive_quantity", "quantity > 0")
def fact_sap_orders():
    """
    Joins VBAK order headers with VBAP line items and enriches with customer data.
    Transforms SAP technical column names to business-friendly names.
    """
    # Read VBAK (order headers)
    vbak = spark.read.table("`demand-forecast`.sap_bronze.bronze_sap_vbak_orders")
    
    # Transform VBAK column names
    order_headers = vbak.select(
        F.col("VBELN").alias("order_number"),
        F.col("KUNNR").alias("customer_number"),
        F.to_date(F.col("ERDAT"), "yyyyMMdd").alias("order_date"),
        F.col("AUART").alias("order_type"),
        F.col("NETWR").cast("decimal(15,2)").alias("header_net_value"),
        F.col("WAERK").alias("currency"),
        F.col("VKORG").alias("sales_organization"),
        F.col("VTWEG").alias("distribution_channel"),
        F.col("SPART").alias("division"),
        F.col("GBSTK").alias("order_status"),  # Overall processing status
        F.col("VBTYP").alias("document_category"),  # Sales document category
        F.col("VKBUR").alias("sales_office"),
        F.col("VKGRP").alias("sales_group"),
        F.col("BSTNK").alias("customer_po_number"),
        F.col("LIFSK").alias("delivery_block"),
        F.col("FAKSK").alias("billing_block"),
        F.col("BSARK").alias("order_reason"),
        F.col("ERNAM").alias("created_by"),
        F.col("SALESFORCE_ACCOUNT_ID").alias("salesforce_account_id")
    )
    
    # Read VBAP (order line items)
    vbap = spark.read.table("`demand-forecast`.sap_bronze.bronze_sap_vbap_order_items")
    
    # Transform VBAP column names and calculate unit price
    # Note: Don't alias KUNNR here to avoid duplicate after join on order_number
    order_items = vbap.select(
        F.col("VBELN").alias("order_number"),
        F.col("POSNR").alias("line_item_number"),
        F.col("MATNR").alias("material_number"),
        F.col("MAKTX").alias("product_description"),  # Material description
        F.col("MATKL").alias("product_category"),  # Material group
        F.col("KWMENG").cast("decimal(15,3)").alias("quantity"),
        F.col("VRKME").alias("unit_of_measure"),
        F.col("NETWR").cast("decimal(15,2)").alias("line_net_value"),
        F.col("WAERK").alias("line_currency"),
        F.col("WERKS").alias("plant"),
        F.col("LGORT").alias("storage_location"),
        F.col("CHARG").alias("batch_number"),
        F.col("ABGRU").alias("rejection_reason")
    ).withColumn(
        # Calculate unit price as line_net_value / quantity
        "unit_price",
        F.when(F.col("quantity") > 0, F.col("line_net_value") / F.col("quantity")).otherwise(0)
    )
    
    # Join headers with items on order_number
    orders = order_headers.join(
        order_items,
        on="order_number",
        how="inner"
    )
    
    # Read customer dimension for enrichment
    customers = spark.read.table("dim_customer_unified").select(
        F.col("customer_number"),
        F.col("customer_name"),
        F.col("country_code"),
        F.col("city"),
        F.col("account_group"),
        F.col("credit_limit"),
        F.col("payment_terms"),
        F.col("sf_industry"),
        F.col("sf_owner_id")
    )
    
    # Join with customer data
    enriched_orders = orders.join(
        customers,
        on="customer_number",
        how="left"
    )
    
    # Calculate additional metrics
    enriched_orders = enriched_orders.withColumn(
        "line_discount_amount",
        F.col("quantity") * F.col("unit_price") - F.col("line_net_value")
    ).withColumn(
        "discount_percentage",
        F.when(
            F.col("quantity") * F.col("unit_price") > 0,
            (F.col("line_discount_amount") / (F.col("quantity") * F.col("unit_price"))) * 100
        ).otherwise(0)
    )
    
    # Add time dimensions
    enriched_orders = enriched_orders.withColumn("order_year", F.year("order_date")) \
        .withColumn("order_quarter", F.quarter("order_date")) \
        .withColumn("order_month", F.month("order_date")) \
        .withColumn("order_day_of_week", F.dayofweek("order_date")) \
        .withColumn("order_week_of_year", F.weekofyear("order_date"))
    
    # Add row metadata
    enriched_orders = enriched_orders.withColumn("silver_processed_timestamp", F.current_timestamp())
    
    return enriched_orders
