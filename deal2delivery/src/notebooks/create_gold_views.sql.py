# Databricks notebook source
# DBTITLE 1,Gold Layer Views - Salesforce + SAP Combined
# MAGIC %md
# MAGIC # Gold Layer Views - Salesforce + SAP Combined
# MAGIC
# MAGIC Creates business views and metric views in `demand-forecast.gold_pres` schema combining:
# MAGIC - Salesforce CRM data (accounts, opportunities, cases)
# MAGIC - SAP ERP data (customers, orders, interactions)
# MAGIC
# MAGIC ## Business Views:
# MAGIC 1. **gold_customer_360** - Complete customer profile
# MAGIC 2. **gold_sales_to_fulfillment_pipeline** - Sales pipeline vs actual fulfillment
# MAGIC 3. **gold_customer_engagement_360** - All customer touchpoints
# MAGIC 4. **gold_product_demand_forecast** - Product demand analytics
# MAGIC
# MAGIC ## Metric Views (for Genie):
# MAGIC 1. **metrics_customer_health** - Customer KPIs
# MAGIC 2. **metrics_sales_performance** - Sales team metrics
# MAGIC 3. **metrics_product_trends** - Product analytics

# COMMAND ----------

# DBTITLE 1,Create Gold Schema
# MAGIC %sql
# MAGIC -- Create gold_pres schema for presentation layer views
# MAGIC CREATE SCHEMA IF NOT EXISTS `demand-forecast`.gold_pres
# MAGIC COMMENT 'Gold presentation layer combining Salesforce and SAP data for business analytics and Genie Space';

# COMMAND ----------

