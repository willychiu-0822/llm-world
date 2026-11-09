#!/usr/bin/env bash
# 一次性建立 GCP 資源（可重複執行，已存在的資源會略過）。
# 用法：PROJECT_ID=my-project ADMIN_EMAILS=me@example.com bash deploy/gcp/setup.sh
set -euo pipefail
cd "$(dirname "$0")"
[ -f config.local.sh ] && source config.local.sh
source config.sh

gcloud config set project "$PROJECT_ID" >/dev/null

echo "▶ 啟用 API"
gcloud services enable run.googleapis.com sqladmin.googleapis.com artifactregistry.googleapis.com \
  secretmanager.googleapis.com cloudbuild.googleapis.com iamcredentials.googleapis.com

echo "▶ Artifact Registry：$AR_REPO"
gcloud artifacts repositories describe "$AR_REPO" --location "$REGION" >/dev/null 2>&1 || \
  gcloud artifacts repositories create "$AR_REPO" --repository-format docker --location "$REGION" --description "龍角鎮容器映像"

echo "▶ Cloud SQL：$SQL_INSTANCE（$SQL_TIER，建立約需 5–10 分鐘）"
gcloud sql instances describe "$SQL_INSTANCE" >/dev/null 2>&1 || \
  gcloud sql instances create "$SQL_INSTANCE" --database-version POSTGRES_16 --edition ENTERPRISE \
    --tier "$SQL_TIER" --region "$REGION" --storage-size 10GB --storage-auto-increase \
    --backup-start-time 18:00 --availability-type ZONAL
gcloud sql databases describe "$DB_NAME" --instance "$SQL_INSTANCE" >/dev/null 2>&1 || \
  gcloud sql databases create "$DB_NAME" --instance "$SQL_INSTANCE"

secret_exists() { gcloud secrets describe "$1" >/dev/null 2>&1; }
put_secret() { # name value
  if secret_exists "$1"; then printf '%s' "$2" | gcloud secrets versions add "$1" --data-file=-
  else printf '%s' "$2" | gcloud secrets create "$1" --replication-policy automatic --data-file=-; fi
}

if ! secret_exists longjiao-database-url; then
  echo "▶ 資料庫使用者與 DATABASE_URL 秘密"
  DB_PASS="$(openssl rand -base64 32 | tr -dc 'A-Za-z0-9' | head -c 32)"
  gcloud sql users describe "$DB_USER" --instance "$SQL_INSTANCE" >/dev/null 2>&1 && \
    gcloud sql users set-password "$DB_USER" --instance "$SQL_INSTANCE" --password "$DB_PASS" || \
    gcloud sql users create "$DB_USER" --instance "$SQL_INSTANCE" --password "$DB_PASS"
  put_secret longjiao-database-url "postgres://${DB_USER}:${DB_PASS}@localhost/${DB_NAME}?host=/cloudsql/${SQL_CONNECTION}"
fi
if ! secret_exists longjiao-session-secret; then
  echo "▶ SESSION_SECRET 秘密"
  put_secret longjiao-session-secret "$(openssl rand -base64 48)"
fi
if ! secret_exists longjiao-google-client-secret; then
  echo "▶ 建立 GOOGLE_CLIENT_SECRET 秘密的空位（之後用 add-google-secret.sh 填入）"
  put_secret longjiao-google-client-secret "pending"
fi

echo "▶ Cloud Run 執行身分：$RUN_SA"
gcloud iam service-accounts describe "$RUN_SA" >/dev/null 2>&1 || \
  gcloud iam service-accounts create "$RUN_SA_NAME" --display-name "龍角鎮 Cloud Run"
for role in roles/cloudsql.client roles/secretmanager.secretAccessor roles/logging.logWriter; do
  gcloud projects add-iam-policy-binding "$PROJECT_ID" --member "serviceAccount:$RUN_SA" --role "$role" --condition None >/dev/null
done

echo "✅ 完成。下一步：依 docs/CLOUD-SETUP.md 建立 Google OAuth client，然後執行 deploy/gcp/deploy.sh"
