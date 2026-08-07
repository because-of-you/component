#!/usr/bin/env bash
set -euo pipefail

chart_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
repo_root="$(cd "$chart_dir/../.." && pwd)"
dev_values="$repo_root/environments/dev/lldap/values.yaml"

rendered="$(mktemp)"
trap 'rm -f "$rendered"' EXIT

helm template lldap "$chart_dir" --namespace infra -f "$dev_values" >"$rendered"

grep -Fq 'kind: Deployment' "$rendered"
grep -Fq 'replicas: 1' "$rendered"
grep -Fq 'image: "lldap/lldap:stable-alpine-rootless"' "$rendered"
grep -Fq 'name: LLDAP_DATABASE_URL' "$rendered"
grep -Fq 'name: LLDAP_LDAP_BASE_DN' "$rendered"
grep -Fq 'value: "dc=acitrus,dc=cn"' "$rendered"
grep -Fq 'name: LLDAP_HTTP_URL' "$rendered"
grep -Fq 'value: "https://ldap.acitrus.cn"' "$rendered"
grep -Fq 'runAsNonRoot: true' "$rendered"
grep -Fq 'runAsUser: 1000' "$rendered"
grep -Fq 'allowPrivilegeEscalation: false' "$rendered"

grep -Fq 'kind: Service' "$rendered"
grep -Fq 'name: ldap' "$rendered"
grep -Fq 'port: 3890' "$rendered"
grep -Fq 'name: web' "$rendered"
grep -Fq 'port: 17170' "$rendered"

grep -Fq 'kind: IngressRoute' "$rendered"
grep -Fq 'Host(`ldap.acitrus.cn`)' "$rendered"
grep -Fq 'certResolver: leresolver' "$rendered"

if grep -Fq 'kind: PersistentVolumeClaim' "$rendered"; then
  echo 'LLDAP must persist data in PostgreSQL instead of a PVC' >&2
  exit 1
fi

if grep -Fq 'kind: Secret' "$rendered"; then
  echo 'dev rendering must use the externally managed Secret' >&2
  exit 1
fi