# DBTITLE 1,1. gold_customer_360
# MAGIC %sql
# MAGIC -- Gold Customer 360: Complete customer profile combining SAP and Salesforce
# MAGIC CREATE OR REPLACE VIEW `demand-forecast`.gold_pres.gold_customer_360 AS
# MAGIC WITH 
# MAGIC -- Aggregate order metrics from SAP
# MAGIC order_metrics AS (
# MAGIC   SELECT 
# MAGIC     customer_number,
# MAGIC     COUNT(DISTINCT order_number) as total_orders,
# MAGIC     SUM(line_net_value) as total_order_revenue,
# MAGIC     AVG(line_net_value) as avg_order_line_value,
# MAGIC     MAX(order_date) as last_order_date,
# MAGIC     MIN(order_date) as first_order_date
# MAGIC   FROM `demand-forecast`.silver.fact_sap_orders
# MAGIC   GROUP BY customer_number
# MAGIC ),
# MAGIC
# MAGIC -- Aggregate interaction metrics from SAP
# MAGIC interaction_metrics AS (
# MAGIC   SELECT 
# MAGIC     customer_number,
# MAGIC     COUNT(*) as total_interactions,
# MAGIC     AVG(sentiment_score) as avg_sentiment_score,
# MAGIC     MAX(interaction_date) as last_interaction_date,
# MAGIC     SUM(CASE WHEN sentiment_category = 'Positive' THEN 1 ELSE 0 END) as positive_interactions,
# MAGIC     SUM(CASE WHEN sentiment_category = 'Negative' OR sentiment_category = 'Very Negative' THEN 1 ELSE 0 END) as negative_interactions,
# MAGIC     SUM(CASE WHEN is_escalated THEN 1 ELSE 0 END) as escalated_interactions
# MAGIC   FROM `demand-forecast`.silver.fact_customer_interactions
# MAGIC   GROUP BY customer_number
# MAGIC ),
# MAGIC
# MAGIC -- Aggregate Salesforce opportunity metrics
# MAGIC opportunity_metrics AS (
# MAGIC   SELECT 
# MAGIC     account_id,
# MAGIC     COUNT(*) as total_opportunities,
# MAGIC     SUM(CASE WHEN stage_name = 'Closed Won' THEN 1 ELSE 0 END) as won_opportunities,
# MAGIC     SUM(CASE WHEN stage_name = 'Closed Won' THEN amount ELSE 0 END) as total_won_amount,
# MAGIC     SUM(amount) as total_opportunity_amount,
# MAGIC     MAX(close_date) as last_opportunity_date
# MAGIC   FROM `demand-forecast`.silver.fact_opportunity
# MAGIC   GROUP BY account_id
# MAGIC ),
# MAGIC
# MAGIC -- Aggregate Salesforce case metrics
# MAGIC case_metrics AS (
# MAGIC   SELECT 
# MAGIC     account_id,
# MAGIC     COUNT(*) as total_cases,
# MAGIC     SUM(CASE WHEN is_closed = FALSE THEN 1 ELSE 0 END) as open_cases,
# MAGIC     AVG(CASE WHEN is_closed THEN resolution_days ELSE NULL END) as avg_resolution_days,
# MAGIC     SUM(CASE WHEN priority = 'High' OR priority = 'Critical' THEN 1 ELSE 0 END) as high_priority_cases
# MAGIC   FROM `demand-forecast`.silver.fact_case
# MAGIC   GROUP BY account_id
# MAGIC )
# MAGIC
# MAGIC SELECT 
# MAGIC   -- Customer identifiers
# MAGIC   c.customer_number,
# MAGIC   c.customer_name,
# MAGIC   c.salesforce_account_id,
# MAGIC   c.sf_account_name,
# MAGIC   
# MAGIC   -- Customer attributes
# MAGIC   c.country_code,
# MAGIC   c.city,
# MAGIC   c.account_group,
# MAGIC   c.credit_limit,
# MAGIC   c.payment_terms,
# MAGIC   c.sf_industry,
# MAGIC   c.sf_account_type,
# MAGIC   c.sf_owner_id,
# MAGIC   
# MAGIC   -- Order metrics (SAP)
# MAGIC   COALESCE(om.total_orders, 0) as total_orders,
# MAGIC   COALESCE(om.total_order_revenue, 0) as total_order_revenue,
# MAGIC   COALESCE(om.avg_order_line_value, 0) as avg_order_line_value,
# MAGIC   om.last_order_date,
# MAGIC   om.first_order_date,
# MAGIC   
# MAGIC   -- Interaction metrics (SAP)
# MAGIC   COALESCE(im.total_interactions, 0) as total_interactions,
# MAGIC   im.avg_sentiment_score,
# MAGIC   im.last_interaction_date,
# MAGIC   COALESCE(im.positive_interactions, 0) as positive_interactions,
# MAGIC   COALESCE(im.negative_interactions, 0) as negative_interactions,
# MAGIC   COALESCE(im.escalated_interactions, 0) as escalated_interactions,
# MAGIC   
# MAGIC   -- Opportunity metrics (Salesforce)
# MAGIC   COALESCE(opp.total_opportunities, 0) as total_opportunities,
# MAGIC   COALESCE(opp.won_opportunities, 0) as won_opportunities,
# MAGIC   COALESCE(opp.total_won_amount, 0) as total_won_amount,
# MAGIC   COALESCE(opp.total_opportunity_amount, 0) as total_opportunity_amount,
# MAGIC   opp.last_opportunity_date,
# MAGIC   
# MAGIC   -- Case metrics (Salesforce)
# MAGIC   COALESCE(cm.total_cases, 0) as total_cases,
# MAGIC   COALESCE(cm.open_cases, 0) as open_cases,
# MAGIC   cm.avg_resolution_days,
# MAGIC   COALESCE(cm.high_priority_cases, 0) as high_priority_cases,
# MAGIC   
# MAGIC   -- Calculated health indicators
# MAGIC   CASE 
# MAGIC     WHEN im.avg_sentiment_score < -0.3 AND om.total_orders > 0 THEN 'High Risk'
# MAGIC     WHEN im.avg_sentiment_score < 0 OR cm.open_cases > 3 THEN 'At Risk'
# MAGIC     WHEN im.avg_sentiment_score > 0.5 AND om.total_orders > 10 THEN 'Healthy'
# MAGIC     ELSE 'Normal'
# MAGIC   END as customer_health_status,
# MAGIC   
# MAGIC   current_timestamp() as view_refresh_timestamp
# MAGIC   
# MAGIC FROM `demand-forecast`.silver.dim_customer_unified c
# MAGIC LEFT JOIN order_metrics om ON c.customer_number = om.customer_number
# MAGIC LEFT JOIN interaction_metrics im ON c.customer_number = im.customer_number
# MAGIC LEFT JOIN opportunity_metrics opp ON c.salesforce_account_id = opp.account_id
# MAGIC LEFT JOIN case_metrics cm ON c.salesforce_account_id = cm.account_id;

