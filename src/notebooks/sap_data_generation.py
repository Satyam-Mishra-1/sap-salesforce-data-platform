# Databricks notebook source
# DBTITLE 1,SAP HANA Test Data Generation Job
# MAGIC %md
# MAGIC # Generate and Load SAP HANA Test Data
# MAGIC
# MAGIC This job generates realistic SAP test data linked to Salesforce accounts and loads it into HANA.
# MAGIC
# MAGIC ## Tables Created:
# MAGIC 1. **KNA1** - Customer Master
# MAGIC 2. **VBAK** - Sales Order Headers
# MAGIC 3. **VBAP** - Sales Order Line Items
# MAGIC 4. **ZCUST_INTERACTIONS** - Customer Interaction History
# MAGIC
# MAGIC ## Execution:
# MAGIC Run this job on-demand or schedule it to refresh test data.

# COMMAND ----------

# DBTITLE 1,Install Dependencies
# MAGIC %pip install faker hdbcli

# COMMAND ----------

# DBTITLE 1,Configuration
from hdbcli import dbapi
import pandas as pd
from faker import Faker
import random
from datetime import datetime, timedelta

# HANA connection details
HANA_HOST = "8728177d-4ea3-4981-b036-ea7036d5e7d9.hana.prod-ap21.hanacloud.ondemand.com"
HANA_PORT = 443
HANA_USER = "DBADMIN"
HANA_PASSWORD = "Ved8256%"

# Initialize Faker
fake = Faker()
Faker.seed(42)
random.seed(42)

print("✅ Configuration loaded")

# COMMAND ----------

# DBTITLE 1,Get Salesforce Accounts
# Get Salesforce account IDs for integration
salesforce_accounts = spark.sql("""
    SELECT 
        account_id,
        account_name,
        industry,
        billing_country,
        annual_revenue
    FROM `demand-forecast`.silver.dim_account
    WHERE account_id IS NOT NULL
    LIMIT 100
""").toPandas()

print(f"✅ Found {len(salesforce_accounts)} Salesforce accounts for integration")

# COMMAND ----------

# DBTITLE 1,Generate KNA1 Customer Master
kna1_data = []
num_sap_customers = min(70, len(salesforce_accounts))

for idx, row in salesforce_accounts.head(num_sap_customers).iterrows():
    kna1_data.append({
        'KUNNR': f'C{str(idx+1000).zfill(6)}',
        'NAME1': row['account_name'][:35],
        'LAND1': row['billing_country'][:2] if pd.notna(row['billing_country']) else 'US',
        'BRSCH': row['industry'][:4] if pd.notna(row['industry']) else 'TECH',
        'KTOKD': random.choice(['0001', '0002', '0003']),
        'WAERS': 'USD',
        'KLIMK': round(random.uniform(10000, 1000000), 2) if pd.notna(row['annual_revenue']) else round(random.uniform(50000, 500000), 2),
        'ZTERM': random.choice(['0001', '0014', '0030']),
        'STCEG': fake.bothify(text='??-#######'),
        'ERDAT': fake.date_between(start_date='-5y', end_date='today').strftime('%Y%m%d'),
        'ERNAM': random.choice(['SALES01', 'SALES02', 'ADMIN01']),
        'LOEVM': '',
        'SPERR': '',
        'SALESFORCE_ACCOUNT_ID': row['account_id']
    })

kna1_df = pd.DataFrame(kna1_data)
print(f"✅ Generated {len(kna1_df)} customer master records")

# COMMAND ----------

# DBTITLE 1,Generate VBAK Sales Orders
vbak_data = []
order_num = 1000000

