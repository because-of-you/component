#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
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
    exit 1
  fi
  if [[ "$(wc -l <"$call_log")" -ne 1 ]]; then
    cat "$call_log" >&2
    printf 'make %s continued after the first chart command failed\n' "$target" >&2
    exit 1
  fi
done