# COMMAND ----------

# DBTITLE 1,2. gold_sales_to_fulfillment_pipeline
# MAGIC %sql
# MAGIC -- Gold Sales to Fulfillment: Compare Salesforce opportunities vs SAP actual orders
# MAGIC CREATE OR REPLACE VIEW `demand-forecast`.gold_pres.gold_sales_to_fulfillment_pipeline AS
# MAGIC SELECT 
# MAGIC   -- Opportunity details (Salesforce)
# MAGIC   opp.opportunity_id,
# MAGIC   opp.opportunity_name,
# MAGIC   opp.account_id as salesforce_account_id,
# MAGIC   acc.account_name,
# MAGIC   opp.stage_name as opportunity_stage,
# MAGIC   opp.amount as opportunity_amount,
# MAGIC   opp.probability as win_probability,
# MAGIC   opp.close_date as opportunity_close_date,
# MAGIC   opp.is_won,
# MAGIC   opp.owner_id as sales_owner,
# MAGIC   
# MAGIC   -- SAP order fulfillment
# MAGIC   ord.order_number,
# MAGIC   ord.order_date,
# MAGIC   ord.order_status,
# MAGIC   ord.header_net_value as order_total_value,
# MAGIC   ord.customer_number as sap_customer_number,
# MAGIC   ord.customer_name as sap_customer_name,
# MAGIC   
# MAGIC   -- Fulfillment metrics
# MAGIC   CASE 
# MAGIC     WHEN ord.order_number IS NOT NULL THEN 'Fulfilled'
# MAGIC     WHEN opp.is_won = TRUE AND ord.order_number IS NULL THEN 'Won but Not Fulfilled'
# MAGIC     WHEN opp.stage_name NOT IN ('Closed Won', 'Closed Lost') THEN 'In Pipeline'
# MAGIC     ELSE 'Lost'
# MAGIC   END as fulfillment_status,
# MAGIC   
# MAGIC   -- Revenue comparison
# MAGIC   opp.amount - COALESCE(ord.header_net_value, 0) as revenue_variance,
# MAGIC   CASE 
# MAGIC     WHEN opp.amount > 0 THEN 
# MAGIC       ((opp.amount - COALESCE(ord.header_net_value, 0)) / opp.amount) * 100
# MAGIC     ELSE 0
# MAGIC   END as revenue_variance_pct,
# MAGIC   
# MAGIC   -- Customer unified view
# MAGIC   cust.customer_number,
# MAGIC   cust.customer_name,
# MAGIC   cust.sf_industry,
# MAGIC   cust.country_code,
# MAGIC   
# MAGIC   current_timestamp() as view_refresh_timestamp
# MAGIC   
# MAGIC FROM `demand-forecast`.silver.fact_opportunity opp
# MAGIC LEFT JOIN `demand-forecast`.silver.dim_account acc 
# MAGIC   ON opp.account_id = acc.account_id
# MAGIC LEFT JOIN `demand-forecast`.silver.dim_customer_unified cust 
# MAGIC   ON opp.account_id = cust.salesforce_account_id
# MAGIC LEFT JOIN (
# MAGIC   -- Aggregate SAP orders by customer and close date proximity
# MAGIC   SELECT 
# MAGIC     o.customer_number,
# MAGIC     o.salesforce_account_id,
# MAGIC     o.order_number,
# MAGIC     o.order_date,
# MAGIC     o.order_status,
# MAGIC     SUM(o.header_net_value) as header_net_value,
# MAGIC     o.customer_name
# MAGIC   FROM `demand-forecast`.silver.fact_sap_orders o
# MAGIC   GROUP BY o.customer_number, o.salesforce_account_id, o.order_number, 
# MAGIC            o.order_date, o.order_status, o.customer_name
# MAGIC ) ord 
# MAGIC   ON cust.customer_number = ord.customer_number
# MAGIC   AND ABS(DATEDIFF(opp.close_date, ord.order_date)) <= 30  -- Match orders within 30 days of opp close
# MAGIC WHERE opp.amount > 0;