for idx, customer_row in kna1_df.iterrows():
    num_orders = random.randint(3, 10)
    for _ in range(num_orders):
        order_date = fake.date_between(start_date='-2y', end_date='today')
        vbak_data.append({
            'VBELN': str(order_num).zfill(10),
            'ERDAT': order_date.strftime('%Y%m%d'),
            'AUART': random.choice(['OR', 'ZOR', 'ZRMA']),
            'KUNNR': customer_row['KUNNR'],
            'VKORG': '1000',
            'VTWEG': '10',
            'SPART': '00',
            'WAERK': 'USD',
            'NETWR': round(random.uniform(5000, 500000), 2),
            'VBTYP': 'C',
            'VKBUR': random.choice(['1000', '2000', '3000']),
            'VKGRP': random.choice(['100', '200', '300']),
            'BSTNK': fake.bothify(text='PO-####-????').upper(),
            'GBSTK': random.choice(['A', 'B', 'C']),
            'LIFSK': '' if random.random() > 0.1 else 'Z1',
            'FAKSK': '' if random.random() > 0.05 else 'Z2',
            'BSARK': random.choice(['0001', '0002', '0003']),
            'ERNAM': random.choice(['SALES01', 'SALES02', 'SALES03']),
            'SALESFORCE_ACCOUNT_ID': customer_row['SALESFORCE_ACCOUNT_ID']
        })
        order_num += 1

vbak_df = pd.DataFrame(vbak_data)
print(f"✅ Generated {len(vbak_df)} sales orders")

# COMMAND ----------

# DBTITLE 1,Generate VBAP Order Items
# NovaTech Electronics — B2B electronics store serving enterprise buyers
# COMP: computing devices (physical units stocked in warehouse)
# MOBI: mobile devices and wearables (physical units)
# ACCS: accessories and peripherals (high-volume physical units)
product_catalog = [
    {'MATNR': 'P100001', 'MAKTX': 'Business Laptop Pro 15"',      'MATKL': 'COMP', 'PRICE_BASE': 1299},
    {'MATNR': 'P100002', 'MAKTX': 'Ultrabook Slim 13"',           'MATKL': 'COMP', 'PRICE_BASE': 999},
    {'MATNR': 'P100003', 'MAKTX': 'Workstation Desktop i9',       'MATKL': 'COMP', 'PRICE_BASE': 2199},
    {'MATNR': 'P100004', 'MAKTX': 'All-in-One Desktop 27"',       'MATKL': 'COMP', 'PRICE_BASE': 1599},
    {'MATNR': 'P100005', 'MAKTX': 'Smartphone Pro Max 256GB',     'MATKL': 'MOBI', 'PRICE_BASE': 1099},
    {'MATNR': 'P100006', 'MAKTX': 'Business Tablet 11"',          'MATKL': 'MOBI', 'PRICE_BASE': 749},
    {'MATNR': 'P100007', 'MAKTX': 'Wireless Earbuds Pro',         'MATKL': 'MOBI', 'PRICE_BASE': 249},
    {'MATNR': 'P100008', 'MAKTX': 'Smartwatch Series 5',          'MATKL': 'MOBI', 'PRICE_BASE': 399},
    {'MATNR': 'P100009', 'MAKTX': 'USB-C Hub 10-Port',            'MATKL': 'ACCS', 'PRICE_BASE': 79},
    {'MATNR': 'P100010', 'MAKTX': 'Mechanical Keyboard Wireless', 'MAKTL': 'ACCS', 'PRICE_BASE': 149},
    {'MATNR': 'P100011', 'MAKTX': '4K USB Webcam Pro',            'MATKL': 'ACCS', 'PRICE_BASE': 199},
    {'MATNR': 'P100012', 'MAKTX': 'Laptop Stand & Dock',         'MATKL': 'ACCS', 'PRICE_BASE': 129},
]

vbap_data = []
line_item_num = 10

for idx, order_row in vbak_df.iterrows():
    num_items = random.randint(1, 5)
    order_products = random.sample(product_catalog, num_items)
    
    for product in order_products:
        quantity = random.randint(1, 20)
        unit_price = product['PRICE_BASE'] * random.uniform(0.8, 1.2)
        net_value = quantity * unit_price
        
        vbap_data.append({
            'VBELN': order_row['VBELN'],
            'POSNR': str(line_item_num).zfill(6),
            'MATNR': product['MATNR'],
            'MAKTX': product['MAKTX'],
            'MATKL': product['MATKL'],
            'KWMENG': quantity,
            'VRKME': 'EA',
            'NETWR': round(net_value, 2),
            'WAERK': 'USD',
            'WERKS': random.choice(['1000', '2000', '3000']),
            'LGORT': '0001',
            'CHARG': '',
            'ABGRU': '',
            'KUNNR': order_row['KUNNR'],
            'SALESFORCE_ACCOUNT_ID': order_row['SALESFORCE_ACCOUNT_ID']
        })
        line_item_num += 1

