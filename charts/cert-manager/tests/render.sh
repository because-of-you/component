#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
chart_dir="$repo_root/charts/cert-manager"
dev_values="$repo_root/environments/dev/cert-manager/values.yaml"
rendered="$(mktemp)"
trap 'rm -f "$rendered"' EXIT

helm template cert-manager "$chart_dir" \
  --namespace cert-manager \
  -f "$dev_values" > "$rendered"

grep -Fq 'kind: Deployment' "$rendered"
grep -Fq 'name: cert-manager-webhook' "$rendered"
grep -Fq 'image: "registry.cn-shenzhen.aliyuncs.com/gravitation/cert-manager:controller-v1.21.2"' "$rendered"
grep -Fq 'image: "registry.cn-shenzhen.aliyuncs.com/gravitation/cert-manager:webhook-v1.21.2"' "$rendered"
grep -Fq 'image: "registry.cn-shenzhen.aliyuncs.com/gravitation/cert-manager:cainjector-v1.21.2"' "$rendered"
grep -Fq 'image: "registry.cn-shenzhen.aliyuncs.com/gravitation/cert-manager:startupapicheck-v1.21.2"' "$rendered"
grep -Fq -- '--acme-http01-solver-image=registry.cn-shenzhen.aliyuncs.com/gravitation/cert-manager:acmesolver-v1.21.2' "$rendered"

echo 'cert-manager render checks passed'
