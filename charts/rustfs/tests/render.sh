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

test "$(grep -c '^kind: IngressRoute$' "$rendered")" -eq 2
if grep -Fq 'kind: IngressRouteTCP' "$rendered"; then
  echo 'RustFS S3 must use an HTTP IngressRoute' >&2
  exit 1
fi
grep -Fq 'name: "rustfs-console"' "$rendered"
grep -Fq 'name: "rustfs-s3-api"' "$rendered"
grep -Fq 'match: '\''Host(`s3.acitrus.cn`)'\''' "$rendered"
grep -Fq -- '- websecure' "$rendered"
grep -Fq -- '- gravitation' "$rendered"
grep -Fq 'port: 9001' "$rendered"
grep -Fq 'port: 9000' "$rendered"
grep -Fq 'certResolver: leresolver' "$rendered"
if grep -R -F --include='*.yaml' --include='*.tpl' 'HostSNI(`*`)' "$repo_root/charts"; then
  echo 'A catch-all TCP router would intercept the shared gravitation entrypoint' >&2
  exit 1
fi

grep -Fq 'chart: ./charts/rustfs' "$repo_root/helmfile.yaml"
grep -Fq -- '- infra/authelia' "$repo_root/helmfile.yaml"
workflow="$repo_root/.github/workflows/deploy-dev.yaml"
grep -Fq "'charts/rustfs/**'" "$workflow"
grep -Fq "'environments/dev/rustfs/**'" "$workflow"
grep -Fq -- '- rustfs' "$workflow"
rustfs_sync_step="$(sed -n '/- name: Sync RustFS credentials/,/- name: Sync Claude Code Hub credentials/p' "$workflow")"
grep -Fq 'RUSTFS_ACCESS_KEY: ${{ secrets.RUSTFS_ACCESS_KEY }}' <<<"$rustfs_sync_step"
grep -Fq 'RUSTFS_SECRET_KEY: ${{ secrets.RUSTFS_SECRET_KEY }}' <<<"$rustfs_sync_step"
grep -Fq 'RUSTFS_OIDC_CLIENT_SECRET: ${{ secrets.RUSTFS_OIDC_CLIENT_SECRET }}' <<<"$rustfs_sync_step"
grep -Fq 'kubectl -n infra create secret generic rustfs-secrets' <<<"$rustfs_sync_step"
grep -Fq -- '--from-file=RUSTFS_IDENTITY_OPENID_CLIENT_SECRET=' <<<"$rustfs_sync_step"
grep -Fq 'name: Restart RustFS after deployment' "$workflow"
