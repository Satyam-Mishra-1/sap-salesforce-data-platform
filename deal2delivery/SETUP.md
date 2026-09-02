# CI/CD Setup Guide for Demand Forecast Pipeline

Step-by-step guide to set up the complete CI/CD process using Declarative Automation Bundles and GitHub.

## Phase 1: Copy Existing Notebooks (5 minutes)

### 1. Copy Bronze Ingestion Notebooks

```bash
# In Databricks workspace, copy these notebooks:
# Source: /Users/vedanthbaliga21@gmail.com/SAP HANA Data Generation Job
# Destination: /Users/vedanthbaliga21@gmail.com/demand-forecast-dab/src/notebooks/sap_data_generation.py

# Source: /Users/vedanthbaliga21@gmail.com/SAP HANA Bronze Ingestion
# Destination: /Users/vedanthbaliga21@gmail.com/demand-forecast-dab/src/notebooks/sap_bronze_ingestion.py

# Source: /Users/vedanthbaliga21@gmail.com/Create Gold Views - Salesforce + SAP Combined
# Destination: /Users/vedanthbaliga21@gmail.com/demand-forecast-dab/src/notebooks/create_gold_views.sql
```

### 2. Copy Silver Pipeline Files

```bash
# Copy pipeline transformation files from:
# Source: /Users/vedanthbaliga21@gmail.com/demand-forecast-sap-ingest_030cee45/transformations/silver/
# Destination: /Users/vedanthbaliga21@gmail.com/demand-forecast-dab/src/pipelines/silver/

# Files to copy:
# - dim_customer_unified.py
# - fact_sap_orders.py
# - fact_customer_interactions.py
```

## Phase 2: Install Databricks CLI (5 minutes)

### On macOS/Linux:

```bash
curl -fsSL https://raw.githubusercontent.com/databricks/setup-cli/main/install.sh | sh
```

### On Windows (PowerShell):

```powershell
winget install Databricks.DatabricksCLI
```

### Configure CLI:

```bash
databricks configure
# Enter your Databricks workspace URL: https://dbc-dpg-prod2.cloud.databricks.com
# Enter your personal access token: (generate from User Settings > Access Tokens)
```

## Phase 3: Create GitHub Repository (10 minutes)

### 1. Create New Repository

1. Go to https://github.com/new
2. Name: `demand-forecast-pipeline`
3. Description: "Salesforce + SAP data integration pipeline with CI/CD"
4. Make it **Private**
5. Do NOT initialize with README (we already have one)
6. Click **Create repository**

### 2. Download Bundle from Databricks

```bash
# In Databricks, export the demand-forecast-dab folder
# OR use the Databricks CLI:
cd ~/workspace
databricks workspace export-dir \
  /Users/vedanthbaliga21@gmail.com/demand-forecast-dab \
  ./demand-forecast-dab \
  --overwrite
```

### 3. Initialize Git

```bash
cd demand-forecast-dab
git init
git add .
git commit -m "Initial commit: DAB structure with CI/CD"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/demand-forecast-pipeline.git
git push -u origin main

# Create develop branch
git checkout -b develop
git push -u origin develop
```

## Phase 4: Configure GitHub Secrets (5 minutes)

### 1. Generate Databricks Tokens

**Personal Access Token (for dev):**
1. In Databricks, go to **User Settings** > **Developer** > **Access Tokens**
2. Click **Generate New Token**
3. Comment: "GitHub Actions - Dev"
4. Lifetime: 90 days
5. Copy the token

### 2. Add GitHub Secrets

1. Go to your GitHub repo
2. **Settings** > **Secrets and variables** > **Actions**
3. Click **New repository secret**
4. Add these secrets:

| Secret Name | Value |
|------------|-------|
| `DATABRICKS_HOST` | `https://dbc-dpg-prod2.cloud.databricks.com` |
| `DATABRICKS_TOKEN` | Your personal access token (from step 1) |
| `DATABRICKS_TOKEN_STAGING` | (Create service principal later) |
| `DATABRICKS_TOKEN_PROD` | (Create service principal later) |

## Phase 5: Create Unity Catalog Environments (10 minutes)