# COMMAND ----------

# DBTITLE 1,3. gold_customer_engagement_360
# MAGIC %sql
# MAGIC -- Gold Customer Engagement 360: Combined Salesforce cases + SAP interactions
# MAGIC CREATE OR REPLACE VIEW `demand-forecast`.gold_pres.gold_customer_engagement_360 AS
# MAGIC WITH 
# MAGIC -- Salesforce cases
# MAGIC sf_cases AS (
# MAGIC   SELECT 
# MAGIC     c.case_id as engagement_id,
# MAGIC     'Salesforce Case' as engagement_source,
# MAGIC     c.account_id as salesforce_account_id,
# MAGIC     acc.account_name,
# MAGIC     c.created_date as engagement_date,
# MAGIC     c.case_type as engagement_type,
# MAGIC     c.origin as channel,
# MAGIC     c.priority,
# MAGIC     c.status as engagement_status,
# MAGIC     c.subject as engagement_subject,
# MAGIC     c.description as engagement_notes,
# MAGIC     NULL as sentiment_score,  -- Cases don't have sentiment in our model
# MAGIC     NULL as duration_minutes,
# MAGIC     c.is_closed,
# MAGIC     c.resolution_days
# MAGIC   FROM `demand-forecast`.silver.fact_case c
# MAGIC   LEFT JOIN `demand-forecast`.silver.dim_account acc ON c.account_id = acc.account_id
# MAGIC ),
# MAGIC
# MAGIC -- SAP interactions
# MAGIC sap_interactions AS (
# MAGIC   SELECT 
# MAGIC     i.interaction_id as engagement_id,
# MAGIC     'SAP Interaction' as engagement_source,
# MAGIC     i.salesforce_account_id,
# MAGIC     c.sf_account_name as account_name,
# MAGIC     i.interaction_date as engagement_date,
# MAGIC     i.interaction_type as engagement_type,
# MAGIC     i.channel,
# MAGIC     i.priority,
# MAGIC     i.interaction_status as engagement_status,
# MAGIC     i.interaction_description as engagement_subject,
# MAGIC     i.interaction_notes as engagement_notes,
# MAGIC     i.sentiment_score,
# MAGIC     i.duration_minutes,
# MAGIC     CASE WHEN i.interaction_status = 'CLOSED' THEN TRUE ELSE FALSE END as is_closed,
# MAGIC     NULL as resolution_days
# MAGIC   FROM `demand-forecast`.silver.fact_customer_interactions i
# MAGIC   JOIN `demand-forecast`.silver.dim_customer_unified c ON i.customer_number = c.customer_number
# MAGIC ),
# MAGIC
# MAGIC -- Union all engagements
# MAGIC all_engagements AS (
# MAGIC   SELECT * FROM sf_cases
# MAGIC   UNION ALL
# MAGIC   SELECT * FROM sap_interactions
# MAGIC )
# MAGIC
# MAGIC SELECT 
# MAGIC   e.*,
# MAGIC   
# MAGIC   -- Customer enrichment
# MAGIC   cust.customer_number,
# MAGIC   cust.customer_name,
# MAGIC   cust.country_code,
# MAGIC   cust.city,
# MAGIC   cust.sf_industry,
# MAGIC   cust.credit_limit,
# MAGIC   
# MAGIC   -- Engagement categorization
# MAGIC   CASE 
# MAGIC     WHEN e.sentiment_score IS NOT NULL AND e.sentiment_score < -0.3 THEN 'Negative Experience'
# MAGIC     WHEN e.sentiment_score IS NOT NULL AND e.sentiment_score > 0.5 THEN 'Positive Experience'
# MAGIC     WHEN e.priority IN ('High', 'Critical', 'CRITICAL', 'HIGH') THEN 'High Priority'
# MAGIC     WHEN e.is_closed = FALSE THEN 'Open Issue'
# MAGIC     ELSE 'Normal'
# MAGIC   END as engagement_category,
# MAGIC   
# MAGIC   current_timestamp() as view_refresh_timestamp
# MAGIC   
# MAGIC FROM all_engagements e
# MAGIC LEFT JOIN `demand-forecast`.silver.dim_customer_unified cust 
# MAGIC   ON e.salesforce_account_id = cust.salesforce_account_id
# MAGIC ORDER BY e.engagement_date DESC;