vbap_df = pd.DataFrame(vbap_data)
print(f"✅ Generated {len(vbap_df)} order line items")

# COMMAND ----------

# DBTITLE 1,Generate ZCUST_INTERACTIONS
interaction_types = [
    {'TYPE': 'CALL_INBOUND', 'DESC': 'Customer called support', 'SENTIMENT_RANGE': (0.3, 0.8)},
    {'TYPE': 'CALL_OUTBOUND', 'DESC': 'Sales team called customer', 'SENTIMENT_RANGE': (0.6, 0.9)},
    {'TYPE': 'EMAIL_INBOUND', 'DESC': 'Customer sent email', 'SENTIMENT_RANGE': (0.4, 0.8)},
    {'TYPE': 'EMAIL_OUTBOUND', 'DESC': 'Team sent email to customer', 'SENTIMENT_RANGE': (0.7, 0.95)},
    {'TYPE': 'MEETING', 'DESC': 'In-person or virtual meeting', 'SENTIMENT_RANGE': (0.7, 0.95)},
    {'TYPE': 'TICKET_SUPPORT', 'DESC': 'Support ticket created', 'SENTIMENT_RANGE': (0.2, 0.7)},
    {'TYPE': 'TICKET_BILLING', 'DESC': 'Billing inquiry', 'SENTIMENT_RANGE': (0.3, 0.7)},
    {'TYPE': 'WEBINAR', 'DESC': 'Customer attended webinar', 'SENTIMENT_RANGE': (0.8, 1.0)},
    {'TYPE': 'DEMO_REQUEST', 'DESC': 'Customer requested demo', 'SENTIMENT_RANGE': (0.8, 1.0)},
    {'TYPE': 'COMPLAINT', 'DESC': 'Customer filed complaint', 'SENTIMENT_RANGE': (0.1, 0.4)},
]

topics = ['display quality issue', 'battery life concern', 'bulk order discount', 'warranty claim',
    'delivery timeline', 'product compatibility', 'return and exchange', 'account upgrade',
    'stock availability', 'technical specifications', 'new product launch', 'contract renewal']

outcomes = ['Resolved successfully', 'Escalated to technical team', 'Scheduled follow-up',
    'Customer satisfied', 'Requires management review', 'Action item created']

interaction_data = []
interaction_id = 10000

for idx, customer_row in kna1_df.iterrows():
    num_interactions = random.randint(5, 15)
    for _ in range(num_interactions):
        interaction_type = random.choice(interaction_types)
        interaction_date = fake.date_time_between(start_date='-2y', end_date='now')
        sentiment = round(random.uniform(*interaction_type['SENTIMENT_RANGE']), 2)
        topic = random.choice(topics)
        outcome = random.choice(outcomes)
        notes = f"Customer inquired about {topic}. {outcome}"
        
        interaction_data.append({
            'INTERACTION_ID': str(interaction_id).zfill(10),
            'KUNNR': customer_row['KUNNR'],
            'INTERACTION_TYPE': interaction_type['TYPE'],
            'INTERACTION_DESC': interaction_type['DESC'],
            'INTERACTION_DATE': interaction_date.strftime('%Y%m%d'),
            'INTERACTION_TIME': interaction_date.strftime('%H%M%S'),
            'CHANNEL': random.choice(['PHONE', 'EMAIL', 'WEB', 'IN_PERSON', 'CHAT']),
            'SENTIMENT_SCORE': sentiment,
            'DURATION_MINUTES': random.randint(5, 120) if 'CALL' in interaction_type['TYPE'] or interaction_type['TYPE'] == 'MEETING' else None,
            'NOTES': notes,
            'HANDLED_BY': random.choice(['AGENT01', 'AGENT02', 'SALES01', 'SUPPORT01']),
            'PRIORITY': random.choice(['LOW', 'MEDIUM', 'HIGH']) if 'TICKET' in interaction_type['TYPE'] else None,
            'STATUS': random.choice(['OPEN', 'CLOSED', 'RESOLVED']) if 'TICKET' in interaction_type['TYPE'] else 'CLOSED',
            'FOLLOW_UP_REQUIRED': random.choice([True, False]),
            'CUSTOMER_INITIATED': 'INBOUND' in interaction_type['TYPE'] or 'REQUEST' in interaction_type['TYPE'] or 'COMPLAINT' in interaction_type['TYPE'],
            'SALESFORCE_ACCOUNT_ID': customer_row['SALESFORCE_ACCOUNT_ID']
        })
        interaction_id += 1

