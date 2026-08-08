#!/usr/bin/env bash
set -euo pipefail

chart_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
repo_root="$(cd "$chart_dir/../.." && pwd)"
dev_values="$repo_root/environments/dev/rustfs/values.yaml"
rendered="$(mktemp)"
trap 'rm -f "$rendered"' EXIT

test -f "$chart_dir/Chart.yaml"
test -f "$chart_dir/values.yaml"
test -f "$dev_values"
grep -Fq 'name: rustfs' "$chart_dir/Chart.yaml"
grep -Fq 'version: 1.0.0-rc.1' "$chart_dir/Chart.yaml"
grep -Fq 'repository: https://charts.rustfs.com' "$chart_dir/Chart.yaml"

helm template rustfs "$chart_dir" --namespace infra -f "$dev_values" >"$rendered"

grep -Fq 'kind: Deployment' "$rendered"
if grep -Fq 'kind: StatefulSet' "$rendered"; then
  echo 'dev RustFS must use standalone Deployment mode' >&2
  exit 1
fi
test "$(grep -c '^kind: PersistentVolumeClaim$' "$rendered")" -eq 2
grep -Fq 'storage: 10Gi' "$rendered"
grep -Fq 'storage: 1Gi' "$rendered"
grep -Fq 'name: rustfs-secrets' "$rendered"
grep -Fq 'RUSTFS_BROWSER_REDIRECT_URL' "$rendered"
grep -Fq 'value: https://s3.acitrus.cn' "$rendered"
grep -Fq 'RUSTFS_IDENTITY_OPENID_ROLE_POLICY' "$rendered"
grep -Fq 'value: consoleAdmin' "$rendered"