# COMMAND ----------

# DBTITLE 1,4. gold_product_demand_forecast
# MAGIC %sql
# MAGIC -- Gold Product Demand Forecast: Product-level demand analytics for ML forecasting
# MAGIC CREATE OR REPLACE VIEW `demand-forecast`.gold_pres.gold_product_demand_forecast AS
# MAGIC SELECT 
# MAGIC   -- Product dimensions
# MAGIC   o.material_number,
# MAGIC   o.product_description,
# MAGIC   o.product_category,
# MAGIC   o.plant,
# MAGIC   
# MAGIC   -- Time dimensions
# MAGIC   o.order_date,
# MAGIC   o.order_year,
# MAGIC   o.order_quarter,
# MAGIC   o.order_month,
# MAGIC   o.order_week_of_year,
# MAGIC   o.order_day_of_week,
# MAGIC   
# MAGIC   -- Customer dimensions
# MAGIC   o.customer_number,
# MAGIC   o.customer_name,
# MAGIC   o.country_code,
# MAGIC   o.sf_industry,
# MAGIC   o.account_group,
# MAGIC   
# MAGIC   -- Demand metrics (aggregated to product-date level)
# MAGIC   SUM(o.quantity) as total_quantity_ordered,
# MAGIC   COUNT(DISTINCT o.order_number) as order_count,
# MAGIC   COUNT(DISTINCT o.customer_number) as unique_customer_count,
# MAGIC   SUM(o.line_net_value) as total_revenue,
# MAGIC   AVG(o.unit_price) as avg_unit_price,
# MAGIC   AVG(o.quantity) as avg_order_quantity,
# MAGIC   
# MAGIC   -- Order characteristics
# MAGIC   AVG(o.discount_percentage) as avg_discount_pct,
# MAGIC   MAX(o.quantity) as max_quantity_in_order,
# MAGIC   MIN(o.quantity) as min_quantity_in_order,
# MAGIC   
# MAGIC   -- Lag features for forecasting (previous period metrics)
# MAGIC   LAG(SUM(o.quantity), 1) OVER (
# MAGIC     PARTITION BY o.material_number, o.product_category 
# MAGIC     ORDER BY o.order_year, o.order_month
# MAGIC   ) as prev_month_quantity,
# MAGIC   
# MAGIC   LAG(SUM(o.quantity), 3) OVER (
# MAGIC     PARTITION BY o.material_number, o.product_category 
# MAGIC     ORDER BY o.order_year, o.order_month
# MAGIC   ) as prev_quarter_quantity,
# MAGIC   
# MAGIC   LAG(SUM(o.quantity), 12) OVER (
# MAGIC     PARTITION BY o.material_number, o.product_category 
# MAGIC     ORDER BY o.order_year, o.order_month
# MAGIC   ) as prev_year_quantity,
# MAGIC   
# MAGIC   -- Rolling averages
# MAGIC   AVG(SUM(o.quantity)) OVER (
# MAGIC     PARTITION BY o.material_number, o.product_category 
# MAGIC     ORDER BY o.order_year, o.order_month
# MAGIC     ROWS BETWEEN 2 PRECEDING AND CURRENT ROW
# MAGIC   ) as rolling_3month_avg_quantity,
# MAGIC   
# MAGIC   current_timestamp() as view_refresh_timestamp
# MAGIC   
# MAGIC FROM `demand-forecast`.silver.fact_sap_orders o
# MAGIC GROUP BY 
# MAGIC   o.material_number, o.product_description, o.product_category, o.plant,
# MAGIC   o.order_date, o.order_year, o.order_quarter, o.order_month, 
# MAGIC   o.order_week_of_year, o.order_day_of_week,
# MAGIC   o.customer_number, o.customer_name, o.country_code, o.sf_industry, o.account_group
# MAGIC ORDER BY o.order_date DESC, o.material_number;

