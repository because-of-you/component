#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

charts=(
  charts/redis
  charts/postgresql
  charts/traefik
)

for chart in "${charts[@]}"; do
  make --no-print-directory -C "$repo_root" lint RENDER_CHART_DIRS="$chart"
  make --no-print-directory -C "$repo_root" template RENDER_CHART_DIRS="$chart"
done

make --no-print-directory -C "$repo_root" helmfile-template
