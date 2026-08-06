#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$repo_root"

failures=0
state_file=helmfile.yaml.gotmpl

fail() {
  printf 'not ok - %s\n' "$1" >&2
  failures=$((failures + 1))
}

pass() {
  printf 'ok - %s\n' "$1"
}

assert_line() {
  local content="$1"
  local expected="$2"
  local description="$3"

  if grep -Fqx -- "$expected" <<<"$content"; then
    pass "$description"
  else
    fail "$description"
  fi
}

release_block() {
  local release="$1"
  [[ -f "$state_file" ]] || return 0
  awk -v release="$release" '
    /^releases:$/ { in_releases = 1; next }
    in_releases && /^  - name: / {
      current = $0
      sub(/^  - name: /, "", current)
    }
    in_releases && current == release { print }
  ' "$state_file"
}

release_names() {
  [[ -f "$state_file" ]] || return 0
  awk '
    /^releases:$/ { in_releases = 1; next }
    in_releases && /^  - name: / { sub(/^  - name: /, ""); print }
  ' "$state_file"
}

if [[ -f "$state_file" && ! -e helmfile.yaml ]]; then
  pass 'Helmfile v1 discovers only the gotmpl state file'
else
  fail 'Helmfile v1 discovers only the gotmpl state file'
fi

built_state=""
if built_state="$(HELMFILE_USE_SECRETS=false helmfile -e dev build --skip-deps)"; then
  pass 'Helmfile builds with secrets disabled'
else
  fail 'Helmfile builds with secrets disabled'
fi

helm_defaults="$(
  awk '
    /^helmDefaults:$/ { in_defaults = 1; next }
    in_defaults && /^[^[:space:]#]/ { exit }
    in_defaults { print }
  ' <<<"$built_state"
)"
assert_line "$helm_defaults" '  atomic: true' 'atomic Helm default is enabled'
assert_line "$helm_defaults" '  wait: true' 'wait Helm default is enabled'
assert_line "$helm_defaults" '  waitForJobs: true' 'waitForJobs Helm default is enabled'
assert_line "$helm_defaults" '  timeout: 600' 'Helm timeout default is 600 seconds'

if grep -Eq '^[[:space:]]+(secrets|missingFileHandler):' <<<"$built_state"; then
  fail 'disabled secret mode omits all release secret wiring'
else
  pass 'disabled secret mode omits all release secret wiring'
fi

enabled_state=""
if enabled_state="$(HELMFILE_USE_SECRETS=true helmfile -e dev build --skip-deps)"; then
  pass 'Helmfile safely builds the enabled secret branch without decrypting files'
else
  fail 'Helmfile safely builds the enabled secret branch without decrypting files'
fi

core_releases=(redis postgresql traefik)
for release in "${core_releases[@]}"; do
  block="$(release_block "$release")"
  assert_line "$block" '      deployment: dev-core' "$release has the dev-core deployment label"
  assert_line "$enabled_state" "      - ./environments/dev/$release/secrets.sops.yaml" \
    "$release SOPS path renders only in the enabled state"

  if awk -v expected_path="./environments/{{ .Environment.Name }}/$release/secrets.sops.yaml" '
    /if eq \(env "HELMFILE_USE_SECRETS"\) "true"/ { conditional = NR }
    /^[[:space:]]+missingFileHandler: Warn$/ { handler = NR }
    /^[[:space:]]+secrets:$/ { secrets = NR }
    {
      line = $0
      sub(/^[[:space:]]+-[[:space:]]+/, "", line)
      if (line == expected_path) { path = NR }
    }
    conditional && /^{{-?[[:space:]]*end[[:space:]]*-?}}$/ { ending = NR }
    END {
      exit !(conditional < handler && handler < secrets && secrets < path && path < ending)
    }
  ' <<<"$block"; then
    pass "$release has conditional SOPS wiring with a warning handler"
  else
    fail "$release has conditional SOPS wiring with a warning handler"
  fi
done

if [[ "$(grep -Ec '^[[:space:]]+missingFileHandler: Warn$' <<<"$enabled_state")" -eq 3 ]] &&
  [[ "$(grep -Ec '^[[:space:]]+secrets:$' <<<"$enabled_state")" -eq 3 ]]; then
  pass 'enabled secret mode wires exactly three warning-tolerant secret lists'
else
  fail 'enabled secret mode wires exactly three warning-tolerant secret lists'
fi

while IFS= read -r release; do
  [[ -n "$release" ]] || continue
  case "$release" in
    redis | postgresql | traefik)
      continue
      ;;
  esac

  block="$(release_block "$release")"
  if grep -Eq 'deployment: dev-core|missingFileHandler:|^[[:space:]]+secrets:' <<<"$block"; then
    fail "$release is unchanged by dev-core deployment and secret wiring"
  else
    pass "$release is unchanged by dev-core deployment and secret wiring"
  fi
done < <(release_names)

list_output=""
if list_output="$(
  HELMFILE_USE_SECRETS=false helmfile -e dev --selector deployment=dev-core list --skip-deps
)"; then
  selected_releases="$(
    awk 'NR > 1 && NF { print $1 }' <<<"$list_output" |
      LC_ALL=C sort
  )"
  expected_releases="$(printf '%s\n' "${core_releases[@]}" | LC_ALL=C sort)"
  if [[ "$selected_releases" == "$expected_releases" ]]; then
    pass 'deployment=dev-core selects exactly postgresql, redis, and traefik'
  else
    printf 'selected releases:\n%s\n' "$selected_releases" >&2
    fail 'deployment=dev-core selects exactly postgresql, redis, and traefik'
  fi
else
  fail 'deployment=dev-core selector lists releases with secrets disabled'
fi

if ((failures > 0)); then
  printf '%s Helmfile dev-core check(s) failed\n' "$failures" >&2
  exit 1
fi

printf 'Helmfile dev-core checks passed\n'
