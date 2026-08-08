#!/usr/bin/env bash
set -euo pipefail

chart_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
repo_root="$(cd "$chart_dir/../.." && pwd)"
dev_values="$repo_root/environments/dev/claude-code-hub/values.yaml"

rendered="$(mktemp)"
trap 'rm -f "$rendered"' EXIT

grep -Fq 'name: claude-code-hub' "$chart_dir/Chart.yaml"
grep -Fq 'appVersion: "0.8.10"' "$chart_dir/Chart.yaml"
grep -Fq 'tag: v0.8.10' "$chart_dir/values.yaml"

helm template claude-code-hub "$chart_dir" --namespace app -f "$dev_values" >"$rendered"

grep -Fq 'kind: Deployment' "$rendered"
grep -Fq 'image: "ghcr.io/ding113/claude-code-hub:v0.8.10"' "$rendered"
grep -Fq 'containerPort: 3000' "$rendered"
grep -Fq 'name: DSN' "$rendered"
grep -Fq 'name: REDIS_URL' "$rendered"
grep -Fq 'name: ADMIN_TOKEN' "$rendered"
grep -A1 -F 'name: AUTO_MIGRATE' "$rendered" | grep -Fq 'value: "true"'
grep -Fq 'name: SESSION_TOKEN_MODE' "$rendered"
grep -A1 -F 'name: SESSION_TOKEN_MODE' "$rendered" | grep -Fq 'value: "opaque"'
grep -Fq 'path: /api/actions/health' "$rendered"
grep -Fq 'automountServiceAccountToken: false' "$rendered"
grep -Fq 'runAsNonRoot: true' "$rendered"
grep -Fq 'runAsUser: 70' "$rendered"
grep -Fq 'cpu: 1000m' "$rendered"
grep -Fq 'memory: 1Gi' "$rendered"

grep -Fq 'kind: Service' "$rendered"
grep -Fq 'type: ClusterIP' "$rendered"
grep -Fq 'port: 80' "$rendered"
grep -Fq 'targetPort: http' "$rendered"

grep -Fq 'kind: Job' "$rendered"
grep -Fq 'name: claude-code-hub-database' "$rendered"
grep -Fq 'helm.sh/hook: pre-install,pre-upgrade' "$rendered"
grep -Fq 'database_name="claude_code_hub"' "$rendered"
grep -Fq 'name: "claude-code-hub-secrets"' "$rendered"
grep -Fq 'key: "postgres-password"' "$rendered"

for forbidden_kind in Ingress IngressRoute PersistentVolumeClaim Secret StatefulSet; do
  if grep -Eq "^kind: $forbidden_kind$" "$rendered"; then
    echo "internal deployment must not create $forbidden_kind" >&2
    exit 1
  fi
done

grep -Fq 'chart: ./charts/claude-code-hub' "$repo_root/helmfile.yaml"
grep -Fq "'charts/claude-code-hub/**'" "$repo_root/.github/workflows/deploy-dev.yaml"
grep -Fq "'environments/dev/claude-code-hub/**'" "$repo_root/.github/workflows/deploy-dev.yaml"
grep -Fq 'CCH_ADMIN_TOKEN: ${{ secrets.CCH_ADMIN_TOKEN }}' "$repo_root/.github/workflows/deploy-dev.yaml"
grep -Fq 'kubectl -n app create secret generic claude-code-hub-secrets' "$repo_root/.github/workflows/deploy-dev.yaml"
grep -Fq -- '--from-file=dsn=' "$repo_root/.github/workflows/deploy-dev.yaml"
grep -Fq -- '--from-file=redis-url=' "$repo_root/.github/workflows/deploy-dev.yaml"
