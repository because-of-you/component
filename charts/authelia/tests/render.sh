#!/usr/bin/env bash
set -euo pipefail

chart_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

grep -Fq 'name: authelia' "$chart_dir/Chart.yaml"
grep -Fq 'version: 0.11.6' "$chart_dir/Chart.yaml"
grep -Fq 'repository: https://charts.authelia.com' "$chart_dir/Chart.yaml"