interactions_df = pd.DataFrame(interaction_data)
print(f"✅ Generated {len(interactions_df)} customer interactions")

# COMMAND ----------

# DBTITLE 1,Generate MARD_STOCK Inventory
# SAP MARD: Material stock per plant — intentionally varied for demo scenarios
# Top-selling laptops and flagship phone are undersupplied vs forecast (Critical)
# Workstation and tablet are at warning level — strong pipeline but stock thinning
stock_overrides = {
    'P100001': 55,   # Business Laptop Pro 15" — critical (top seller, low restock)
    'P100002': 45,   # Ultrabook Slim 13" — critical (popular model, supply delay)
    'P100003': 110,  # Workstation Desktop i9 — warning
    'P100005': 130,  # Smartphone Pro Max — warning (high Salesforce pipeline)
    'P100012': 95,   # Laptop Stand & Dock — warning (bundled with laptops, drains fast)
}

mard_data = []
for product in product_catalog:
    matnr = product['MATNR']
    labst = stock_overrides.get(matnr, random.randint(180, 380))  # OK range by default
    eisbe = round(labst * 0.20)     # safety stock = 20% of current stock
    minbe = round(labst * 0.30)     # reorder point = 30% of current stock
    mard_data.append({
        'MATNR':        matnr,
        'WERKS':        'P001',
        'LABST':        labst,
        'EISBE':        eisbe,
        'MINBE':        minbe,
        'LAST_UPDATED': datetime.now().strftime('%Y%m%d'),
    })

mard_df = pd.DataFrame(mard_data)
print(f"✅ Generated {len(mard_df)} inventory stock records")

# COMMAND ----------

# DBTITLE 1,Create HANA Tables
conn = dbapi.connect(address=HANA_HOST, port=HANA_PORT, user=HANA_USER, password=HANA_PASSWORD)
cursor = conn.cursor()

print("Dropping existing tables...")
try:
    cursor.execute("DROP TABLE ZCUST_INTERACTIONS")
    cursor.execute("DROP TABLE MARD_STOCK")
    cursor.execute("DROP TABLE VBAP")
    cursor.execute("DROP TABLE VBAK")
    cursor.execute("DROP TABLE KNA1")
except:
    pass

print("Creating KNA1...")
cursor.execute("""
    CREATE COLUMN TABLE KNA1 (
        KUNNR NVARCHAR(10) PRIMARY KEY, NAME1 NVARCHAR(35), LAND1 NVARCHAR(3), BRSCH NVARCHAR(4),
        KTOKD NVARCHAR(4), WAERS NVARCHAR(5), KLIMK DECIMAL(15,2), ZTERM NVARCHAR(4), STCEG NVARCHAR(20),
        ERDAT NVARCHAR(8), ERNAM NVARCHAR(12), LOEVM NVARCHAR(1), SPERR NVARCHAR(1), SALESFORCE_ACCOUNT_ID NVARCHAR(18)
    )
""")

