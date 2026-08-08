#!/usr/bin/env bash
set -euo pipefail

chart_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
repo_root="$(cd "$chart_dir/../.." && pwd)"
dev_values="$repo_root/environments/dev/claude-code-hub/values.yaml"

rendered="$(mktemp)"
pdb_rendered="$(mktemp)"
trap 'rm -f "$rendered" "$pdb_rendered"' EXIT

grep -Fq 'name: claude-code-hub' "$chart_dir/Chart.yaml"
grep -Fq 'appVersion: "codex-authelia-oidc"' "$chart_dir/Chart.yaml"
grep -Fq 'tag: codex-authelia-oidc' "$chart_dir/values.yaml"
grep -Fq '"enum": ["legacy", "dual", "opaque"]' "$chart_dir/values.schema.json"

helm template claude-code-hub "$chart_dir" --namespace app -f "$dev_values" >"$rendered"

grep -Fq 'kind: Deployment' "$rendered"
grep -Fq 'image: "registry.cn-shenzhen.aliyuncs.com/gravitation/claude-code-hub:codex-authelia-oidc"' "$rendered"
grep -Fq 'imagePullPolicy: Always' "$rendered"
grep -Fq 'containerPort: 3000' "$rendered"
grep -Fq 'name: DSN' "$rendered"
grep -Fq 'name: REDIS_URL' "$rendered"
grep -Fq 'name: ADMIN_TOKEN' "$rendered"
grep -A1 -F 'name: OIDC_ENABLED' "$rendered" | grep -Fq 'value: "true"'
grep -A1 -F 'name: OIDC_REDIRECT_URI' "$rendered" | grep -Fq 'value: "https://inner.coding.acitrus.cn/api/auth/oidc/callback"'
grep -A1 -F 'name: AUTO_MIGRATE' "$rendered" | grep -Fq 'value: "true"'
grep -Fq 'name: SESSION_TOKEN_MODE' "$rendered"
grep -A1 -F 'name: SESSION_TOKEN_MODE' "$rendered" | grep -Fq 'value: "opaque"'
grep -Fq 'path: /api/actions/health' "$rendered"
grep -Fq 'automountServiceAccountToken: false' "$rendered"
grep -Fq 'runAsNonRoot: true' "$rendered"
grep -Fq 'runAsUser: 70' "$rendered"
grep -Fq 'runAsUser: 1000' "$rendered"
grep -Fq 'runAsGroup: 1000' "$rendered"
grep -Fq 'cpu: 1000m' "$rendered"
grep -Fq 'memory: 1Gi' "$rendered"

grep -Fq 'kind: Service' "$rendered"
grep -Fq 'type: ClusterIP' "$rendered"
grep -Fq 'port: 80' "$rendered"
grep -Fq 'targetPort: http' "$rendered"

grep -Fq 'kind: IngressRoute' "$rendered"
grep -Fq 'match: '\''Host(`inner.coding.acitrus.cn`)'\''' "$rendered"
grep -Fq 'name: claude-code-hub' "$rendered"
grep -Fq 'certResolver: leresolver' "$rendered"
if grep -Fq 'middlewares:' "$rendered"; then
  echo "CCH must use native OIDC instead of Traefik ForwardAuth" >&2
  exit 1
fi

if grep -Fq 'kind: PodDisruptionBudget' "$rendered"; then
  echo "dev must not create a PodDisruptionBudget" >&2
  exit 1
fi

helm template claude-code-hub "$chart_dir" \
  --namespace app \
  --set podDisruptionBudget.enabled=true >"$pdb_rendered"
grep -Fq 'kind: PodDisruptionBudget' "$pdb_rendered"
grep -Fq 'maxUnavailable: 1' "$pdb_rendered"

grep -Fq 'kind: Job' "$rendered"
grep -Fq 'name: claude-code-hub-database' "$rendered"
grep -Fq 'helm.sh/hook: pre-install,pre-upgrade' "$rendered"
grep -Fq 'database_name="claude_code_hub"' "$rendered"
grep -Fq 'name: "claude-code-hub-secrets"' "$rendered"
grep -Fq 'key: "postgres-password"' "$rendered"

for forbidden_kind in Ingress Middleware PersistentVolumeClaim Secret StatefulSet; do
  if grep -Eq "^kind: $forbidden_kind$" "$rendered"; then
    echo "internal deployment must not create $forbidden_kind" >&2
    exit 1
  fi
done

