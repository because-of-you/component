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

test "$(grep -c '^kind: Job$' "$rendered")" -eq 2
grep -Fq 'helm.sh/hook: pre-install,pre-upgrade' "$rendered"
grep -Fq 'image: "postgres:18.4-alpine"' "$rendered"
grep -Fq 'database_name="lldap"' "$rendered"
grep -Fq "SELECT 1 FROM pg_database WHERE datname='\$database_name'" "$rendered"
grep -Fq 'createdb "$database_name"' "$rendered"
grep -Fq 'name: "postgresql-auth"' "$rendered"
grep -Fq 'key: "postgres-password"' "$rendered"

grep -Fq 'helm.sh/hook: post-install,post-upgrade' "$rendered"
grep -Fq '"id": "authelia"' "$rendered"
grep -Fq '"password_file": "/secrets/authelia-password"' "$rendered"
grep -Fq 'lldap_strict_readonly' "$rendered"
grep -Fq 'value: "http://lldap:17170"' "$rendered"
grep -Fq 'name: DO_CLEANUP' "$rendered"
grep -Fq 'value: "false"' "$rendered"
grep -Fq '/app/bootstrap.sh' "$rendered"
grep -Fq 'key: lldap-ldap-user-pass' "$rendered"
grep -Fq 'key: authelia-password' "$rendered"

grep -Fq 'chart: ./charts/lldap' "$repo_root/helmfile.yaml"
lldap_release="$(sed -n '/  - name: lldap/,/  - name: authelia/p' "$repo_root/helmfile.yaml")"
grep -Fq -- '- infra/postgresql' <<<"$lldap_release"
authelia_release="$(sed -n '/  - name: authelia/,/  - name: traefik/p' "$repo_root/helmfile.yaml")"
grep -Fq -- '- infra/lldap' <<<"$authelia_release"
