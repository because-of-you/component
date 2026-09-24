#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
chart_dir="$repo_root/charts/cert-manager"
dev_values="$repo_root/environments/dev/cert-manager/values.yaml"
rendered="$(mktemp)"
trap 'rm -f "$rendered"' EXIT

helm template cert-manager "$chart_dir" \
  --namespace cert-manager \
  -f "$dev_values" > "$rendered"

grep -Fq 'kind: ClusterIssuer' "$rendered"
grep -Fq 'name: letsencrypt' "$rendered"
grep -Fq 'kind: Certificate' "$rendered"
grep -Fq 'name: acitrus-tls' "$rendered"
grep -Fq 'groupName: acme.acitrus.cn' "$rendered"
grep -Fq 'solverName: alidns-solver' "$rendered"
grep -Fq 'name: alidns-secrets' "$rendered"

echo 'cert-manager render checks passed'