### 1. Create Dev Catalog

```sql
-- Run in Databricks SQL or notebook
CREATE CATALOG IF NOT EXISTS `demand-forecast-dev`
COMMENT 'Development environment for demand forecast pipeline';

CREATE SCHEMA IF NOT EXISTS `demand-forecast-dev`.sap_bronze;
CREATE SCHEMA IF NOT EXISTS `demand-forecast-dev`.silver;
CREATE SCHEMA IF NOT EXISTS `demand-forecast-dev`.gold_pres;

-- Grant permissions to yourself
GRANT ALL PRIVILEGES ON CATALOG `demand-forecast-dev` TO `vedanthbaliga21@gmail.com`;
GRANT ALL PRIVILEGES ON SCHEMA `demand-forecast-dev`.sap_bronze TO `vedanthbaliga21@gmail.com`;
GRANT ALL PRIVILEGES ON SCHEMA `demand-forecast-dev`.silver TO `vedanthbaliga21@gmail.com`;
GRANT ALL PRIVILEGES ON SCHEMA `demand-forecast-dev`.gold_pres TO `vedanthbaliga21@gmail.com`;
```

### 2. Create Staging Catalog (Optional for now)

```sql
CREATE CATALOG IF NOT EXISTS `demand-forecast-staging`
COMMENT 'Staging environment for demand forecast pipeline';

CREATE SCHEMA IF NOT EXISTS `demand-forecast-staging`.sap_bronze;
CREATE SCHEMA IF NOT EXISTS `demand-forecast-staging`.silver;
CREATE SCHEMA IF NOT EXISTS `demand-forecast-staging`.gold_pres;
```

## Phase 6: First Deployment (10 minutes)

### 1. Validate Bundle Locally

```bash
cd demand-forecast-dab
databricks bundle validate -t dev
```

**Expected Output:**
```
✓ Configuration is valid
```

### 2. Deploy to Dev

```bash
databricks bundle deploy -t dev
```

**Expected Output:**
```
✓ Uploading bundle files
✓ Deploying resources
  - Job: dev-demand-forecast-sap-bronze-ingest
  - Pipeline: dev-demand-forecast-sap-silver
  - Job: dev-demand-forecast-gold-views
✓ Deployment complete
```

### 3. Verify Deployment

```bash
# List deployed resources
databricks bundle list -t dev

# Check in Databricks UI:
# - Workflows > Jobs (should see 2 jobs)
# - Workflows > Lakeflow Pipelines (should see 1 pipeline)
```

### 4. Test Run

```bash
# Run bronze ingestion
databricks bundle run sap_bronze_ingestion -t dev

# Monitor in Databricks UI
```

## Phase 7: Test CI/CD Pipeline (15 minutes)

### 1. Make a Test Change

```bash
# Checkout develop branch
git checkout develop

# Create feature branch
git checkout -b feature/test-cicd

# Make a small change (e.g., update README)
echo "\n## CI/CD Status: Active" >> README.md

# Commit and push
git add README.md
git commit -m "test: Verify CI/CD pipeline"
git push origin feature/test-cicd
```

### 2. Create Pull Request

1. Go to GitHub repo
2. Click **Compare & pull request**
3. Base: `develop` ← Compare: `feature/test-cicd`
4. Click **Create pull request**
5. **GitHub Actions** should run validation
6. Wait for green checkmark
7. Click **Merge pull request**

### 3. Verify Auto-Deployment to Dev

1. Go to **Actions** tab in GitHub
2. Should see "Deploy Databricks Bundle" workflow running
3. Wait for completion (2-3 minutes)
4. Check Databricks workspace for updated resources

### 4. Promote to Staging

```bash
git checkout main
git merge develop
git push origin main

# Check GitHub Actions for staging deployment
```

## Phase 8: Service Principals for Staging/Prod (20 minutes)

### 1. Create Service Principal

```bash
# Create service principal
databricks service-principals create \
  --display-name "sp-demand-forecast-staging" \
  --active true

# Note the Application ID from output
```

### 2. Generate OAuth Token

```bash
# Create OAuth secret
databricks service-principals create-secret \
  --id <APPLICATION_ID> \
  --name "github-actions-staging"

# Copy the secret value (only shown once!)
```

