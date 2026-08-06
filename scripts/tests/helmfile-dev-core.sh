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

assert_no_secret_wiring() {
  local rendered_state="$1"
  local description="$2"

  if grep -Eq '^[[:space:]]+(secrets|missingFileHandler):' <<<"$rendered_state"; then
    fail "$description"
  else
    pass "$description"
  fi
}

if [[ -f "$state_file" && ! -e helmfile.yaml ]]; then
  pass 'Helmfile v1 discovers only the gotmpl state file'
else
  fail 'Helmfile v1 discovers only the gotmpl state file'
fi

if grep -Fq '[helmfile.yaml.gotmpl](./helmfile.yaml.gotmpl)' README.md &&
  ! grep -Fq '[helmfile.yaml](./helmfile.yaml)' README.md; then
  pass 'README links to the canonical Helmfile state'
else
  fail 'README links to the canonical Helmfile state'
fi

if bash charts/authelia/tests/render.sh; then
  pass 'Authelia chart test resolves the canonical Helmfile state'
else
  fail 'Authelia chart test resolves the canonical Helmfile state'
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

assert_no_secret_wiring "$built_state" 'false secret mode omits all release secret wiring'

unset_state=""
if unset_state="$(env -u HELMFILE_USE_SECRETS helmfile -e dev build --skip-deps)"; then
  pass 'Helmfile builds with HELMFILE_USE_SECRETS unset'
else
  fail 'Helmfile builds with HELMFILE_USE_SECRETS unset'
fi
assert_no_secret_wiring "$unset_state" 'unset secret mode omits all release secret wiring'

enabled_state=""
if enabled_state="$(HELMFILE_USE_SECRETS=true helmfile -e dev build --skip-deps)"; then
  pass 'Helmfile safely builds the enabled secret branch without decrypting files'
else
  fail 'Helmfile safely builds the enabled secret branch without decrypting files'
fi

core_releases=(redis postgresql traefik)
expected_secret_paths="$(
  for release in "${core_releases[@]}"; do
    printf './environments/dev/%s/secrets.sops.yaml\n' "$release"
  done | LC_ALL=C sort
)"
actual_secret_paths="$(
  awk '
    /^    secrets:$/ { in_secrets = 1; next }
    in_secrets && /^      - / {
      sub(/^      - /, "")
      print
      next
    }
    in_secrets { in_secrets = 0 }
  ' <<<"$enabled_state" | LC_ALL=C sort
)"
if [[ "$actual_secret_paths" == "$expected_secret_paths" ]]; then
  pass 'enabled secret mode renders exactly the three dev-core SOPS paths'
else
  printf 'rendered secret paths:\n%s\n' "$actual_secret_paths" >&2
  fail 'enabled secret mode renders exactly the three dev-core SOPS paths'
fi

if [[ "$(grep -Ec '^    missingFileHandler:' <<<"$enabled_state")" -eq 3 ]] &&
  [[ "$(grep -Ec '^    missingFileHandler: Warn$' <<<"$enabled_state")" -eq 3 ]]; then
  pass 'enabled secret mode renders exactly three Warn handlers'
else
  fail 'enabled secret mode renders exactly three Warn handlers'
fi

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
