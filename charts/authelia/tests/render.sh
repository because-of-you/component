#!/usr/bin/env bash
set -euo pipefail

chart_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
repo_root="$(cd "$chart_dir/../.." && pwd)"

grep -Fq 'name: authelia' "$chart_dir/Chart.yaml"
grep -Fq 'version: 0.11.6' "$chart_dir/Chart.yaml"
grep -Fq 'repository: https://charts.authelia.com' "$chart_dir/Chart.yaml"

fixture="$chart_dir/tests/values-valid.yaml"
rendered="$(mktemp)"
failure_output="$(mktemp)"
custom_secret_rendered="$(mktemp)"
trap 'rm -f "$rendered" "$failure_output" "$custom_secret_rendered"' EXIT

helm template authelia "$chart_dir" --namespace infra --skip-schema-validation \
  -f "$fixture" >"$rendered"

grep -Fq 'kind: Secret' "$rendered"
grep -Fq 'name: "authelia-secrets"' "$rendered"
grep -Fq 'authentication.ldap.password.txt: "test-ldap-password"' "$rendered"
grep -Fq "address: 'ldap://opendirectory.net'" "$rendered"
grep -Fq "additional_users_dn: 'ou=public'" "$rendered"
grep -Fq "username: 'uid'" "$rendered"
grep -Fq "default_policy: 'one_factor'" "$rendered"
if grep -Fq "default_redirection_url: 'https://auth.acitrus.cn'" "$rendered"; then
  echo 'default_redirection_url must not equal the Authelia portal URL' >&2
  exit 1
fi
grep -A1 '^    totp:' "$rendered" | grep -Fq 'disable: true'
grep -A1 '^    webauthn:' "$rendered" | grep -Fq 'disable: true'
grep -Fq 'kind: StatefulSet' "$rendered"
grep -Fq 'kind: PersistentVolumeClaim' "$rendered"
grep -Fq 'kind: IngressRoute' "$rendered"
grep -Fq 'Host(`auth.acitrus.cn`)' "$rendered"
grep -Fq 'certResolver: leresolver' "$rendered"
grep -Fq 'kind: Middleware' "$rendered"
grep -Fq 'name: "authelia-forwardauth"' "$rendered"
grep -Fq 'address: "http://authelia.infra.svc.cluster.local/api/authz/forward-auth"' "$rendered"
grep -Fq -- '- Remote-Groups' "$rendered"

helm template authelia "$chart_dir" --namespace infra --skip-schema-validation \
  -f "$fixture" \
  --set authelia.secret.existingSecret=custom-authelia-secrets \
  >"$custom_secret_rendered"
grep -Fq 'name: "custom-authelia-secrets"' "$custom_secret_rendered"
grep -Fq 'secretName: custom-authelia-secrets' "$custom_secret_rendered"

if helm template authelia "$chart_dir" --namespace infra --skip-schema-validation \
  --set autheliaSecrets.enabled=true >"$failure_output" 2>&1; then
  echo 'expected empty enabled secrets to fail rendering' >&2
  exit 1
fi
grep -Fq 'autheliaSecrets.ldapPassword is required' "$failure_output"

grep -Fq 'chart: ./charts/authelia' "$repo_root/helmfile.yaml"
test -f "$repo_root/environments/dev/authelia/values.yaml"
test -f "$repo_root/environments/prod/authelia/values.yaml"
grep -Fq '# Authelia' "$chart_dir/README.md"
grep -Fq 'authelia-forwardauth' "$chart_dir/README.md"
