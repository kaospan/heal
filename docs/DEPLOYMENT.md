# Deployment Guide

This repository supports multiple deployment options:
1. **GitHub Pages** - Simple, free hosting for static sites (recommended for getting started)
2. **Cloud Providers** - AWS/GCP/Azure with OIDC authentication (for production)

---

## 🚀 GitHub Pages Deployment (Quick Start)

### Overview

GitHub Pages is the simplest way to deploy this application. It's free, requires no cloud provider setup, and works out of the box.

### Setup Steps

1. **Enable GitHub Pages in your repository:**
   - Go to **Settings** → **Pages**
   - Under "Build and deployment", select **GitHub Actions** as the source
   
2. **Deploy:**
   - Push to `main` branch or manually trigger the workflow from the Actions tab
   - The site will be available at `https://<username>.github.io/<repository-name>/`
   - For this repository: `https://kaospan.github.io/heal/`

### How It Works

The `.github/workflows/deploy-pages.yml` workflow automatically:
- Builds the project with the correct base path
- Deploys to GitHub Pages
- Handles SPA routing with 404.html fallback

### Configuration

The build configuration automatically determines the base path from the repository name:
- **Priority**: `VITE_BASE_PATH` > `GITHUB_REPOSITORY` > fallback to `/heal/`
- The workflow passes `GITHUB_REPOSITORY` automatically
- For custom base paths, set the `VITE_BASE_PATH` environment variable

### Testing Locally

To test the GitHub Pages build locally:

```bash
# Build with GitHub Pages configuration
GITHUB_PAGES=true GITHUB_REPOSITORY=kaospan/heal npm run build

# Or with a custom base path
GITHUB_PAGES=true VITE_BASE_PATH=/my-app/ npm run build
```

### Troubleshooting

**Issue: Assets not loading**
- Verify GitHub Pages is enabled in repository settings
- Check that the base path matches your repository name
- Ensure the workflow has completed successfully

**Issue: Routes not working**
- The 404.html file handles client-side routing
- Make sure both `.nojekyll` and `404.html` exist in the dist folder

---

## 🏗️ Cloud Provider Deployment (Advanced)

# GitHub Environments & Deployment Setup Guide

This section covers advanced deployment to cloud providers with OIDC authentication.

## 🏗️ Environment Setup

### 1. Create Environments in GitHub

1. Go to **Settings** → **Environments**
2. Create two environments:
   - `staging`
   - `production`

### 2. Configure Production Environment Protection

For the **production** environment:

1. Click **production** → **Configure**
2. Enable **Required reviewers**
   - Add team members who must approve production deployments
   - Minimum: 1-2 reviewers
3. Enable **Wait timer** (optional)
   - Add 5-10 minute delay before deployment
4. Enable **Deployment branches**
   - Select "Selected branches"
   - Add rule: `main` (only deploy from main branch)

### 3. Configure Staging Environment (Optional Protection)

For the **staging** environment:
- No approval required (deploys automatically after build)
- Optional: Restrict to `main` and `develop` branches

---

## 🔐 Secrets Configuration

### Environment Variables (Non-sensitive)

Go to **Settings** → **Environments** → [environment] → **Variables**

**Staging:**
- `STAGING_URL`: https://staging.yourdomain.com
- `USE_AWS`: `true` (or `USE_GCP`, `USE_AZURE`)
- `AWS_REGION`: `us-east-1`

**Production:**
- `PRODUCTION_URL`: https://yourdomain.com
- `USE_AWS`: `true`
- `AWS_REGION`: `us-east-1`

### Environment Secrets (Sensitive)

Go to **Settings** → **Environments** → [environment] → **Secrets**

**Staging Secrets:**
```
S3_STAGING_BUCKET=your-staging-bucket
CLOUDFRONT_STAGING_ID=E1234567890ABC
```

**Production Secrets:**
```
S3_PRODUCTION_BUCKET=your-production-bucket
CLOUDFRONT_PRODUCTION_ID=E0987654321XYZ
```

> ⚠️ **Important:** Environment secrets are ONLY available to jobs that reference that environment. This prevents accidental production deployments.

---

## ☁️ OIDC Setup (Recommended)

### Why OIDC?
- ✅ No long-lived cloud credentials in GitHub
- ✅ Short-lived tokens (1 hour)
- ✅ Automatic rotation
- ✅ Better audit trails
- ✅ Follows zero-trust principles

### AWS OIDC Setup

#### Step 1: Create OIDC Provider in AWS