# COMMAND ----------

# DBTITLE 1,5. metrics_customer_health
# MAGIC %sql
# MAGIC -- Metric View: Customer Health KPIs for Genie Space
# MAGIC CREATE OR REPLACE VIEW `demand-forecast`.gold_pres.metrics_customer_health AS
# MAGIC SELECT 
# MAGIC   customer_number,
# MAGIC   customer_name,
# MAGIC   country_code,
# MAGIC   city,
# MAGIC   sf_industry,
# MAGIC   
# MAGIC   -- Revenue metrics
# MAGIC   total_order_revenue,
# MAGIC   total_orders as order_count,
# MAGIC   avg_order_line_value,
# MAGIC   
# MAGIC   -- Engagement metrics
# MAGIC   avg_sentiment_score,
# MAGIC   total_interactions,
# MAGIC   positive_interactions,
# MAGIC   negative_interactions,
# MAGIC   escalated_interactions,
# MAGIC   
# MAGIC   -- Service metrics
# MAGIC   open_cases as open_case_count,
# MAGIC   total_cases,
# MAGIC   avg_resolution_days,
# MAGIC   
# MAGIC   -- Risk indicators
# MAGIC   customer_health_status,
# MAGIC   CASE 
# MAGIC     WHEN customer_health_status IN ('High Risk', 'At Risk') THEN TRUE
# MAGIC     ELSE FALSE
# MAGIC   END as churn_risk_flag,
# MAGIC   
# MAGIC   -- Recency metrics
# MAGIC   last_order_date,
# MAGIC   last_interaction_date,
# MAGIC   DATEDIFF(current_date(), last_order_date) as days_since_last_order,
# MAGIC   
# MAGIC   -- Salesforce opportunity value
# MAGIC   total_won_amount as lifetime_opportunity_value,
# MAGIC   won_opportunities,
# MAGIC   
# MAGIC   current_timestamp() as metric_refresh_timestamp
# MAGIC   
# MAGIC FROM `demand-forecast`.gold_pres.gold_customer_360
# MAGIC WHERE customer_number IS NOT NULL;

# COMMAND ----------

