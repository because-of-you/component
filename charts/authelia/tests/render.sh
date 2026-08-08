#!/usr/bin/env bash
set -euo pipefail

chart_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
repo_root="$(cd "$chart_dir/../.." && pwd)"
dev_values="$repo_root/environments/dev/authelia/values.yaml"
fixture="$chart_dir/tests/values-valid.yaml"

rendered="$(mktemp)"
managed_secret_rendered="$(mktemp)"
custom_secret_rendered="$(mktemp)"
failure_output="$(mktemp)"
trap 'rm -f "$rendered" "$managed_secret_rendered" "$custom_secret_rendered" "$failure_output"' EXIT

grep -Fq 'name: authelia' "$chart_dir/Chart.yaml"
grep -Fq 'version: 0.11.6' "$chart_dir/Chart.yaml"
grep -Fq 'repository: https://charts.authelia.com' "$chart_dir/Chart.yaml"

helm template authelia "$chart_dir" --namespace infra --skip-schema-validation \
  -f "$dev_values" >"$rendered"

if grep -Fq 'kind: Secret' "$rendered"; then
  echo 'dev rendering must use the externally managed Secret' >&2
  exit 1
fi
grep -Fq 'secretName: authelia-secrets' "$rendered"
grep -Fq "implementation: 'lldap'" "$rendered"
grep -Fq "address: 'ldap://lldap.infra.svc.cluster.local:3890'" "$rendered"
grep -Fq "base_dn: 'dc=acitrus,dc=cn'" "$rendered"
grep -Fq "user: 'uid=authelia,ou=people,dc=acitrus,dc=cn'" "$rendered"
if grep -Eq 'opendirectory\.net|start_tls: true|memberUid|posixGroup' "$rendered"; then
  echo 'Authelia must not render the legacy OpenDirectory configuration' >&2
  exit 1
fi
grep -Fq "default_policy: 'one_factor'" "$rendered"
grep -A1 '^    totp:' "$rendered" | grep -Fq 'disable: true'
grep -A1 '^    webauthn:' "$rendered" | grep -Fq 'disable: true'
grep -Fq 'kind: Deployment' "$rendered"
if grep -Eq '^kind: (StatefulSet|PersistentVolumeClaim)$' "$rendered"; then
  echo 'dev rendering must remain stateless' >&2
  exit 1
fi
grep -Fq "host: 'redis-master.infra.svc.cluster.local'" "$rendered"
grep -Fq 'database_index: 1' "$rendered"
grep -Fq "address: 'tcp://postgresql.infra.svc.cluster.local:5432'" "$rendered"
grep -Fq "database: 'authelia'" "$rendered"
grep -Fq "schema: 'public'" "$rendered"
grep -Fq "username: 'postgres'" "$rendered"
grep -Fq 'AUTHELIA_SESSION_REDIS_PASSWORD_FILE' "$rendered"
grep -Fq 'AUTHELIA_STORAGE_POSTGRES_PASSWORD_FILE' "$rendered"
grep -Fq 'kind: IngressRoute' "$rendered"
grep -Fq 'Host(`auth.acitrus.cn`)' "$rendered"
grep -Fq 'certResolver: leresolver' "$rendered"
grep -Fq 'kind: Middleware' "$rendered"
grep -Fq 'name: "authelia-forwardauth"' "$rendered"
grep -Fq 'address: "http://authelia.infra.svc.cluster.local/api/authz/forward-auth"' "$rendered"
grep -Fq -- '- Remote-Groups' "$rendered"

helm template authelia "$chart_dir" --namespace infra --skip-schema-validation \
  -f "$dev_values" -f "$fixture" >"$managed_secret_rendered"
grep -Fq 'kind: Secret' "$managed_secret_rendered"
grep -Fq 'name: "authelia-secrets"' "$managed_secret_rendered"
grep -Fq 'authentication.ldap.password.txt: "test-ldap-password"' "$managed_secret_rendered"
grep -Fq 'session.redis.password.txt: "test-redis-password"' "$managed_secret_rendered"
grep -Fq 'storage.postgres.password.txt: "test-postgres-password"' "$managed_secret_rendered"

helm template authelia "$chart_dir" --namespace infra --skip-schema-validation \
  -f "$dev_values" -f "$fixture" \
  --set authelia.secret.existingSecret=custom-authelia-secrets \
  >"$custom_secret_rendered"
grep -Fq 'name: "custom-authelia-secrets"' "$custom_secret_rendered"
grep -Fq 'secretName: custom-authelia-secrets' "$custom_secret_rendered"

if helm template authelia "$chart_dir" --namespace infra --skip-schema-validation \
  -f "$dev_values" --set autheliaSecrets.enabled=true >"$failure_output" 2>&1; then
  echo 'expected empty enabled secrets to fail rendering' >&2
  exit 1
fi
grep -Fq 'autheliaSecrets.ldapPassword is required' "$failure_output"

grep -Fq 'chart: ./charts/authelia' "$repo_root/helmfile.yaml"
grep -Fq "'charts/authelia/**'" "$repo_root/.github/workflows/deploy-dev.yaml"
grep -Fq 'LLDAP_AUTHELIA_PASSWORD' "$repo_root/.github/workflows/deploy-dev.yaml"
if grep -Fq 'AUTHELIA_LDAP_PASSWORD' "$repo_root/.github/workflows/deploy-dev.yaml"; then
  echo 'Authelia credential sync must use the LLDAP bind account password' >&2
  exit 1
fi
authelia_sync_step="$(sed -n '/- name: Sync Authelia credentials/,/- name: Sync Aliyun DNS credentials/p' "$repo_root/.github/workflows/deploy-dev.yaml")"
grep -Fq 'POSTGRES_PASSWORD: ${{ secrets.POSTGRES_PASSWORD }}' <<<"$authelia_sync_step"
if grep -Fq 'AUTHELIA_POSTGRES_PASSWORD' <<<"$authelia_sync_step"; then
  echo 'Authelia credential sync must reuse POSTGRES_PASSWORD' >&2
  exit 1
fi
test -f "$dev_values"
grep -Fq '# Authelia' "$chart_dir/README.md"
grep -Fq 'authelia-forwardauth' "$chart_dir/README.md"
