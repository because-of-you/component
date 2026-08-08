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
grep -Fq "default_policy: 'deny'" "$rendered"
grep -Fq -- "- 'ldap.acitrus.cn'" "$rendered"
grep -Fq 'policy: one_factor' "$rendered"
grep -Fq -- "- ['group:lldap_admin']" "$rendered"
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
grep -Fq 'kind: Job' "$rendered"
grep -Fq 'name: "authelia-database"' "$rendered"
grep -Fq 'helm.sh/hook: pre-install,pre-upgrade' "$rendered"
grep -Fq 'image: "postgres:18.4-alpine"' "$rendered"
grep -Fq 'database_name="authelia"' "$rendered"
grep -Fq "SELECT 1 FROM pg_database WHERE datname='\$database_name'" "$rendered"
grep -Fq 'createdb "$database_name"' "$rendered"
grep -Fq 'name: "postgresql-auth"' "$rendered"
grep -Fq 'key: "postgres-password"' "$rendered"
grep -Fq 'kind: IngressRoute' "$rendered"
grep -Fq 'Host(`auth.acitrus.cn`)' "$rendered"
grep -Fq 'certResolver: leresolver' "$rendered"
grep -Fq 'kind: Middleware' "$rendered"
grep -Fq 'name: "authelia-forwardauth"' "$rendered"
grep -Fq 'address: "http://authelia.infra.svc.cluster.local/api/authz/forward-auth"' "$rendered"
grep -Fq -- '- Remote-Groups' "$rendered"
grep -Fq "client_id: 'claude-code-hub'" "$rendered"
grep -Fq "claims_policy: 'claude_code_hub'" "$rendered"
grep -Fq -- "- 'https://inner.coding.acitrus.cn/api/auth/oidc/callback'" "$rendered"
grep -Fq 'require_pkce: true' "$rendered"
grep -Fq "pkce_challenge_method: 'S256'" "$rendered"
grep -Fq "token_endpoint_auth_method: 'client_secret_basic'" "$rendered"
grep -Fq -- "- 'groups'" "$rendered"

rustfs_client_block="$(awk '
  /^          - client_id: '\''rustfs-console'\''$/ { capture = 1 }
  capture && /^          - client_id:/ && $0 !~ /rustfs-console/ { exit }
  capture && /^        [^ ]/ { exit }
  capture && /^    [^ ]/ { exit }
  capture { print }
' "$rendered")"
test -n "$rustfs_client_block"
grep -Fq "client_id: 'rustfs-console'" <<<"$rustfs_client_block"
grep -Fq "client_name: 'RustFS Console'" <<<"$rustfs_client_block"
grep -Fq '/secrets/oidc/identity_providers.oidc.clients.rustfs-console.secret.txt' <<<"$rustfs_client_block"
grep -Fq "authorization_policy: 'one_factor'" <<<"$rustfs_client_block"
grep -Fq "claims_policy: 'rustfs'" <<<"$rustfs_client_block"
grep -Fq 'require_pkce: true' <<<"$rustfs_client_block"
grep -Fq "pkce_challenge_method: 'S256'" <<<"$rustfs_client_block"
grep -Fq 'redirect_uris:' <<<"$rustfs_client_block"
grep -Fq -- "- 'https://s3.acitrus.cn/rustfs/admin/v3/oidc/callback/default'" <<<"$rustfs_client_block"
grep -Fq 'scopes:' <<<"$rustfs_client_block"
grep -Fq -- "- 'openid'" <<<"$rustfs_client_block"
grep -Fq -- "- 'profile'" <<<"$rustfs_client_block"
grep -Fq -- "- 'email'" <<<"$rustfs_client_block"
grep -Fq -- "- 'groups'" <<<"$rustfs_client_block"

rustfs_grant_types_block="$(awk '
  /^            grant_types:$/ { capture = 1 }
  capture && /^            [^ ]/ && $0 !~ /grant_types:/ { exit }
  capture { print }
' <<<"$rustfs_client_block")"
expected_rustfs_grant_types="            grant_types:
              - 'authorization_code'"
test "$rustfs_grant_types_block" = "$expected_rustfs_grant_types"

rustfs_response_types_block="$(awk '
  /^            response_types:$/ { capture = 1 }
  capture && /^            [^ ]/ && $0 !~ /response_types:/ { exit }
  capture { print }
' <<<"$rustfs_client_block")"
expected_rustfs_response_types="            response_types:
              - 'code'"
test "$rustfs_response_types_block" = "$expected_rustfs_response_types"

grep -Fq "token_endpoint_auth_method: 'client_secret_post'" <<<"$rustfs_client_block"

oidc_secret_mount_block="$(awk '
  /^        - name: secret-authelia-secrets$/ { capture = 1 }
  capture && /^        - name:/ && $0 !~ /secret-authelia-secrets/ { exit }
  capture && /^      volumes:$/ { exit }
  capture { print }
