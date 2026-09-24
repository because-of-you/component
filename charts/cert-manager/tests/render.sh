#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
chart_dir="$repo_root/charts/cert-manager"
rendered="$(mktemp)"
trap 'rm -f "$rendered"' EXIT

helm template cert-manager "$chart_dir" \
  --namespace cert-manager > "$rendered"

grep -Fq 'kind: Deployment' "$rendered"
grep -Fq 'name: cert-manager-certManager' "$rendered"

echo 'cert-manager render checks passed'