# DBTITLE 1,6. metrics_sales_performance
# MAGIC %sql
# MAGIC -- Metric View: Sales Team Performance for Genie Space
# MAGIC CREATE OR REPLACE VIEW `demand-forecast`.gold_pres.metrics_sales_performance AS
# MAGIC SELECT 
# MAGIC   sales_owner,
# MAGIC   
# MAGIC   -- Opportunity metrics
# MAGIC   COUNT(DISTINCT opportunity_id) as total_opportunities,
# MAGIC   SUM(CASE WHEN is_won THEN 1 ELSE 0 END) as won_opportunities,
# MAGIC   SUM(CASE WHEN opportunity_stage = 'Closed Lost' THEN 1 ELSE 0 END) as lost_opportunities,
# MAGIC   SUM(CASE WHEN opportunity_stage NOT IN ('Closed Won', 'Closed Lost') THEN 1 ELSE 0 END) as active_opportunities,
# MAGIC   
# MAGIC   -- Win rate
# MAGIC   CASE 
# MAGIC     WHEN COUNT(DISTINCT opportunity_id) > 0 THEN
# MAGIC       CAST(SUM(CASE WHEN is_won THEN 1 ELSE 0 END) AS DOUBLE) / COUNT(DISTINCT opportunity_id) * 100
# MAGIC     ELSE 0
# MAGIC   END as opportunity_win_rate,
# MAGIC   
# MAGIC   -- Fulfillment metrics
# MAGIC   SUM(CASE WHEN fulfillment_status = 'Fulfilled' THEN 1 ELSE 0 END) as fulfilled_orders,
# MAGIC   SUM(CASE WHEN fulfillment_status = 'Won but Not Fulfilled' THEN 1 ELSE 0 END) as unfulfilled_won_deals,
# MAGIC   CASE 
# MAGIC     WHEN SUM(CASE WHEN is_won THEN 1 ELSE 0 END) > 0 THEN
# MAGIC       CAST(SUM(CASE WHEN fulfillment_status = 'Fulfilled' THEN 1 ELSE 0 END) AS DOUBLE) / 
# MAGIC       SUM(CASE WHEN is_won THEN 1 ELSE 0 END) * 100
# MAGIC     ELSE 0
# MAGIC   END as order_fulfillment_rate,
# MAGIC   
# MAGIC   -- Revenue metrics
# MAGIC   SUM(opportunity_amount) as total_opportunity_value,
# MAGIC   SUM(CASE WHEN is_won THEN opportunity_amount ELSE 0 END) as total_won_value,
# MAGIC   AVG(CASE WHEN is_won THEN opportunity_amount ELSE NULL END) as avg_deal_size,
# MAGIC   SUM(order_total_value) as total_fulfilled_revenue,
# MAGIC   
# MAGIC   -- Revenue accuracy
# MAGIC   AVG(ABS(revenue_variance_pct)) as avg_revenue_variance_pct,
# MAGIC   
# MAGIC   -- Customer metrics
# MAGIC   COUNT(DISTINCT salesforce_account_id) as unique_customers,
# MAGIC   COUNT(DISTINCT sf_industry) as industries_covered,
# MAGIC   
# MAGIC   current_timestamp() as metric_refresh_timestamp
# MAGIC   
# MAGIC FROM `demand-forecast`.gold_pres.gold_sales_to_fulfillment_pipeline
# MAGIC WHERE sales_owner IS NOT NULL
# MAGIC GROUP BY sales_owner;

# COMMAND ----------

