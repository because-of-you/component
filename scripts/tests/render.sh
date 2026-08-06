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
  *)
    printf 'usage: %s [deps|lint|template|helmfile-template|render]\n' "$0" >&2
    exit 2
    ;;
esac
