#!/usr/bin/env bash
# 把 Google OAuth client secret 存進 Secret Manager。
# 用法：PROJECT_ID=my-project bash deploy/gcp/add-google-secret.sh  （會提示輸入，不會留在 shell 歷史）
set -euo pipefail
cd "$(dirname "$0")"
[ -f config.local.sh ] && source config.local.sh
source config.sh
read -rsp "Google OAuth client secret: " SECRET; echo
printf '%s' "$SECRET" | gcloud secrets versions add longjiao-google-client-secret --project "$PROJECT_ID" --data-file=-
echo "✅ 已更新 longjiao-google-client-secret"