print("Creating VBAK...")
cursor.execute("""
    CREATE COLUMN TABLE VBAK (
        VBELN NVARCHAR(10) PRIMARY KEY, ERDAT NVARCHAR(8), AUART NVARCHAR(4), KUNNR NVARCHAR(10),
        VKORG NVARCHAR(4), VTWEG NVARCHAR(2), SPART NVARCHAR(2), WAERK NVARCHAR(5), NETWR DECIMAL(15,2),
        VBTYP NVARCHAR(1), VKBUR NVARCHAR(4), VKGRP NVARCHAR(3), BSTNK NVARCHAR(35), GBSTK NVARCHAR(1),
        LIFSK NVARCHAR(2), FAKSK NVARCHAR(2), BSARK NVARCHAR(4), ERNAM NVARCHAR(12), SALESFORCE_ACCOUNT_ID NVARCHAR(18),
        FOREIGN KEY (KUNNR) REFERENCES KNA1(KUNNR)
    )
""")

print("Creating VBAP...")
cursor.execute("""
    CREATE COLUMN TABLE VBAP (
        VBELN NVARCHAR(10), POSNR NVARCHAR(6), MATNR NVARCHAR(18), MAKTX NVARCHAR(40), MATKL NVARCHAR(9),
        KWMENG DECIMAL(13,3), VRKME NVARCHAR(3), NETWR DECIMAL(15,2), WAERK NVARCHAR(5), WERKS NVARCHAR(4),
        LGORT NVARCHAR(4), CHARG NVARCHAR(10), ABGRU NVARCHAR(2), KUNNR NVARCHAR(10), SALESFORCE_ACCOUNT_ID NVARCHAR(18),
        PRIMARY KEY (VBELN, POSNR), FOREIGN KEY (VBELN) REFERENCES VBAK(VBELN), FOREIGN KEY (KUNNR) REFERENCES KNA1(KUNNR)
    )
""")

print("Creating ZCUST_INTERACTIONS...")
cursor.execute("""
    CREATE COLUMN TABLE ZCUST_INTERACTIONS (
        INTERACTION_ID NVARCHAR(10) PRIMARY KEY, KUNNR NVARCHAR(10), INTERACTION_TYPE NVARCHAR(20),
        INTERACTION_DESC NVARCHAR(100), INTERACTION_DATE NVARCHAR(8), INTERACTION_TIME NVARCHAR(6),
        CHANNEL NVARCHAR(20), SENTIMENT_SCORE DECIMAL(3,2), DURATION_MINUTES INTEGER, NOTES NVARCHAR(500),
        HANDLED_BY NVARCHAR(20), PRIORITY NVARCHAR(10), STATUS NVARCHAR(20), FOLLOW_UP_REQUIRED BOOLEAN,
        CUSTOMER_INITIATED BOOLEAN, SALESFORCE_ACCOUNT_ID NVARCHAR(18), FOREIGN KEY (KUNNR) REFERENCES KNA1(KUNNR)
    )
""")

print("Creating MARD_STOCK...")
cursor.execute("""
    CREATE COLUMN TABLE MARD_STOCK (
        MATNR NVARCHAR(18) NOT NULL, WERKS NVARCHAR(4) NOT NULL,
        LABST INTEGER, EISBE INTEGER, MINBE INTEGER, LAST_UPDATED NVARCHAR(8),
        PRIMARY KEY (MATNR, WERKS)
    )
""")

conn.commit()
print("✅ All tables created")

# COMMAND ----------

# DBTITLE 1,Load Data into HANA
print(f"Loading {len(kna1_df)} KNA1 records...")
for idx, row in kna1_df.iterrows():
    cursor.execute(
        "INSERT INTO KNA1 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        tuple(row)
    )
conn.commit()
print("✅ KNA1 loaded")

print(f"Loading {len(vbak_df)} VBAK records...")
for idx, row in vbak_df.iterrows():
    cursor.execute(
        "INSERT INTO VBAK VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        tuple(row)
    )
conn.commit()
print("✅ VBAK loaded")

print(f"Loading {len(vbap_df)} VBAP records...")
for idx, row in vbap_df.iterrows():
    cursor.execute(
        "INSERT INTO VBAP VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        tuple(row)
    )
