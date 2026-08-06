#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$repo_root"

charts=(
  charts/redis
  charts/postgresql
  charts/traefik
)

selectors=()
for chart in "${charts[@]}"; do
  selectors+=(--selector "name=${chart##*/}")
done

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
    helmfile -e dev "${selectors[@]}" list --skip-deps |
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

  helmfile -e dev "${selectors[@]}" template --skip-deps >/dev/null
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
  local call_log output_file state_file target

  test_dir="$(mktemp -d)"
  trap 'rm -rf "$test_dir"' EXIT

  mkdir -p "$test_dir/bin"
  cat >"$test_dir/bin/helm" <<'EOF'
#!/usr/bin/env bash
printf '%s\n' "$*" >>"${HELM_CALL_LOG:?}"
if [[ ! -e "${HELM_FAIL_STATE:?}" ]]; then
  : >"$HELM_FAIL_STATE"
  exit 42
fi
exit 0
EOF
  chmod +x "$test_dir/bin/helm"

  for target in deps lint template; do
    state_file="$test_dir/$target.state"
    call_log="$test_dir/$target.calls"
    output_file="$test_dir/$target.output"
    if HELM_CALL_LOG="$call_log" HELM_FAIL_STATE="$state_file" PATH="$test_dir/bin:$PATH" \
      make --no-print-directory -C "$repo_root" "$target" >"$output_file" 2>&1; then
      cat "$output_file" >&2
      printf 'make %s returned success after the first chart command failed\n' "$target" >&2
      return 1
    fi
    if [[ "$(wc -l <"$call_log")" -ne 1 ]]; then
      cat "$call_log" >&2
      printf 'make %s continued after the first chart command failed\n' "$target" >&2
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
