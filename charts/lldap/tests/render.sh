#!/usr/bin/env bash
set -euo pipefail

chart_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
repo_root="$(cd "$chart_dir/../.." && pwd)"
dev_values="$repo_root/environments/dev/lldap/values.yaml"

rendered="$(mktemp)"
trap 'rm -f "$rendered"' EXIT

grep -Fq 'name: lldap' "$chart_dir/Chart.yaml"
grep -Fq 'version: 0.4.0' "$chart_dir/Chart.yaml"
grep -Fq 'repository: https://evantage-ws.github.io/lldap-kubernetes/' "$chart_dir/Chart.yaml"

helm template lldap "$chart_dir" --namespace infra -f "$dev_values" >"$rendered"

grep -Fq 'kind: Deployment' "$rendered"
grep -Fq 'replicas: 1' "$rendered"
grep -Eq 'image: "?lldap/lldap:stable-alpine-rootless"?' "$rendered"
grep -Fq 'name: LLDAP_DATABASE_URL' "$rendered"
grep -Fq 'name: lldap-secrets' "$rendered"
grep -Fq 'key: database-url' "$rendered"

grep -Fq 'kind: Service' "$rendered"
grep -Fq 'port: 3890' "$rendered"
grep -Fq 'port: 17170' "$rendered"

grep -Fq 'kind: Ingress' "$rendered"
grep -Fq 'ldap.acitrus.cn' "$rendered"
grep -Fq 'traefik.ingress.kubernetes.io/router.entrypoints: websecure' "$rendered"
grep -Fq 'traefik.ingress.kubernetes.io/router.tls.certresolver: leresolver' "$rendered"

for forbidden_kind in HorizontalPodAutoscaler PersistentVolumeClaim Certificate Secret IngressRoute; do
  if grep -Fq "kind: $forbidden_kind" "$rendered"; then
    echo "dev rendering must not create $forbidden_kind" >&2
    exit 1
  fi
done