conn.commit()
print("✅ VBAP loaded")

print(f"Loading {len(interactions_df)} ZCUST_INTERACTIONS records...")
for idx, row in interactions_df.iterrows():
    cursor.execute(
        "INSERT INTO ZCUST_INTERACTIONS VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        tuple(row)
    )
conn.commit()
print("✅ ZCUST_INTERACTIONS loaded")

print(f"Loading {len(mard_df)} MARD_STOCK records...")
for idx, row in mard_df.iterrows():
    cursor.execute(
        "INSERT INTO MARD_STOCK VALUES (?, ?, ?, ?, ?, ?)",
        tuple(row)
    )
conn.commit()
print("✅ MARD_STOCK loaded")

conn.close()
print("\n🎉 Job Complete! All SAP HANA test data generated and loaded successfully.")

# COMMAND ----------

# DBTITLE 1,Unit Tests - Verify Data Loaded
# Unit tests to verify data was loaded successfully
print("\n" + "="*60)
print("UNIT TESTS - Verifying Data in HANA")
print("="*60 + "\n")

# Reconnect to HANA
conn = dbapi.connect(address=HANA_HOST, port=HANA_PORT, user=HANA_USER, password=HANA_PASSWORD)
cursor = conn.cursor()

test_results = []

# Test 1: Verify KNA1 row count
print("Test 1: KNA1 Customer Master")
cursor.execute("SELECT COUNT(*) FROM KNA1")
kna1_count = cursor.fetchone()[0]
expected_kna1 = len(kna1_df)
assert kna1_count == expected_kna1, f"KNA1 count mismatch: expected {expected_kna1}, got {kna1_count}"
print(f"  ✅ Row count verified: {kna1_count} records")

# Test 2: Sample KNA1 data
cursor.execute("SELECT KUNNR, NAME1, LAND1, KLIMK FROM KNA1 LIMIT 3")
kna1_sample = cursor.fetchall()
print(f"  ✅ Sample data retrieved: {len(kna1_sample)} rows")
for row in kna1_sample:
    print(f"     - Customer {row[0]}: {row[1]}, Country: {row[2]}, Credit Limit: ${row[3]:,.2f}")

test_results.append(("KNA1", "PASSED", kna1_count))

# Test 3: Verify VBAK row count
print("\nTest 2: VBAK Sales Orders")
cursor.execute("SELECT COUNT(*) FROM VBAK")
vbak_count = cursor.fetchone()[0]
expected_vbak = len(vbak_df)
assert vbak_count == expected_vbak, f"VBAK count mismatch: expected {expected_vbak}, got {vbak_count}"
print(f"  ✅ Row count verified: {vbak_count} records")

# Test 4: Sample VBAK data
cursor.execute("SELECT VBELN, KUNNR, ERDAT, NETWR FROM VBAK LIMIT 3")
vbak_sample = cursor.fetchall()
print(f"  ✅ Sample data retrieved: {len(vbak_sample)} rows")
for row in vbak_sample:
    print(f"     - Order {row[0]}: Customer {row[1]}, Date: {row[2]}, Value: ${row[3]:,.2f}")

test_results.append(("VBAK", "PASSED", vbak_count))

# Test 5: Verify VBAP row count
print("\nTest 3: VBAP Order Line Items")
cursor.execute("SELECT COUNT(*) FROM VBAP")
vbap_count = cursor.fetchone()[0]
expected_vbap = len(vbap_df)
assert vbap_count == expected_vbap, f"VBAP count mismatch: expected {expected_vbap}, got {vbap_count}"
print(f"  ✅ Row count verified: {vbap_count} records")

# Test 6: Sample VBAP data
cursor.execute("SELECT VBELN, POSNR, MAKTX, KWMENG, NETWR FROM VBAP LIMIT 3")
vbap_sample = cursor.fetchall()
print(f"  ✅ Sample data retrieved: {len(vbap_sample)} rows")
for row in vbap_sample:
    print(f"     - Order {row[0]} Item {row[1]}: {row[2]}, Qty: {row[3]}, Value: ${row[4]:,.2f}")