grep -Fq 'chart: ./charts/claude-code-hub' "$repo_root/helmfile.yaml"
grep -Fq "'charts/claude-code-hub/templates/**'" "$repo_root/.github/workflows/deploy-dev.yaml"
grep -Fq "'environments/dev/claude-code-hub/**'" "$repo_root/.github/workflows/deploy-dev.yaml"
grep -Fq 'CCH_ADMIN_TOKEN: ${{ secrets.CCH_ADMIN_TOKEN }}' "$repo_root/.github/workflows/deploy-dev.yaml"
grep -Fq 'CCH_OIDC_CLIENT_SECRET: ${{ secrets.CCH_OIDC_CLIENT_SECRET }}' "$repo_root/.github/workflows/deploy-dev.yaml"
sync_workflow="$repo_root/.github/workflows/sync-images.yaml"
test -f "$sync_workflow"
grep -Fq "'images/*/images.json'" "$sync_workflow"
grep -Fq 'node .github/scripts/build-image-matrix.mjs' "$sync_workflow"
grep -Fq 'uses: ./.github/actions/mirror-container-image' "$sync_workflow"
grep -Fq 'destination-password: ${{ secrets.ALIYUN_ACR_PASSWORD }}' "$sync_workflow"
if grep -Fq 'uses: ./.github/actions/mirror-container-image' "$repo_root/.github/workflows/deploy-dev.yaml"; then
  echo "Deploy Dev must not mirror container images" >&2
  exit 1
fi
mirror_action="$repo_root/.github/actions/mirror-container-image/action.yml"
test -f "$mirror_action"
grep -Fq 'source_digest="$(skopeo inspect' "$mirror_action"
grep -Fq '[[ "$source_digest" == "$destination_digest" ]]' "$mirror_action"
grep -Fq 'skopeo copy --all "docker://${SOURCE_IMAGE}" "docker://${DESTINATION_IMAGE}"' "$mirror_action"
image_manifest="$repo_root/images/claude-code-hub/images.json"
test -f "$image_manifest"
grep -Fq '"source": "ghcr.io/because-of-you/claude-code-hub:codex-authelia-oidc"' "$image_manifest"
grep -Fq '"destination": "registry.cn-shenzhen.aliyuncs.com/gravitation/claude-code-hub:codex-authelia-oidc"' "$image_manifest"
grep -Fq 'kubectl -n app create secret generic claude-code-hub-secrets' "$repo_root/.github/workflows/deploy-dev.yaml"
grep -Fq -- '--from-file=dsn=' "$repo_root/.github/workflows/deploy-dev.yaml"
grep -Fq -- '--from-file=redis-url=' "$repo_root/.github/workflows/deploy-dev.yaml"
grep -Fq -- '--from-file=oidc-client-secret=' "$repo_root/.github/workflows/deploy-dev.yaml"
deploy_line="$(grep -nF 'name: Deploy ${{ matrix.component }}' "$repo_root/.github/workflows/deploy-dev.yaml" | cut -d: -f1)"
restart_line="$(grep -nF 'name: Restart Claude Code Hub after deployment' "$repo_root/.github/workflows/deploy-dev.yaml" | cut -d: -f1)"
test "$restart_line" -gt "$deploy_line"

if helm template invalid "$chart_dir" --set config.sessionTokenMode=invalid >/dev/null 2>&1; then
  echo "values schema must reject an invalid session token mode" >&2
  exit 1
fi

oidc_rendered="$(mktemp)"
trap 'rm -f "$rendered" "$pdb_rendered" "$oidc_rendered"' EXIT
helm template oidc "$chart_dir" \
  --set config.oidc.enabled=true \
  --set config.oidc.issuerUrl=https://auth.acitrus.cn \
  --set config.oidc.clientId=claude-code-hub \
  --set config.oidc.redirectUri=https://hub.acitrus.cn/api/auth/oidc/callback \
  >"$oidc_rendered"
grep -A1 -F 'name: OIDC_ENABLED' "$oidc_rendered" | grep -Fq 'value: "true"'
grep -A1 -F 'name: OIDC_ISSUER_URL' "$oidc_rendered" | grep -Fq 'value: "https://auth.acitrus.cn"'
grep -Fq 'name: OIDC_CLIENT_SECRET' "$oidc_rendered"
grep -Fq 'key: "oidc-client-secret"' "$oidc_rendered"
grep -A1 -F 'name: OIDC_REQUIRED_GROUP' "$oidc_rendered" | grep -Fq 'value: "lldap_admin"'