### 3. Grant Permissions

```sql
-- Grant catalog permissions
GRANT USE CATALOG ON CATALOG `demand-forecast-staging` 
  TO `sp-demand-forecast-staging`;

GRANT ALL PRIVILEGES ON SCHEMA `demand-forecast-staging`.sap_bronze 
  TO `sp-demand-forecast-staging`;

GRANT ALL PRIVILEGES ON SCHEMA `demand-forecast-staging`.silver 
  TO `sp-demand-forecast-staging`;

GRANT ALL PRIVILEGES ON SCHEMA `demand-forecast-staging`.gold_pres 
  TO `sp-demand-forecast-staging`;

-- Grant workspace permissions
GRANT CREATE ON ROOT TO `sp-demand-forecast-staging`;
```

### 4. Update GitHub Secret

1. Go to GitHub repo > **Settings** > **Secrets**
2. Update `DATABRICKS_TOKEN_STAGING` with the OAuth secret

### 5. Repeat for Production

```bash
databricks service-principals create \
  --display-name "sp-demand-forecast-prod" \
  --active true

# Create secret and grant permissions (same as staging)
# Update DATABRICKS_TOKEN_PROD in GitHub
```

## Phase 9: Production Deployment (10 minutes)

### 1. Configure GitHub Environment Protection

1. Go to **Settings** > **Environments**
2. Click **New environment**
3. Name: `production`
4. Check **Required reviewers**
5. Add your email
6. Click **Save protection rules**

### 2. Manual Production Deployment

1. Go to **Actions** > **Deploy Databricks Bundle**
2. Click **Run workflow**
3. Select branch: `main`
4. Environment: `prod`
5. Click **Run workflow**
6. Wait for approval request
7. Review and approve
8. Monitor deployment

## Verification Checklist

* ✅ Databricks CLI installed and configured
* ✅ GitHub repository created and code pushed
* ✅ GitHub secrets configured
* ✅ Dev catalog created
* ✅ Bundle deployed to dev successfully
* ✅ Jobs and pipeline visible in Databricks
* ✅ CI/CD pipeline tested with PR
* ✅ Auto-deployment to dev works
* ✅ Service principals created (optional for now)
* ✅ Staging environment configured (optional)
* ✅ Production environment configured (optional)

## Troubleshooting

### Bundle Validation Fails

```bash
# Check YAML syntax
databricks bundle validate -t dev --debug

# Common issues:
# - Indentation errors in YAML files
# - Invalid resource references
# - Missing required fields
```

### Deployment Fails

```bash
# Check permissions
databricks auth token

# Verify catalog exists
databricks catalogs get demand-forecast-dev

# Check logs
databricks bundle deploy -t dev --verbose
```

### GitHub Actions Fails

1. Check **Actions** tab for error logs
2. Common issues:
   * Invalid DATABRICKS_HOST (check for trailing slash)
   * Expired token
   * Insufficient permissions
3. Re-run workflow after fixing

### Pipeline Not Found

```bash
# List all pipelines
databricks pipelines list

# If pipeline files are in wrong location:
# - Check src/pipelines/silver/ directory
# - Verify file paths in silver_pipeline.yml
# - Ensure Python files have correct import statements
```

## Next Steps After Setup

1. **Monitor First Runs**
   * Check job execution logs
   * Verify data in bronze/silver/gold tables
   * Review data quality expectations

2. **Set Up Alerts**
   * Configure Slack/email notifications
   * Set up data quality monitoring
   * Create dashboard for pipeline health

3. **Create Genie Space**
   * Point to `gold_pres` views
   * Test natural language queries
   * Share with business users

4. **Documentation**
   * Document SAP connection details
   * Create runbook for common issues
   * Add data dictionary

5. **Optimization**
   * Review cluster sizing
   * Optimize query performance
   * Enable predictive optimization on tables

## Support

For issues:
1. Check [Databricks DAB Documentation](https://docs.databricks.com/dev-tools/bundles/)
2. Review GitHub Actions logs
3. Check Databricks job/pipeline logs
4. Verify Unity Catalog permissions