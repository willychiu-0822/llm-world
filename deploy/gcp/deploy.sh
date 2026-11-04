#!/usr/bin/env bash
# 建置映像並部署到 Cloud Run。
# 用法：PROJECT_ID=my-project GOOGLE_CLIENT_ID=xxx.apps.googleusercontent.com ADMIN_EMAILS=me@example.com bash deploy/gcp/deploy.sh
# 第一次部署可以先不填 GOOGLE_CLIENT_ID / BASE_URL，拿到網址後再部署一次（見 docs/DEPLOYMENT.md）。
set -euo pipefail
cd "$(dirname "$0")"
[ -f config.local.sh ] && source config.local.sh
source config.sh

TAG="${TAG:-$(git rev-parse --short HEAD 2>/dev/null || date +%Y%m%d%H%M%S)}"
IMAGE="${IMAGE_BASE}:${TAG}"

if [ "${SKIP_BUILD:-false}" != "true" ]; then
  echo "▶ 用 Cloud Build 建置 $IMAGE"
  gcloud builds submit ../.. --project "$PROJECT_ID" --region "$REGION" --tag "$IMAGE"
fi

# BASE_URL 沒給時，沿用服務目前的網址（第一次部署會先用暫時值）。
if [ -z "${BASE_URL:-}" ]; then
  BASE_URL="$(gcloud run services describe "$SERVICE" --project "$PROJECT_ID" --region "$REGION" --format 'value(status.url)' 2>/dev/null || true)"
fi
BASE_URL="${BASE_URL:-https://placeholder.invalid}"

echo "▶ 部署 Cloud Run 服務 $SERVICE（BASE_URL=$BASE_URL）"
gcloud run deploy "$SERVICE" \
  --project "$PROJECT_ID" --region "$REGION" --image "$IMAGE" \
  --service-account "$RUN_SA" \
  --add-cloudsql-instances "$SQL_CONNECTION" \
  --allow-unauthenticated --port 8080 --cpu 1 --memory 512Mi \
  --min-instances "${MIN_INSTANCES:-0}" --max-instances "${MAX_INSTANCES:-3}" --concurrency 80 --timeout 60 \
  --set-env-vars "NODE_ENV=production,BASE_URL=${BASE_URL},GOOGLE_CLIENT_ID=${GOOGLE_CLIENT_ID:-},ADMIN_EMAILS=${ADMIN_EMAILS:-},MODERATION_MODE=${MODERATION_MODE:-filter},DB_POOL_MAX=5" \
  --set-secrets "DATABASE_URL=longjiao-database-url:latest,SESSION_SECRET=longjiao-session-secret:latest,GOOGLE_CLIENT_SECRET=longjiao-google-client-secret:latest"

URL="$(gcloud run services describe "$SERVICE" --project "$PROJECT_ID" --region "$REGION" --format 'value(status.url)')"
echo "✅ 已部署：$URL"
if [ "$URL" != "$BASE_URL" ]; then
  echo "⚠️  BASE_URL 和服務網址不同。請用 BASE_URL=$URL 再執行一次本腳本（SKIP_BUILD=true 可略過建置），"
  echo "    並把 $URL/auth/google/callback 加到 Google OAuth client 的已授權重新導向 URI。"
fi