1. Go to **IAM** → **Identity providers** → **Add provider**
2. Provider type: **OpenID Connect**
3. Provider URL: `https://token.actions.githubusercontent.com`
4. Audience: `sts.amazonaws.com`
5. Click **Add provider**

#### Step 2: Create IAM Role

1. Go to **IAM** → **Roles** → **Create role**
2. Trusted entity type: **Web identity**
3. Identity provider: `token.actions.githubusercontent.com`
4. Audience: `sts.amazonaws.com`
5. Add condition (IMPORTANT for security):

```json
{
  "StringEquals": {
    "token.actions.githubusercontent.com:aud": "sts.amazonaws.com",
    "token.actions.githubusercontent.com:sub": "repo:kaospan/data-flow-hub:environment:production"
  }
}
```

6. Attach policies:
   - `AmazonS3FullAccess` (or custom policy for specific bucket)
   - `CloudFrontFullAccess` (if using CloudFront)

7. Name: `github-actions-production-deploy`
8. Copy the Role ARN

#### Step 3: Add Role ARN to GitHub

**Production Environment:**
```
AWS_ROLE_ARN=arn:aws:iam::123456789012:role/github-actions-production-deploy
```

**Staging Environment:**
Create separate role with staging-only permissions:
```
AWS_ROLE_ARN=arn:aws:iam::123456789012:role/github-actions-staging-deploy
```

### GCP OIDC Setup

#### Step 1: Create Workload Identity Pool

```bash
gcloud iam workload-identity-pools create "github-actions-pool" \
  --project="your-project-id" \
  --location="global" \
  --display-name="GitHub Actions Pool"
```

#### Step 2: Create Workload Identity Provider

```bash
gcloud iam workload-identity-pools providers create-oidc "github-provider" \
  --project="your-project-id" \
  --location="global" \
  --workload-identity-pool="github-actions-pool" \
  --display-name="GitHub Provider" \
  --attribute-mapping="google.subject=assertion.sub,attribute.actor=assertion.actor,attribute.repository=assertion.repository,attribute.repository_owner=assertion.repository_owner" \
  --attribute-condition="assertion.repository_owner == 'kaospan'" \
  --issuer-uri="https://token.actions.githubusercontent.com"
```

#### Step 3: Create Service Account

```bash
gcloud iam service-accounts create github-actions-production \
  --display-name="GitHub Actions Production"
```

#### Step 4: Grant Permissions

```bash
# Allow deploying to production bucket
gsutil iam ch serviceAccount:github-actions-production@your-project-id.iam.gserviceaccount.com:objectAdmin \
  gs://your-production-bucket

# Bind workload identity
gcloud iam service-accounts add-iam-policy-binding \
  github-actions-production@your-project-id.iam.gserviceaccount.com \
  --role="roles/iam.workloadIdentityUser" \
  --member="principalSet://iam.googleapis.com/projects/PROJECT_NUMBER/locations/global/workloadIdentityPools/github-actions-pool/attribute.repository/kaospan/data-flow-hub"
```

#### Step 5: Add to GitHub Secrets

**Production Environment:**
```
GCP_WORKLOAD_IDENTITY_PROVIDER=projects/PROJECT_NUMBER/locations/global/workloadIdentityPools/github-actions-pool/providers/github-provider
GCP_SERVICE_ACCOUNT=github-actions-production@your-project-id.iam.gserviceaccount.com
```

### Azure OIDC Setup

#### Step 1: Register App in Azure AD

```bash
az ad app create --display-name github-actions-data-flow-hub
```

#### Step 2: Create Service Principal

```bash
az ad sp create --id <APP_ID_FROM_STEP_1>
```

#### Step 3: Configure Federated Credentials

```bash
az ad app federated-credential create \
  --id <APP_ID> \
  --parameters '{
    "name": "github-production",
    "issuer": "https://token.actions.githubusercontent.com",
    "subject": "repo:kaospan/data-flow-hub:environment:production",
    "audiences": ["api://AzureADTokenExchange"]
  }'
```

#### Step 4: Grant Permissions

```bash
# Get subscription ID
az account show --query id -o tsv

# Assign role to resource group or storage account
az role assignment create \
  --assignee <SERVICE_PRINCIPAL_ID> \
  --role "Storage Blob Data Contributor" \
  --scope /subscriptions/<SUBSCRIPTION_ID>/resourceGroups/<RESOURCE_GROUP>
```

#### Step 5: Add to GitHub Secrets

