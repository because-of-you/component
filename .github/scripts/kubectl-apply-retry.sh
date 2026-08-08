#!/usr/bin/env bash
set -euo pipefail

attempts="${KUBECTL_RETRY_ATTEMPTS:-5}"
request_timeout="${KUBECTL_REQUEST_TIMEOUT:-30s}"
kubectl_bin="${KUBECTL_BIN:-kubectl}"

umask 077
manifest="$(mktemp)"
trap 'rm -f "$manifest"' EXIT
cat >"$manifest"

for ((attempt = 1; attempt <= attempts; attempt++)); do
  if "$kubectl_bin" apply \
    --validate=false \
    --request-timeout="$request_timeout" \
    -f "$manifest"; then
    exit 0
  fi

  if ((attempt == attempts)); then
    echo "kubectl apply failed after $attempts attempts" >&2
    exit 1
  fi

  delay=$((attempt * 3))
  echo "kubectl apply attempt $attempt failed; retrying in ${delay}s" >&2
  sleep "$delay"
done
