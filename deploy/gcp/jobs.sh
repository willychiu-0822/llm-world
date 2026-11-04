#!/usr/bin/env bash
# 一次性工作：migrate（手動執行資料庫 migration）、seed-demo（放入示範內容）、purge-demo（清除示範內容）。
# 用法：PROJECT_ID=my-project bash deploy/gcp/jobs.sh seed-demo
set -euo pipefail
cd "$(dirname "$0")"
[ -f config.local.sh ] && source config.local.sh
source config.sh

TASK="${1:?用法：jobs.sh migrate|seed-demo|purge-demo}"
case "$TASK" in
  migrate) ARGS="dist/migrate.js" ;;
  seed-demo) ARGS="dist/seed-demo.js" ;;
  purge-demo) ARGS="dist/seed-demo.js,--purge" ;;
  *) echo "未知工作：$TASK"; exit 1 ;;
esac
IMAGE="$(gcloud run services describe "$SERVICE" --project "$PROJECT_ID" --region "$REGION" --format 'value(spec.template.spec.containers[0].image)')"
JOB="${SERVICE}-${TASK}"
gcloud run jobs deploy "$JOB" --project "$PROJECT_ID" --region "$REGION" --image "$IMAGE" \
  --service-account "$RUN_SA" --set-cloudsql-instances "$SQL_CONNECTION" \
  --command node --args "$ARGS" --max-retries 0 --task-timeout 300 \
  --set-env-vars "NODE_ENV=production" \
  --set-secrets "DATABASE_URL=longjiao-database-url:latest,SESSION_SECRET=longjiao-session-secret:latest"
gcloud run jobs execute "$JOB" --project "$PROJECT_ID" --region "$REGION" --wait
echo "✅ $TASK 完成"