**Production Environment:**
```
AZURE_CLIENT_ID=<APP_ID>
AZURE_TENANT_ID=<TENANT_ID>
AZURE_SUBSCRIPTION_ID=<SUBSCRIPTION_ID>
```

---

## 🚀 Deployment Flow

### Automatic Staging Deployment

1. Push to `main` branch
2. Build runs
3. Staging deploys automatically
4. Test staging site

### Gated Production Deployment

1. After staging succeeds, production job appears
2. **Waits for approval** from designated reviewers
3. Reviewer clicks **Review deployments** → **Approve and deploy**
4. Production deployment proceeds
5. Deployment tag created automatically

---

## 🔒 Security Best Practices

### ✅ DO:
- Use environment-specific secrets
- Use OIDC instead of long-lived keys
- Require multiple reviewers for production
- Use branch protection rules
- Restrict environment access to specific branches
- Regularly rotate credentials (OIDC handles this automatically)
- Use least-privilege IAM policies

### ❌ DON'T:
- Store production secrets in repository secrets
- Use the same credentials for staging and production
- Skip approval gates for production
- Use admin/wildcard permissions
- Share OIDC roles across multiple repos without attribute conditions

---

## 📊 Monitoring Deployments

### View Deployment History
1. Go to **Actions** tab
2. Click on a workflow run
3. See approval status and deployment logs

### Rollback Strategy
If production deployment fails:
1. Go to **Actions**
2. Find last successful deployment
3. Click **Re-run jobs**
4. Approve production deployment

Alternatively:
```bash
# Manually revert to previous tag
git checkout deploy-YYYYMMDD-HHMMSS
git push origin main
```

---

## 🧪 Testing Deployment Workflow

### Test Staging (No Approval)
```bash
git add .
git commit -m "test: staging deployment"
git push origin main
# Staging deploys automatically
```

### Test Production (Requires Approval)
1. Push to main
2. Staging deploys
3. Go to Actions → Your workflow
4. See "Waiting for approval"
5. Click **Review deployments**
6. Check **production**
7. Click **Approve and deploy**

---

## 📝 Workflow Variables Reference

### Environment Variables (Public)
- `STAGING_URL` / `PRODUCTION_URL`: Deployment URLs
- `USE_AWS` / `USE_GCP` / `USE_AZURE`: Cloud provider flag
- `AWS_REGION`: AWS region for deployments

### Environment Secrets (Private)

**AWS:**
- `AWS_ROLE_ARN`: OIDC role ARN
- `S3_STAGING_BUCKET` / `S3_PRODUCTION_BUCKET`: S3 bucket names
- `CLOUDFRONT_STAGING_ID` / `CLOUDFRONT_PRODUCTION_ID`: CloudFront distribution IDs

**GCP:**
- `GCP_WORKLOAD_IDENTITY_PROVIDER`: Workload identity pool path
- `GCP_SERVICE_ACCOUNT`: Service account email
- `GCS_STAGING_BUCKET` / `GCS_PRODUCTION_BUCKET`: Cloud Storage bucket names

**Azure:**
- `AZURE_CLIENT_ID`: App registration client ID
- `AZURE_TENANT_ID`: Azure AD tenant ID
- `AZURE_SUBSCRIPTION_ID`: Azure subscription ID
- `AZURE_STAGING_CONTAINER` / `AZURE_PRODUCTION_CONTAINER`: Storage containers
- `AZURE_STORAGE_ACCOUNT`: Storage account name

---

## 🆘 Troubleshooting

### "Unable to assume role" (AWS)
- Check trust policy includes correct repository and environment
- Verify OIDC provider is configured correctly
- Check role ARN is correct

### "Permission denied" (GCP)
- Verify service account has Storage Object Admin role
- Check workload identity binding
- Ensure attribute conditions match repository

### "Deployment waiting" stuck
- Check if reviewers are correctly configured
- Verify you have permission to approve
- Check branch protection rules

### "Environment not found"
- Create environments in Settings → Environments
- Ensure environment names match workflow exactly (case-sensitive)

---

## 📚 Additional Resources

- [GitHub Environments Documentation](https://docs.github.com/en/actions/deployment/targeting-different-environments/using-environments-for-deployment)
- [AWS OIDC Guide](https://docs.github.com/en/actions/deployment/security-hardening-your-deployments/configuring-openid-connect-in-amazon-web-services)
- [GCP OIDC Guide](https://github.com/google-github-actions/auth#setup)
- [Azure OIDC Guide](https://learn.microsoft.com/en-us/azure/developer/github/connect-from-azure)
