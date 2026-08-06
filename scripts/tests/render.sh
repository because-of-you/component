#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$repo_root"

charts=(
  charts/redis
  charts/postgresql
  charts/traefik
)

selectors=(--selector deployment=dev-core)

build_dependencies() {
  local chart dependency_status
  for chart in "${charts[@]}"; do
    if grep -q '^dependencies:' "$chart/Chart.yaml"; then
      dependency_status="$(helm dependency list "$chart")"
      if ! printf '%s\n' "$dependency_status" | awk '
        NR > 1 && NF { found = 1; if ($NF != "ok") bad = 1 }
        END { exit !(found && !bad) }
      '; then
        helm dependency build --skip-refresh "$chart"
      fi
    fi
  done
}

lint_chart() {
  helm lint "$1"
}

template_chart() {
  helm template test "$1" >/dev/null
}

lint_charts() {
  local chart
  for chart in "${charts[@]}"; do
    lint_chart "$chart"
  done
}

template_charts() {
  local chart
  for chart in "${charts[@]}"; do
    template_chart "$chart"
  done
}

render_helmfile() {
  local expected_releases selected_releases

  selected_releases="$(
    HELMFILE_USE_SECRETS=false helmfile -e dev "${selectors[@]}" list --skip-deps |
      awk 'NR > 1 && NF { print $1 }' |
      LC_ALL=C sort
  )"
  expected_releases="$(
    for chart in "${charts[@]}"; do
      printf '%s\n' "${chart##*/}"
    done | LC_ALL=C sort
  )"

  if [[ "$selected_releases" != "$expected_releases" ]]; then
    printf 'unexpected Helmfile releases:\n%s\n' "$selected_releases" >&2
    return 1
  fi

  HELMFILE_USE_SECRETS=false helmfile -e dev "${selectors[@]}" template --skip-deps >/dev/null
}

render_all() {
  local chart
  for chart in "${charts[@]}"; do
    lint_chart "$chart"
    template_chart "$chart"
  done
  render_helmfile
}