test_results.append(("VBAP", "PASSED", vbap_count))

# Test 7: Verify ZCUST_INTERACTIONS row count
print("\nTest 4: ZCUST_INTERACTIONS Customer Interactions")
cursor.execute("SELECT COUNT(*) FROM ZCUST_INTERACTIONS")
interactions_count = cursor.fetchone()[0]
expected_interactions = len(interactions_df)
assert interactions_count == expected_interactions, f"ZCUST_INTERACTIONS count mismatch: expected {expected_interactions}, got {interactions_count}"
print(f"  ✅ Row count verified: {interactions_count} records")

# Test 8: Sample interactions data
cursor.execute("SELECT INTERACTION_ID, KUNNR, INTERACTION_TYPE, SENTIMENT_SCORE, NOTES FROM ZCUST_INTERACTIONS LIMIT 3")
interactions_sample = cursor.fetchall()
print(f"  ✅ Sample data retrieved: {len(interactions_sample)} rows")
for row in interactions_sample:
    print(f"     - Interaction {row[0]}: Customer {row[1]}, Type: {row[2]}, Sentiment: {row[3]:.2f}")
    print(f"       Notes: {row[4][:60]}...")

test_results.append(("ZCUST_INTERACTIONS", "PASSED", interactions_count))

# Test 9: Verify foreign key relationships
print("\nTest 5: Foreign Key Relationships")
cursor.execute("""
    SELECT COUNT(*) 
    FROM VBAK v
    JOIN KNA1 k ON v.KUNNR = k.KUNNR
""")
fk_test1 = cursor.fetchone()[0]
assert fk_test1 == vbak_count, "VBAK-KNA1 relationship broken"
print(f"  ✅ VBAK → KNA1 relationship verified: {fk_test1} valid joins")

cursor.execute("""
    SELECT COUNT(*) 
    FROM VBAP p
    JOIN VBAK h ON p.VBELN = h.VBELN
""")
fk_test2 = cursor.fetchone()[0]
assert fk_test2 == vbap_count, "VBAP-VBAK relationship broken"
print(f"  ✅ VBAP → VBAK relationship verified: {fk_test2} valid joins")

test_results.append(("Foreign Keys", "PASSED", "N/A"))

# Test 10: Verify Salesforce integration link
print("\nTest 6: Salesforce Integration")
cursor.execute("SELECT COUNT(DISTINCT SALESFORCE_ACCOUNT_ID) FROM KNA1 WHERE SALESFORCE_ACCOUNT_ID IS NOT NULL")
sf_linked_accounts = cursor.fetchone()[0]
print(f"  ✅ Salesforce accounts linked: {sf_linked_accounts}")
assert sf_linked_accounts > 0, "No Salesforce accounts linked"

test_results.append(("Salesforce Link", "PASSED", sf_linked_accounts))

# Test 7: MARD_STOCK inventory records
print("\nTest 7: MARD_STOCK Inventory")
cursor.execute("SELECT COUNT(*) FROM MARD_STOCK")
mard_count = cursor.fetchone()[0]
assert mard_count == len(mard_df), f"MARD_STOCK count mismatch: expected {len(mard_df)}, got {mard_count}"
print(f"  ✅ Row count verified: {mard_count} records")
cursor.execute("SELECT MATNR, WERKS, LABST, EISBE, MINBE FROM MARD_STOCK ORDER BY LABST ASC LIMIT 3")
for row in cursor.fetchall():
    print(f"     - {row[0]} @ {row[1]}: stock={row[2]}, safety={row[3]}, reorder={row[4]}")
test_results.append(("MARD_STOCK", "PASSED", mard_count))

conn.close()

# Summary
print("\n" + "="*60)
print("TEST SUMMARY")
print("="*60)
for table, status, count in test_results:
    print(f"  {table:25s} {status:10s} {str(count):>15s}")

print("\n🎉 ALL TESTS PASSED! Data successfully verified in HANA.")
print("="*60)