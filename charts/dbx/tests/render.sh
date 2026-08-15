#!/usr/bin/env bash
set -euo pipefail

chart_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
repo_root="$(cd "$chart_dir/../.." && pwd)"
dev_values="$repo_root/environments/dev/dbx/values.yaml"

rendered="$(mktemp)"
default_rendered="$(mktemp)"
trap 'rm -f "$rendered" "$default_rendered"' EXIT

helm template dbx "$chart_dir" --namespace app -f "$dev_values" >"$rendered"
helm template dbx "$chart_dir" --namespace app >"$default_rendered"

grep -Fq 'appVersion: "0.5.84"' "$chart_dir/Chart.yaml"
grep -Fq 'repository: t8y2/dbx' "$chart_dir/values.yaml"
grep -Fq 'tag: "0.5.84"' "$chart_dir/values.yaml"

grep -Fq 'kind: Deployment' "$rendered"
grep -Fq 'replicas: 1' "$rendered"
grep -Fq 'type: Recreate' "$rendered"
grep -Fq 'image: "t8y2/dbx:0.5.84"' "$rendered"
grep -Fq 'containerPort: 4224' "$rendered"
grep -A1 -F 'name: DBX_DISABLE_PASSWORD' "$rendered" | grep -Fq 'value: "1"'
grep -A1 -F 'name: DBX_DATA_DIR' "$rendered" | grep -Fq 'value: "/app/data"'
grep -Fq 'path: /api/auth/check' "$rendered"
grep -Fq 'automountServiceAccountToken: false' "$rendered"
grep -Fq 'readOnlyRootFilesystem: true' "$rendered"
grep -Fq 'runAsNonRoot: true' "$rendered"

grep -Fq 'kind: Service' "$rendered"
grep -Fq 'type: ClusterIP' "$rendered"
grep -Fq 'port: 80' "$rendered"
grep -Fq 'targetPort: http' "$rendered"

grep -Fq 'kind: PersistentVolumeClaim' "$rendered"
grep -Fq 'accessModes:' "$rendered"
grep -Fq -- '- ReadWriteOnce' "$rendered"
grep -Fq 'storage: 5Gi' "$rendered"

grep -Fq 'kind: NetworkPolicy' "$rendered"
grep -Fq 'kubernetes.io/metadata.name: "traefik"' "$rendered"
grep -Fq 'port: 4224' "$rendered"

grep -Fq 'kind: IngressRoute' "$rendered"
grep -Fq 'match: '\''Host(`db.acitrus.cn`)'\''' "$rendered"
grep -Fq 'name: "authelia-forwardauth"' "$rendered"
grep -Fq 'namespace: "infra"' "$rendered"
grep -Fq 'certResolver: leresolver' "$rendered"

if grep -Fq 'name: DBX_DISABLE_PASSWORD' "$default_rendered"; then
  echo 'standalone chart must preserve DBX password protection by default' >&2
  exit 1
fi
if grep -Fq 'kind: IngressRoute' "$default_rendered"; then
  echo 'standalone chart must not expose DBX by default' >&2
  exit 1
fi
if grep -Fq 'kind: NetworkPolicy' "$default_rendered"; then
  echo 'standalone chart must not assume a network policy implementation by default' >&2
  exit 1
fi
if helm template invalid "$chart_dir" --set replicaCount=2 >/dev/null 2>&1; then
  echo 'values schema must reject multiple DBX replicas' >&2
  exit 1
fi
if helm template invalid "$chart_dir" --set service.type=NodePort >/dev/null 2>&1; then
  echo 'values schema must reject a directly exposed DBX service' >&2
  exit 1
fi

grep -Fq 'chart: ./charts/dbx' "$repo_root/helmfile.yaml"
grep -Fq "'charts/dbx/**'" "$repo_root/.github/workflows/deploy-dev.yaml"
grep -Fq "'environments/dev/dbx/**'" "$repo_root/.github/workflows/deploy-dev.yaml"
grep -Fq -- '- dbx' "$repo_root/.github/workflows/deploy-dev.yaml"
grep -Fq 'domain: db.acitrus.cn' "$repo_root/environments/dev/authelia/values.yaml"
grep -A3 -F 'domain: db.acitrus.cn' "$repo_root/environments/dev/authelia/values.yaml" | grep -Fq 'group:lldap_admin'
