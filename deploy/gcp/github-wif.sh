#!/usr/bin/env bash
# 設定 GitHub Actions 透過 Workload Identity Federation 部署（不需要下載任何金鑰）。
# 用法：PROJECT_ID=my-project GITHUB_REPO=owner/llm-world bash deploy/gcp/github-wif.sh
set -euo pipefail
cd "$(dirname "$0")"
[ -f config.local.sh ] && source config.local.sh
source config.sh
: "${GITHUB_REPO:?請設定 GITHUB_REPO，例如 willychiu-0822/llm-world}"
POOL=github-pool
PROVIDER=github-provider
DEPLOY_SA_NAME=longjiao-deployer
DEPLOY_SA="${DEPLOY_SA_NAME}@${PROJECT_ID}.iam.gserviceaccount.com"
PROJECT_NUMBER="$(gcloud projects describe "$PROJECT_ID" --format 'value(projectNumber)')"

gcloud iam workload-identity-pools describe "$POOL" --location global >/dev/null 2>&1 || \
  gcloud iam workload-identity-pools create "$POOL" --location global --display-name "GitHub Actions"
gcloud iam workload-identity-pools providers describe "$PROVIDER" --workload-identity-pool "$POOL" --location global >/dev/null 2>&1 || \
  gcloud iam workload-identity-pools providers create-oidc "$PROVIDER" --workload-identity-pool "$POOL" --location global \
    --issuer-uri "https://token.actions.githubusercontent.com" \
    --attribute-mapping "google.subject=assertion.sub,attribute.repository=assertion.repository,attribute.ref=assertion.ref" \
    --attribute-condition "assertion.repository=='${GITHUB_REPO}' && assertion.ref=='refs/heads/main'"

gcloud iam service-accounts describe "$DEPLOY_SA" >/dev/null 2>&1 || \
  gcloud iam service-accounts create "$DEPLOY_SA_NAME" --display-name "龍角鎮 GitHub 部署"
for role in roles/run.admin roles/artifactregistry.writer roles/cloudbuild.builds.editor roles/storage.admin roles/serviceusage.serviceUsageConsumer roles/logging.viewer; do
  gcloud projects add-iam-policy-binding "$PROJECT_ID" --member "serviceAccount:$DEPLOY_SA" --role "$role" --condition None >/dev/null
done
gcloud iam service-accounts add-iam-policy-binding "$RUN_SA" --member "serviceAccount:$DEPLOY_SA" --role roles/iam.serviceAccountUser >/dev/null
gcloud iam service-accounts add-iam-policy-binding "$DEPLOY_SA" --role roles/iam.workloadIdentityUser \
  --member "principalSet://iam.googleapis.com/projects/${PROJECT_NUMBER}/locations/global/workloadIdentityPools/${POOL}/attribute.repository/${GITHUB_REPO}" >/dev/null

echo "✅ 請到 GitHub repo → Settings → Secrets and variables → Actions → Variables 新增："
echo "   GCP_PROJECT_ID   = ${PROJECT_ID}"
echo "   GCP_REGION       = ${REGION}"
echo "   GCP_WIF_PROVIDER = projects/${PROJECT_NUMBER}/locations/global/workloadIdentityPools/${POOL}/providers/${PROVIDER}"
echo "   GCP_DEPLOY_SA    = ${DEPLOY_SA}"
echo "   GOOGLE_CLIENT_ID = （你的 Google OAuth client ID）"
echo "   ADMIN_EMAILS     = （管理者 Email，逗號分隔）"