' "$rendered")"
test -n "$oidc_secret_mount_block"
grep -Fq 'name: secret-authelia-secrets' <<<"$oidc_secret_mount_block"
grep -Fq 'mountPath: /secrets/oidc' <<<"$oidc_secret_mount_block"

oidc_secret_volume_block="$(awk '
  /^      volumes:$/ { in_volumes = 1 }
  in_volumes && /^      - name: secret-authelia-secrets$/ { capture = 1 }
  capture && /^      - name:/ && $0 !~ /secret-authelia-secrets/ { exit }
  capture && /^---$/ { exit }
  capture { print }
' "$rendered")"
test -n "$oidc_secret_volume_block"
grep -Fq 'secretName: authelia-secrets' <<<"$oidc_secret_volume_block"
grep -Fq 'items:' <<<"$oidc_secret_volume_block"
grep -Fq 'key: identity_providers.oidc.clients.rustfs-console.secret.txt' <<<"$oidc_secret_volume_block"
grep -Fq 'path: identity_providers.oidc.clients.rustfs-console.secret.txt' <<<"$oidc_secret_volume_block"

grep -Fq 'mountPath: /secrets/oidc' "$rendered"
grep -Fq 'identity_providers.oidc.jwk.RS256.pem' "$rendered"
grep -Fq 'identity_providers.oidc.clients.claude-code-hub.secret.txt' "$rendered"

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
workflow="$repo_root/.github/workflows/deploy-dev.yaml"
workflow_step() {
  local step_name="$1"
  awk -v target="      - name: $step_name" '
    $0 == target { capture = 1 }
    capture && /^      - name:/ && $0 != target { exit }
    capture { print }
  ' "$workflow"
}

authelia_sync_step="$(workflow_step 'Sync Authelia credentials')"
test -n "$authelia_sync_step"
grep -Fxq "        if: matrix.component == 'authelia'" <<<"$authelia_sync_step"
grep -Fq 'POSTGRES_PASSWORD: ${{ secrets.POSTGRES_PASSWORD }}' <<<"$authelia_sync_step"
grep -Fq 'AUTHELIA_OIDC_HMAC_SECRET: ${{ secrets.AUTHELIA_OIDC_HMAC_SECRET }}' <<<"$authelia_sync_step"
grep -Fq 'AUTHELIA_OIDC_JWK: ${{ secrets.AUTHELIA_OIDC_JWK }}' <<<"$authelia_sync_step"
grep -Fq 'CCH_OIDC_CLIENT_SECRET_DIGEST: ${{ secrets.CCH_OIDC_CLIENT_SECRET_DIGEST }}' <<<"$authelia_sync_step"
grep -Fxq '          RUSTFS_OIDC_CLIENT_SECRET_DIGEST: ${{ secrets.RUSTFS_OIDC_CLIENT_SECRET_DIGEST }}' <<<"$authelia_sync_step"
grep -Fxq '          test -n "$RUSTFS_OIDC_CLIENT_SECRET_DIGEST"' <<<"$authelia_sync_step"
grep -Fxq '          printf '\''%s'\'' "$RUSTFS_OIDC_CLIENT_SECRET_DIGEST" > "$credentials_dir/identity_providers.oidc.clients.rustfs-console.secret.txt"' <<<"$authelia_sync_step"
grep -Fq -- '--from-file=identity_providers.oidc.hmac.key=' <<<"$authelia_sync_step"
grep -Fq -- '--from-file=identity_providers.oidc.jwk.RS256.pem=' <<<"$authelia_sync_step"
grep -Fq -- '--from-file=identity_providers.oidc.clients.claude-code-hub.secret.txt=' <<<"$authelia_sync_step"
grep -Fxq '            --from-file=identity_providers.oidc.clients.rustfs-console.secret.txt="$credentials_dir/identity_providers.oidc.clients.rustfs-console.secret.txt" \' <<<"$authelia_sync_step"
if grep -Fq 'AUTHELIA_POSTGRES_PASSWORD' <<<"$authelia_sync_step"; then
  echo 'Authelia credential sync must reuse POSTGRES_PASSWORD' >&2
  exit 1
fi

authelia_restart_step="$(workflow_step 'Restart Authelia after deployment')"
test -n "$authelia_restart_step"
grep -Fxq "        if: matrix.component == 'authelia'" <<<"$authelia_restart_step"
grep -Fxq '          kubectl -n infra rollout restart deployment/authelia' <<<"$authelia_restart_step"
grep -Fxq '          kubectl -n infra rollout status deployment/authelia --timeout=300s' <<<"$authelia_restart_step"
test -f "$dev_values"
grep -Fq '# Authelia' "$chart_dir/README.md"
grep -Fq 'authelia-forwardauth' "$chart_dir/README.md"