verify_fail_fast() {
  local actual_calls call_index call_log cleanup_command expected_calls fail_subcommand
  local last_call output_file release_fixture state_dir status target test_dir

  test_dir="$(mktemp -d)"
  printf -v cleanup_command 'rm -rf -- %q' "$test_dir"
  trap "$cleanup_command" EXIT

  mkdir -p "$test_dir/bin"

  count_calls() {
    local call_type="$1"
    local log_file="$2"
    awk -F '\t' -v call_type="$call_type" '
      $1 == call_type { count++ }
      END { print count + 0 }
    ' "$log_file"
  }

  cat >"$test_dir/bin/helm" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail

subcommand="$1"
if [[ "$subcommand" == dependency ]]; then
  subcommand="dependency-${2:-}"
fi

state_file="${HELM_STATE_DIR:?}/$subcommand.count"
call_index=0
if [[ -f "$state_file" ]]; then
  read -r call_index <"$state_file"
fi
call_index=$((call_index + 1))
printf '%s\n' "$call_index" >"$state_file"
printf '%s\t%s\n' "$subcommand" "$*" >>"${HELM_CALL_LOG:?}"

if [[ "${HELM_FAIL_SUBCOMMAND:-}" == "$subcommand" ]] &&
  [[ "$call_index" -eq "${HELM_FAIL_CALL_INDEX:-0}" ]]; then
  exit 42
fi

if [[ "$subcommand" == dependency-list ]]; then
  chart="${*: -1}"
  printf 'NAME\tVERSION\tREPOSITORY\tSTATUS\n'
  printf '%s\t1.0.0\tfile://fixture\t%s\n\n' "${chart##*/}" "${HELM_DEPENDENCY_STATUS:-ok}"
fi
exit 0
EOF
  chmod +x "$test_dir/bin/helm"

  cat >"$test_dir/bin/helmfile" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail

subcommand=""
for argument in "$@"; do
  if [[ "$argument" == list || "$argument" == template ]]; then
    subcommand="$argument"
    break
  fi
done
[[ -n "$subcommand" ]]

printf '%s\t%s\n' "$subcommand" "$*" >>"${HELMFILE_CALL_LOG:?}"
if [[ "${HELMFILE_FAIL_SUBCOMMAND:-}" == "$subcommand" ]]; then
  exit 43
fi

if [[ "$subcommand" == list ]]; then
  printf 'NAME\tNAMESPACE\tENABLED\tINSTALLED\tLABELS\tCHART\tVERSION\n'
  while IFS= read -r release; do
    [[ -n "$release" ]] || continue
    printf '%s\tinfra\ttrue\ttrue\tname:%s\t./charts/%s\t\n' "$release" "$release" "$release"
  done <<<"${HELMFILE_RELEASE_FIXTURE:?}"
fi
EOF
  chmod +x "$test_dir/bin/helmfile"

  for target in lint template; do
    for ((call_index = 1; call_index <= ${#charts[@]}; call_index++)); do
      state_dir="$test_dir/$target-$call_index.state"
      call_log="$test_dir/$target-$call_index.calls"
      output_file="$test_dir/$target-$call_index.output"
      mkdir -p "$state_dir"
      if HELM_CALL_LOG="$call_log" HELM_FAIL_CALL_INDEX="$call_index" HELM_STATE_DIR="$state_dir" \
        HELM_FAIL_SUBCOMMAND="$target" PATH="$test_dir/bin:$PATH" \
        make --no-print-directory -C "$repo_root" "$target" >"$output_file" 2>&1; then
        cat "$output_file" >&2
        printf 'make %s returned success after Helm call %s failed\n' "$target" "$call_index" >&2
        return 1
      fi
      actual_calls="$(count_calls "$target" "$call_log")"
      last_call="$(tail -n 1 "$call_log")"
      if [[ "$actual_calls" -ne "$call_index" ]] ||
        [[ "$last_call" != *"${charts[call_index - 1]}"* ]]; then
        cat "$call_log" >&2
        printf 'make %s did not stop at failed Helm call %s\n' "$target" "$call_index" >&2
        return 1
      fi
    done
  done

  state_dir="$test_dir/deps-ok.state"
  call_log="$test_dir/deps-ok.calls"
  output_file="$test_dir/deps-ok.output"
  mkdir -p "$state_dir"
  if ! HELM_CALL_LOG="$call_log" HELM_DEPENDENCY_STATUS=ok HELM_STATE_DIR="$state_dir" \
    PATH="$test_dir/bin:$PATH" make --no-print-directory -C "$repo_root" deps >"$output_file" 2>&1; then
    cat "$output_file" >&2
    printf 'make deps failed with valid dependency archives\n' >&2
    return 1
  fi
  if [[ "$(count_calls dependency-list "$call_log")" -ne "${#charts[@]}" ]] ||
    [[ "$(count_calls dependency-build "$call_log")" -ne 0 ]]; then
    cat "$call_log" >&2
    printf 'make deps rebuilt valid dependency archives\n' >&2
    return 1
  fi

  for status in missing mismatch; do
    state_dir="$test_dir/deps-$status.state"
    call_log="$test_dir/deps-$status.calls"
    output_file="$test_dir/deps-$status.output"
    mkdir -p "$state_dir"
    if ! HELM_CALL_LOG="$call_log" HELM_DEPENDENCY_STATUS="$status" HELM_STATE_DIR="$state_dir" \
      PATH="$test_dir/bin:$PATH" make --no-print-directory -C "$repo_root" deps >"$output_file" 2>&1; then
      cat "$output_file" >&2
      printf 'make deps failed to rebuild %s dependency archives\n' "$status" >&2
      return 1
    fi
    if [[ "$(count_calls dependency-list "$call_log")" -ne "${#charts[@]}" ]] ||
      [[ "$(count_calls dependency-build "$call_log")" -ne "${#charts[@]}" ]]; then
      cat "$call_log" >&2
      printf 'make deps did not rebuild every %s dependency archive\n' "$status" >&2
      return 1
    fi
    for chart in "${charts[@]}"; do
      if ! grep -Fqx $'dependency-build\t'"dependency build --skip-refresh $chart" "$call_log"; then
        cat "$call_log" >&2
        printf 'make deps omitted --skip-refresh while rebuilding %s\n' "$chart" >&2
        return 1
      fi
    done
  done

  for ((call_index = 1; call_index <= ${#charts[@]}; call_index++)); do
    state_dir="$test_dir/deps-fail-$call_index.state"
    call_log="$test_dir/deps-fail-$call_index.calls"
    output_file="$test_dir/deps-fail-$call_index.output"
    mkdir -p "$state_dir"
    if HELM_CALL_LOG="$call_log" HELM_DEPENDENCY_STATUS=missing \
      HELM_FAIL_CALL_INDEX="$call_index" HELM_FAIL_SUBCOMMAND=dependency-build \
      HELM_STATE_DIR="$state_dir" PATH="$test_dir/bin:$PATH" \
      make --no-print-directory -C "$repo_root" deps >"$output_file" 2>&1; then
      cat "$output_file" >&2
      printf 'make deps returned success after dependency build %s failed\n' "$call_index" >&2
      return 1
    fi
    actual_calls="$(count_calls dependency-build "$call_log")"
    expected_calls="$(count_calls dependency-list "$call_log")"
    last_call="$(tail -n 1 "$call_log")"
    if [[ "$actual_calls" -ne "$call_index" ]] || [[ "$expected_calls" -ne "$call_index" ]] ||
      [[ "$last_call" != *$'dependency build --skip-refresh '"${charts[call_index - 1]}" ]]; then
      cat "$call_log" >&2
      printf 'make deps did not stop at failed dependency build %s\n' "$call_index" >&2
      return 1
    fi
  done

  release_fixture="$(
    for chart in "${charts[@]}"; do
      printf '%s\n' "${chart##*/}"
    done
  )"
  for fail_subcommand in list template; do
    call_log="$test_dir/helmfile-$fail_subcommand.calls"
    output_file="$test_dir/helmfile-$fail_subcommand.output"
    if HELMFILE_CALL_LOG="$call_log" HELMFILE_FAIL_SUBCOMMAND="$fail_subcommand" \
      HELMFILE_RELEASE_FIXTURE="$release_fixture" PATH="$test_dir/bin:$PATH" \
      make --no-print-directory -C "$repo_root" helmfile-template >"$output_file" 2>&1; then
      cat "$output_file" >&2
      printf 'make helmfile-template returned success after helmfile %s failed\n' "$fail_subcommand" >&2
      return 1
    fi
    expected_calls=1
    [[ "$fail_subcommand" == template ]] && expected_calls=2
    last_call="$(tail -n 1 "$call_log")"
    if [[ "$(wc -l <"$call_log")" -ne "$expected_calls" ]] ||
      [[ "$last_call" != "$fail_subcommand"$'\t'* ]]; then
      cat "$call_log" >&2
      printf 'make helmfile-template did not reach failing %s command\n' "$fail_subcommand" >&2
      return 1
    fi
  done

  cat >"$test_dir/bin/bash" <<'EOF'
#!/bin/sh
printf '%s\n' "$*" >>"${BASH_CALL_LOG:?}"
if [ "$*" = 'scripts/tests/render.sh' ]; then
  exit 44
fi
exit 0
EOF
  chmod +x "$test_dir/bin/bash"

  for target in test verify; do
    call_log="$test_dir/$target-bash.calls"
    output_file="$test_dir/$target-bash.output"
    if BASH_CALL_LOG="$call_log" PATH="$test_dir/bin:$PATH" \
      make --no-print-directory -C "$repo_root" "$target" >"$output_file" 2>&1; then
      cat "$output_file" >&2
      printf 'make %s returned success after its render test failed\n' "$target" >&2
      return 1
    fi
    expected_calls=3
    [[ "$target" == verify ]] && expected_calls=4
    last_call="$(tail -n 1 "$call_log")"
    if [[ "$(wc -l <"$call_log")" -ne "$expected_calls" ]] ||
      [[ "$last_call" != 'scripts/tests/render.sh' ]]; then
      cat "$call_log" >&2
      printf 'make %s did not propagate the intended render test failure\n' "$target" >&2
      return 1
    fi
  done
}

case "${1:-render}" in
  deps)
    build_dependencies
    ;;
  lint)
    lint_charts
    ;;
  template)
    template_charts
    ;;
  helmfile-template)
    render_helmfile
    ;;
  render)
    render_all
    ;;
  fail-fast)
    verify_fail_fast
    ;;
  *)
    printf 'usage: %s [deps|lint|template|helmfile-template|render|fail-fast]\n' "$0" >&2
    exit 2
    ;;
esac