# DBTITLE 1,7. metrics_product_trends
# MAGIC %sql
# MAGIC -- Metric View: Product Performance Trends for Genie Space
# MAGIC CREATE OR REPLACE VIEW `demand-forecast`.gold_pres.metrics_product_trends AS
# MAGIC SELECT 
# MAGIC   material_number,
# MAGIC   product_description,
# MAGIC   product_category,
# MAGIC   
# MAGIC   -- Aggregated demand metrics
# MAGIC   SUM(total_quantity_ordered) as total_quantity_sold,
# MAGIC   SUM(total_revenue) as total_revenue,
# MAGIC   COUNT(DISTINCT order_date) as order_frequency,
# MAGIC   COUNT(DISTINCT customer_number) as unique_customers,
# MAGIC   
# MAGIC   -- Average metrics
# MAGIC   AVG(avg_unit_price) as avg_unit_price,
# MAGIC   AVG(avg_order_quantity) as avg_order_quantity,
# MAGIC   AVG(avg_discount_pct) as avg_discount_pct,
# MAGIC   
# MAGIC   -- Growth metrics (comparing recent vs older periods)
# MAGIC   SUM(CASE WHEN order_date >= DATE_SUB(current_date(), 90) THEN total_quantity_ordered ELSE 0 END) as quantity_last_90_days,
# MAGIC   SUM(CASE WHEN order_date >= DATE_SUB(current_date(), 180) AND order_date < DATE_SUB(current_date(), 90) THEN total_quantity_ordered ELSE 0 END) as quantity_prev_90_days,
# MAGIC   
# MAGIC   CASE 
# MAGIC     WHEN SUM(CASE WHEN order_date >= DATE_SUB(current_date(), 180) AND order_date < DATE_SUB(current_date(), 90) THEN total_quantity_ordered ELSE 0 END) > 0 THEN
# MAGIC       (
# MAGIC         (SUM(CASE WHEN order_date >= DATE_SUB(current_date(), 90) THEN total_quantity_ordered ELSE 0 END) - 
# MAGIC          SUM(CASE WHEN order_date >= DATE_SUB(current_date(), 180) AND order_date < DATE_SUB(current_date(), 90) THEN total_quantity_ordered ELSE 0 END)) /
# MAGIC         SUM(CASE WHEN order_date >= DATE_SUB(current_date(), 180) AND order_date < DATE_SUB(current_date(), 90) THEN total_quantity_ordered ELSE 0 END)
# MAGIC       ) * 100
# MAGIC     ELSE 0
# MAGIC   END as growth_rate,
# MAGIC   
# MAGIC   -- Geographic diversity
# MAGIC   COUNT(DISTINCT country_code) as countries_sold_in,
# MAGIC   
# MAGIC   -- Industry diversity
# MAGIC   COUNT(DISTINCT sf_industry) as industries_served,
# MAGIC   
# MAGIC   -- Recency
# MAGIC   MAX(order_date) as last_order_date,
# MAGIC   MIN(order_date) as first_order_date,
# MAGIC   DATEDIFF(MAX(order_date), MIN(order_date)) as days_in_catalog,
# MAGIC   
# MAGIC   current_timestamp() as metric_refresh_timestamp
# MAGIC   
# MAGIC FROM `demand-forecast`.gold_pres.gold_product_demand_forecast
# MAGIC WHERE material_number IS NOT NULL
# MAGIC GROUP BY material_number, product_description, product_category;

# COMMAND ----------

# DBTITLE 1,8. gold_demand_vs_supply_gap
# MAGIC %sql
# MAGIC -- Gold Demand vs Supply Gap: Compares 6-month ML forecast vs current SAP inventory
# MAGIC CREATE OR REPLACE VIEW `demand-forecast`.gold_pres.gold_demand_vs_supply_gap AS
# MAGIC SELECT
# MAGIC   f.material_number,
# MAGIC   f.product_description,
# MAGIC   f.product_category,
# MAGIC   SUM(f.predicted_qty)                              AS forecast_qty_6m,
# MAGIC   COALESCE(MAX(s.LABST), 0)                         AS current_stock,
# MAGIC   COALESCE(MAX(s.EISBE), 0)                         AS safety_stock,
# MAGIC   COALESCE(MAX(s.MINBE), 0)                         AS reorder_point,
# MAGIC   SUM(f.predicted_qty) - COALESCE(MAX(s.LABST), 0)  AS stock_gap,
# MAGIC   ROUND(
# MAGIC     COALESCE(MAX(s.LABST), 0) /
# MAGIC     NULLIF(SUM(f.predicted_qty), 0) * 100, 1
# MAGIC   )                                                  AS coverage_pct,
# MAGIC   CASE
# MAGIC     WHEN COALESCE(MAX(s.LABST), 0) < SUM(f.predicted_qty) * 0.25 THEN 'Critical'
# MAGIC     WHEN COALESCE(MAX(s.LABST), 0) < SUM(f.predicted_qty) * 0.50 THEN 'Warning'
# MAGIC     ELSE 'OK'
# MAGIC   END AS gap_risk_level
# MAGIC FROM `demand-forecast`.gold_pres.demand_forecast_predictions f
# MAGIC LEFT JOIN `demand-forecast`.sap_bronze.bronze_sap_mard_stock s
# MAGIC   ON f.material_number = s.MATNR
# MAGIC WHERE CAST(f.is_forecast AS STRING) = 'true'
# MAGIC GROUP BY f.material_number, f.product_description, f.product_category;