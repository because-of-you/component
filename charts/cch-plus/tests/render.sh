#!/usr/bin/env bash
set -euo pipefail

chart_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
repo_root="$(cd "$chart_dir/../.." && pwd)"
rendered="$(mktemp)"
trap 'rm -f "$rendered"' EXIT

helm template cch-plus "$chart_dir" \
  --namespace cchp \
  -f "$repo_root/environments/dev/cch-plus/values.yaml" \
  > "$rendered"

grep -Fq 'kind: ConfigMap' "$rendered"
grep -Fq 'name: cchp-config' "$rendered"
grep -Fq 'name: cchp-objectstore' "$rendered"
grep -Fq 'name: cchp-task-results' "$rendered"
grep -Fq 'image: "registry.cn-shenzhen.aliyuncs.com/gravitation/cch-plus:dev-1.0.13"' "$rendered"
grep -Fq 'image: "registry.cn-shenzhen.aliyuncs.com/gravitation/timescaledb:2.31.0-pg18"' "$rendered"
grep -Fq 'image: "registry.cn-shenzhen.aliyuncs.com/gravitation/dragonfly:v2.0.2"' "$rendered"
grep -Fq 'name: cch-plus-migrate-1' "$rendered"
grep -Fq 'name: wait-for-postgres' "$rendered"
grep -Fq 'pg_isready -h postgres -p 5432 -U hub -d app' "$rendered"
upgrade_rendered="$(mktemp)"
trap 'rm -f "$rendered" "$upgrade_rendered"' EXIT
helm template cch-plus "$chart_dir" \
  --namespace cchp \
  --is-upgrade \
  -f "$repo_root/environments/dev/cch-plus/values.yaml" \
  > "$upgrade_rendered"
grep -Fq 'helm.sh/hook: pre-upgrade' "$upgrade_rendered"
grep -Fq 'helm.sh/hook-delete-policy: before-hook-creation,hook-succeeded' "$upgrade_rendered"
grep -Fq 'command:' "$rendered"
grep -Fq '/usr/local/bin/migrate' "$rendered"
grep -Fq 'name: control' "$rendered"
grep -Fq 'name: gateway' "$rendered"
grep -Fq 'name: gateway-hl' "$rendered"
grep -Fq 'name: worker' "$rendered"
grep -Fq 'apiVersion: traefik.io/v1alpha1' "$rendered"
grep -Fq 'Host(`api.cchp.acitrus.cn`)' "$rendered"
grep -Fq 'Host(`cchp.acitrus.cn`)' "$rendered"
grep -Fq 'Path(`/api/admin/cchub-import/upload`)' "$rendered"
grep -Fq 'namespace: traefik' "$rendered"
grep -Fq 'source: ghcr.io/cch-hq/cch-plus:1.0.13' "$repo_root/images/cch-plus/images.yaml"
grep -Fq 'source: timescale/timescaledb:2.31.0-pg18' "$repo_root/images/cch-plus/images.yaml"
grep -Fq 'source: docker.dragonflydb.io/dragonflydb/dragonfly:v2.0.2' "$repo_root/images/cch-plus/images.yaml"
grep -Fq 'destination: registry.cn-shenzhen.aliyuncs.com/gravitation/cch-plus:dev-1.0.13' "$repo_root/images/cch-plus/images.yaml"
grep -Fq 'destination: registry.cn-shenzhen.aliyuncs.com/gravitation/timescaledb:2.31.0-pg18' "$repo_root/images/cch-plus/images.yaml"
grep -Fq 'destination: registry.cn-shenzhen.aliyuncs.com/gravitation/dragonfly:v2.0.2' "$repo_root/images/cch-plus/images.yaml"
grep -Fq 'CCHP_IMAGE_TAG: dev-1.0.13' "$repo_root/.github/workflows/deploy-dev.yaml"
grep -Fq 'helmfile -e dev --selector name=cch-plus sync' "$repo_root/.github/workflows/deploy-dev.yaml"
grep -Fq 'POSTGRES_PASSWORD: ${{ secrets.POSTGRES_PASSWORD }}' "$repo_root/.github/workflows/deploy-dev.yaml"
if grep -Fq 'CCHP_POSTGRES_PASSWORD' "$repo_root/.github/workflows/deploy-dev.yaml"; then
  echo 'cch-plus must reuse the existing POSTGRES_PASSWORD secret' >&2
  exit 1
fi

without_ingress="$(mktemp)"
trap 'rm -f "$rendered" "$upgrade_rendered" "$without_ingress"' EXIT
helm template cch-plus "$chart_dir" --namespace cchp --set ingressRoute.enabled=false > "$without_ingress"
if grep -Fq 'apiVersion: traefik.io/v1alpha1' "$without_ingress"; then
  echo 'IngressRoute must be disabled when ingressRoute.enabled=false' >&2
  exit 1
fi

echo 'cch-plus render checks: OK'
